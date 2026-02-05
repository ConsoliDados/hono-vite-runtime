import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { compress } from "hono/compress";
import { Hono } from "hono";
import type { ServerConfig } from "../../plugins/web-runtime";

/**
 * Node.js adapter — wraps the pre-built SSR app with compression,
 * static serving, and serves via @hono/node-server.
 */
export async function startServer(config: ServerConfig, app: Hono) {
	const port = config.port ?? 3000;
	const staticDir = config.static ?? "./dist/client";

	const wrapper = new Hono();

	if (config.compress !== false) {
		wrapper.use("*", compress());
	}

	wrapper.use("/static/*", serveStatic({ root: staticDir }));
	wrapper.use("/favicon.ico", serveStatic({ root: staticDir, path: "./favicon.ico" }));

	// Mount the pre-built SSR app
	wrapper.route("/", app);

	console.log(`[web-runtime] Node server listening on http://localhost:${port}`);

	serve({
		fetch: wrapper.fetch,
		port,
	});
}
