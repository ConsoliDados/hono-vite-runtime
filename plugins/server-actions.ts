import { createHash } from 'node:crypto'
import { join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

interface ActionMeta {
  filePath: string
  functionName: string
}

interface ActionManifest {
  salt: string
  actions: Record<string, ActionMeta>
}

function generateSalt(): string {
  return createHash('sha256')
    .update(Date.now().toString())
    .update(Math.random().toString())
    .digest('hex')
}

function generateActionHash(filePath: string, functionName: string, salt: string): string {
  const data = `${filePath}:${functionName}:${salt}`
  return createHash('sha256').update(data).digest('hex').substring(0, 12)
}

export function serverActions(): Plugin {
  const virtualRuntimeId = 'virtual:server-actions-runtime'
  const virtualManifestId = 'virtual:server-actions-manifest'
  const resolvedRuntimeId = `\0${virtualRuntimeId}`
  const resolvedManifestId = `\0${virtualManifestId}`

  let salt: string
  let configRoot: string
  let srcDir: string
  const manifest: ActionManifest = { salt: '', actions: {} }

  /**
   * Rescans all .server.ts files and rebuilds the manifest from scratch.
   * Called on initial build and on every add / change / unlink in dev.
   */
  async function scanAndPopulateManifest() {
    manifest.actions = {}

    const glob = await import('fast-glob')
    const fs = await import('node:fs/promises')
    const serverFiles = await glob.default('src/**/*.server.ts', {
      cwd: configRoot,
      absolute: true,
    })

    console.log(`[PLUGIN] Scanning ${serverFiles.length} server action files...`)

    for (const file of serverFiles) {
      const code = await fs.readFile(file, 'utf-8')
      const relativePath = relative(resolve(configRoot, 'src'), file).replace(/\\/g, '/')

      const exportMatches = code.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)
      const exports = Array.from(exportMatches).map((match) => match[1])

      for (const exportName of exports) {
        const hash = generateActionHash(relativePath, exportName, salt)
        manifest.actions[hash] = {
          filePath: relativePath,
          functionName: exportName,
        }
        console.log(`[PLUGIN] Registered: ${exportName} → ${hash} (${relativePath})`)
      }
    }

    console.log(`[PLUGIN] Manifest ready with ${Object.keys(manifest.actions).length} actions`)
  }

  return {
    name: 'server-actions',
    enforce: 'pre',

    configResolved(config) {
      // Capture config.root once — plugins must not rely on process.cwd()
      configRoot = config.root
      srcDir = join(config.root, 'src')

      // Generate salt once per Vite session
      salt = generateSalt()
      manifest.salt = salt
      console.log('[PLUGIN] Server actions salt generated:', `${salt.substring(0, 8)}...`)
    },

    async buildStart() {
      await scanAndPopulateManifest()
    },

    /**
     * Watch src/ for .server.ts changes in dev mode.
     * Any add / change / unlink triggers a full manifest rescan and a
     * full-reload so both the client stubs and the server manifest stay in sync.
     */
    configureServer(server) {
      const handleChange = async (file: string, event: string) => {
        if (!file.startsWith(srcDir) || !file.endsWith('.server.ts')) return

        console.log(`[PLUGIN] Server action file ${event}: ${file}`)
        await scanAndPopulateManifest()

        // Invalidate the virtual manifest so Vite re-serves updated content
        const manifestModule = server.moduleGraph.getModuleById(resolvedManifestId)
        if (manifestModule) {
          server.moduleGraph.invalidateModule(manifestModule)
        }

        server.ws.send({ type: 'full-reload', path: '*' })
      }

      server.watcher.on('add',    (file) => handleChange(file, 'added'))
      server.watcher.on('change', (file) => handleChange(file, 'changed'))
      server.watcher.on('unlink', (file) => handleChange(file, 'removed'))
    },

    resolveId(id) {
      if (id === virtualRuntimeId) {
        return resolvedRuntimeId
      }
      if (id === virtualManifestId) {
        return resolvedManifestId
      }
    },

    load(id) {
      if (id === resolvedRuntimeId) {
        // Client-side runtime to call server actions using hash
        return `
// Helper to convert File to base64
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Process args to serialize FormData and Files
async function serializeArgs(args) {
  return Promise.all(args.map(async (arg) => {
    if (arg instanceof FormData) {
      const entries = [];
      for (const [key, value] of arg.entries()) {
        if (value instanceof File) {
          // Convert File to base64
          const base64 = await fileToBase64(value);
          entries.push([key, {
            __type: 'File',
            name: value.name,
            type: value.type,
            size: value.size,
            lastModified: value.lastModified,
            data: base64
          }]);
        } else {
          entries.push([key, value]);
        }
      }
      return {
        __type: 'FormData',
        entries
      };
    }
    return arg;
  }));
}

export async function callServerAction(actionHash, args) {
  console.log('[CLIENT] callServerAction:', { actionHash, args });

  // Serialize FormData and Files
  const processedArgs = await serializeArgs(args);
  console.log('[CLIENT] Processed args:', processedArgs);

  const response = await fetch('/__server-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionHash, args: processedArgs })
  });

  console.log('[CLIENT] Response status:', response.status);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Server action failed' }));
    console.error('[CLIENT] Server action error:', error);
    throw new Error(error.message || 'Server action failed');
  }

  const result = await response.json();
  console.log('[CLIENT] Server action result:', result);
  return result;
}
`
      }

      if (id === resolvedManifestId) {
        // Export manifest for server-side usage
        return `export default ${JSON.stringify(manifest, null, 2)}`
      }
    },

    transform(code, id) {
      // Detect imports from .server.ts files
      if (!id.includes('.server.ts') && !id.includes('.server.js')) {
        return null
      }

      // If it's the .server.ts file itself, don't transform (server-side)
      if (id.endsWith('.server.ts') || id.endsWith('.server.js')) {
        // In dev/build client, replace with stubs that call the server
        if (this.environment?.name === 'client' || !this.environment) {
          const relativePath = relative(resolve(configRoot, 'src'), id).replace(/\\/g, '/')

          // Extract exports from file
          const exportMatches = code.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)
          const exports = Array.from(exportMatches).map((match) => match[1])

          if (exports.length === 0) {
            console.log('[PLUGIN] No exports found in', id)
            return null
          }

          console.log(
            '[PLUGIN] Transforming .server.ts file:',
            relativePath,
            'with exports:',
            exports
          )

          // Generate client code that calls the server using hash
          let clientCode = `import { callServerAction } from '${virtualRuntimeId}';\n\n`

          for (const exportName of exports) {
            // Generate hash for this action
            const hash = generateActionHash(relativePath, exportName, salt)

            // Register in manifest
            manifest.actions[hash] = {
              filePath: relativePath,
              functionName: exportName,
            }

            console.log(`[PLUGIN] Registered action: ${exportName} → ${hash} (${relativePath})`)

            // Generate client function that uses hash
            clientCode += `export async function ${exportName}(...args) {
  return callServerAction('${hash}', args);
}\n\n`
          }

          console.log('[PLUGIN] Generated client code for', relativePath)

          return {
            code: clientCode,
            map: null,
          }
        }
      }

      return null
    },
  }
}
