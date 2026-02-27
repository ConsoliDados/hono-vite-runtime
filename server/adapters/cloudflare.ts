import type { Hono } from "hono";
import type { ServerConfig } from "../../plugins/web-runtime";

/**
 * Cloudflare Workers adapter — extracts the fetch handler from the pre-built SSR app.
 * `compress`, `static`, and `port` are all ignored (CF handles them).
 */
export async function createFetchHandler(app: Hono) {
  return app.fetch;
}

export async function startServer(_config: ServerConfig, _app: Hono) {
  console.warn(
    "[web-runtime] Cloudflare adapter: startServer is a no-op. Use createFetchHandler() instead."
  );
}
