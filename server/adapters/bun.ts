import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compress } from "hono/compress";
import { Hono } from "hono";
import type { ServerConfig } from "../../plugins/web-runtime";

// MIME type map for static assets
const MIME_TYPES: Record<string, string> = {
	".js": "application/javascript",
	".css": "text/css",
	".ico": "image/x-icon",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".json": "application/json",
	".map": "application/json",
};

function getMimeType(path: string): string {
	const ext = path.substring(path.lastIndexOf("."));
	return MIME_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Bun adapter — wraps the pre-built SSR app with compression and static
 * file serving, then starts via Bun.serve().
 *
 * `app` is the Hono instance already exported by the Vite SSR bundle.
 * This adapter does NOT call createSSRHandler — that would pull in
 * virtual:server-actions-manifest which only exists inside Vite.
 */
export async function startServer(config: ServerConfig, app: Hono) {
	const port = config.port ?? 3000;
	const staticDir = config.static ?? "./dist/client";

	const wrapper = new Hono();

	if (config.compress !== false) {
		wrapper.use("*", compress());
	}

	// Static assets — served via Bun's fs (no node-server dependency)
	wrapper.use("/static/*", async (c) => {
		const filePath = resolve(staticDir, c.req.path.replace(/^\/static\//, ""));
		if (existsSync(filePath)) {
			const content = readFileSync(filePath);
			return c.body(content, 200, { "content-type": getMimeType(filePath) });
		}
		return c.notFound();
	});

	wrapper.use("/favicon.ico", async (c) => {
		const filePath = resolve(staticDir, "favicon.ico");
		if (existsSync(filePath)) {
			const content = readFileSync(filePath);
			return c.body(content, 200, { "content-type": "image/x-icon" });
		}
		return c.notFound();
	});

	// Mount the SSR app — handles everything else (API routes, server actions, SSR catch-all)
	wrapper.route("/", app);

	console.log(`[web-runtime] Bun server listening on http://localhost:${port}`);

	Bun.serve({
		fetch: wrapper.fetch,
		port,
	});
}
