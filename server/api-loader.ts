import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Hono } from 'hono'

interface ApiModule {
  default: Hono
}

/**
 * Recursively scans a directory for TypeScript files
 */
function scanDirectory(dirPath: string, basePath: string): string[] {
  const files: string[] = []

  try {
    const entries = readdirSync(dirPath)

    for (const entry of entries) {
      const fullPath = join(dirPath, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        files.push(...scanDirectory(fullPath, basePath))
      } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
        // Only include .ts files (not .d.ts declaration files)
        files.push(fullPath)
      }
    }
  } catch (error) {
    console.error(`Failed to scan directory ${dirPath}:`, error)
  }

  return files
}

/**
 * Converts a file path to a route pattern
 * Examples:
 * - todos.ts → /api/todos
 * - users/profile.ts → /api/users/profile
 * - [userId]/posts.ts → /api/:userId/posts
 */
function filePathToRoute(filePath: string, apiDir: string): string {
  // Get relative path from api directory
  const relativePath = relative(apiDir, filePath)

  // Remove .ts extension
  let routePath = relativePath.replace(/\.ts$/, '')

  // Convert backslashes to forward slashes (Windows compatibility)
  routePath = routePath.replace(/\\/g, '/')

  // Handle index files (index.ts becomes the parent route)
  routePath = routePath.replace(/\/index$/, '')

  // Convert [param] to :param for Hono dynamic segments
  routePath = routePath.replace(/\[(\w+)\]/g, ':$1')

  // Prefix with /api/
  return `/api/${routePath}`
}

/**
 * Loads all API routes from the server/api directory and registers them with Hono
 */
export async function loadApiRoutes(app: Hono, rootDir: string): Promise<void> {
  const apiDir = join(rootDir, 'server', 'api')

  console.log(`[API Loader] Scanning ${apiDir} for API routes...`)

  // Scan for all .ts files
  const apiFiles = scanDirectory(apiDir, apiDir)

  if (apiFiles.length === 0) {
    console.warn('[API Loader] No API route files found')
    return
  }

  console.log(`[API Loader] Found ${apiFiles.length} API file(s)`)

  // Load and register each API route
  for (const filePath of apiFiles) {
    try {
      const routePath = filePathToRoute(filePath, apiDir)
      const fileUrl = pathToFileURL(filePath).href

      // Dynamically import the module
      const module = (await import(/* @vite-ignore */ fileUrl)) as ApiModule

      if (!module.default) {
        console.warn(`[API Loader] ${filePath} does not export a default Hono app`)
        continue
      }

      // Register the route
      app.route(routePath, module.default)

      console.log(`[API Loader] ✓ Registered route: ${routePath}`)
    } catch (error) {
      console.error(`[API Loader] Failed to load ${filePath}:`, error)
    }
  }

  console.log('[API Loader] API routes loaded successfully')
}
