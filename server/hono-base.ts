import { Hono } from "hono";
import type { ViteDevServer } from "vite";
import { handleServerAction } from "./actions-handler";
import { loadApiRoutes } from "./api-loader";
import { loadUserMiddleware } from "./middleware/loader";
import { createMatcher, normalizePath } from "./middleware/matcher";

export interface SSROptions {
  isProduction: boolean;
  vite?: ViteDevServer;
  base?: string;
  render?: (request: Request) => Promise<Response>;
  rootDir?: string;
}

export async function createSSRHandler(options: SSROptions) {
  const { isProduction: _isProduction } = options;
  const rootDir = options.rootDir ?? process.cwd();
  const app = new Hono();

  // Block A — Lazy middleware guard
  let middlewareLoaded = false;
  let userMiddleware: Awaited<ReturnType<typeof loadUserMiddleware>> | null = null;

  app.use("*", async (c, next) => {
    if (!middlewareLoaded) {
      console.log("[MIDDLEWARE] Loading user middleware...");
      userMiddleware = await loadUserMiddleware(rootDir);
      middlewareLoaded = true;
      if (userMiddleware) {
        console.log("[MIDDLEWARE] ✓ User middleware loaded and registered");
      } else {
        console.log("[MIDDLEWARE] No user middleware found - skipping");
      }
    }

    if (userMiddleware) {
      const { middleware, config } = userMiddleware;
      const matcher = createMatcher(config?.matcher);
      const path = normalizePath(c.req.path);

      if (matcher(path)) {
        return await middleware(c, next);
      }
    }

    await next();
  });

  // Block B — Dynamic API routes
  await loadApiRoutes(app, rootDir);

  // Block C — Server actions
  console.log("[HONO-BASE] Registering /__server-actions endpoint");
  app.post("/__server-actions", (c) => handleServerAction(c, rootDir));

  // Block D — SSR catch-all via render delegate
  // `render` must always be supplied by the caller.
  // Dev: entry-server.tsx passes it directly.
  // Production: the app's server entry (e.g. apps/web/server.ts) imports the
  // built bundle and passes render before calling startServer / createSSRHandler.
  const renderFn = options.render;

  if (!renderFn) {
    throw new Error(
      "[HONO-BASE] No render function provided. Pass options.render from your server entry point."
    );
  }

  app.use("*", async (c) => {
    return renderFn(c.req.raw);
  });

  return app;
}
