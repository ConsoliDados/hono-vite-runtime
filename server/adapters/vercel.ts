import { handle } from "@hono/node-server/vercel";
import type { Hono } from "hono";
import type { ServerConfig } from "../../plugins/web-runtime";

/**
 * Vercel adapter — wraps the pre-built SSR app for Vercel's serverless handler.
 * `compress` and `static` are ignored (Vercel handles both).
 */
export async function createHandler(app: Hono) {
	return handle(app);
}

// Standalone startServer is a no-op on Vercel: the platform invokes the handler directly.
export async function startServer(_config: ServerConfig, _app: Hono) {
	console.warn("[web-runtime] Vercel adapter: startServer is a no-op. Use createHandler() instead.");
}
