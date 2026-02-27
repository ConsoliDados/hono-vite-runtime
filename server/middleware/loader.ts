import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { MiddlewareModule } from "./types";

/**
 * Possible locations for user middleware
 * Priority order: src/middleware.ts > src/middleware/index.ts
 */
const MIDDLEWARE_PATHS = ["src/middleware.ts", "src/middleware/index.ts"] as const;

/**
 * Loads user-defined middleware if it exists
 * Returns null if no middleware is found
 */
export async function loadUserMiddleware(rootDir: string): Promise<MiddlewareModule | null> {
  // Check each possible middleware location
  for (const middlewarePath of MIDDLEWARE_PATHS) {
    const fullPath = resolve(rootDir, middlewarePath);

    if (!existsSync(fullPath)) {
      continue;
    }

    try {
      // Convert to file URL for dynamic import
      const fileUrl = pathToFileURL(fullPath).href;

      // Dynamically import the middleware module
      const module = (await import(/* @vite-ignore */ fileUrl)) as Partial<MiddlewareModule>;

      // Validate that the module exports a middleware function
      if (typeof module.middleware !== "function") {
        console.warn(
          `[MIDDLEWARE] ${middlewarePath} does not export a 'middleware' function. Skipping.`
        );
        continue;
      }

      // Log matcher config if present
      if (module.config?.matcher) {
        const matchers = Array.isArray(module.config.matcher)
          ? module.config.matcher
          : [module.config.matcher];
        console.log(`[MIDDLEWARE] Protecting routes: ${JSON.stringify(matchers)}`);
      } else {
        console.log("[MIDDLEWARE] Running on all routes (no matcher config)");
      }

      return module as MiddlewareModule;
    } catch (error) {
      console.error(`[MIDDLEWARE] Failed to load middleware from ${middlewarePath}:`, error);
      // Continue to next path instead of throwing
    }
  }

  return null;
}

/**
 * Clears the middleware module cache
 * Useful for development hot-reload
 */
export function clearMiddlewareCache(): void {
  // Note: In Node.js/Bun, module cache is managed by the runtime
  // This is a placeholder for potential future HMR support
  console.log("[MIDDLEWARE] Cache cleared");
}
