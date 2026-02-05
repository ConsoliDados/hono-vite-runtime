/**
 * File-Based Routing Plugin for Vite
 * Auto-generates routes.tsx from src/pages/ directory
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'
import { buildRouteTree, generateRoutesFile } from './generator'
import { scanDirectory } from './scanner'
import { generateLoaderTypeStubs, generateTypeDeclarations } from './type-generator'
import type { PluginOptions } from './types.ts'

export default function fileBasedRoutingPlugin(options: PluginOptions = {}): Plugin {
  const {
    pagesDir = 'pages',
    outputFile = 'routes.tsx',
    debug = false,
    typeGeneration = true,
    typesDir = '.react-router/types',
    metadataSupport = true,
    codeSplitting = true,
  } = options

  let srcDir: string
  let pagesPath: string
  let outputPath: string
  let typesPath: string

  /**
   * Generate routes from pages/ directory
   */
  function generateRoutes() {
    if (debug) {
      console.log('[file-based-routing] Scanning pages directory:', pagesPath)
    }

    // Scan directory for route files
    const scannedFiles = scanDirectory(pagesPath, pagesPath, { debug })

    if (debug) {
      console.log(`[file-based-routing] Found ${scannedFiles.length} route files`)
    }

    // Build route tree
    const routeTree = buildRouteTree(scannedFiles, pagesPath)

    // Generate routes.tsx content
    const content = generateRoutesFile(routeTree, pagesDir, codeSplitting)

    // Write routes.tsx
    writeFileSync(outputPath, content, 'utf-8')
    console.log(`[file-based-routing] ✓ Generated ${outputFile}`)

    // Generate TypeScript types if enabled
    if (typeGeneration) {
      const typeContent = generateTypeDeclarations(routeTree) + generateLoaderTypeStubs(routeTree)

      // Ensure directory exists
      mkdirSync(dirname(typesPath), { recursive: true })

      // Write types file
      writeFileSync(typesPath, typeContent, 'utf-8')
      console.log(`[file-based-routing] ✓ Generated types at ${typesDir}/routes.d.ts`)
    }

    if (debug) {
      console.log(`[file-based-routing] Written routes to: ${outputPath}`)
      if (typeGeneration) {
        console.log(`[file-based-routing] Written types to: ${typesPath}`)
      }
    }
  }

  return {
    name: 'file-based-routing',

    /**
     * Configure plugin paths
     */
    configResolved(config) {
      srcDir = join(config.root, 'src')
      pagesPath = join(srcDir, pagesDir)
      outputPath = join(srcDir, outputFile)
      typesPath = join(srcDir, typesDir, 'routes.d.ts')

      if (debug) {
        console.log('[file-based-routing] Config resolved:')
        console.log('  srcDir:', srcDir)
        console.log('  pagesPath:', pagesPath)
        console.log('  outputPath:', outputPath)
        console.log('  typesPath:', typesPath)
      }
    },

    /**
     * Generate routes on build start
     */
    buildStart() {
      console.log('[file-based-routing] Generating routes...')
      try {
        generateRoutes()
      } catch (error) {
        console.error('[file-based-routing] Error generating routes:', error)
        throw error
      }
    },

    /**
     * Watch for changes in dev mode
     */
    configureServer(server) {
      // Watch pages/ directory for changes
      const watcher = server.watcher
      watcher.unwatch(join(srcDir, 'routes.tsx'))

      // watcher.add(pagesPath);
      // watcher.add(join(pagesPath, "/**/*.tsx"));

      watcher.on('change', (file) => {
        if (file.startsWith(pagesPath) && file.endsWith('.tsx')) {
          if (debug) {
            console.log('[file-based-routing] File changed:', file)
          }

          console.log('[file-based-routing] Regenerating routes...')
          try {
            generateRoutes()

            // Trigger HMR for routes.tsx
            const routesModule = server.moduleGraph.getModuleById(outputPath)
            if (routesModule) {
              server.moduleGraph.invalidateModule(routesModule)
            }

            server.ws.send({
              type: 'full-reload',
              path: '*',
            })
          } catch (error) {
            console.error('[file-based-routing] Error regenerating routes:', error)
          }
        }
      })

      watcher.on('add', (file) => {
        if (file.startsWith(pagesPath) && file.endsWith('.tsx')) {
          if (debug) {
            console.log('[file-based-routing] File added:', file)
          }

          console.log('[file-based-routing] Regenerating routes...')
          try {
            generateRoutes()
            server.ws.send({
              type: 'full-reload',
              path: '*',
            })
          } catch (error) {
            console.error('[file-based-routing] Error regenerating routes:', error)
          }
        }
      })

      watcher.on('unlink', (file) => {
        if (file.startsWith(pagesPath) && file.endsWith('.tsx')) {
          if (debug) {
            console.log('[file-based-routing] File removed:', file)
          }

          console.log('[file-based-routing] Regenerating routes...')
          try {
            generateRoutes()
            server.ws.send({
              type: 'full-reload',
              path: '*',
            })
          } catch (error) {
            console.error('[file-based-routing] Error regenerating routes:', error)
          }
        }
      })
    },
  }
}
