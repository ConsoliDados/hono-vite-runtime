import type { Hono } from "hono";
import type { ServerConfig } from "../../plugins/web-runtime";

/**
 * Netlify Functions adapter — converts Netlify's event/context into a
 * standard Request, delegates to the pre-built SSR app, converts the
 * Response back to Netlify's expected shape.
 */
export async function createHandler(app: Hono) {
	// biome-ignore lint/suspicious/noExplicitAny: Netlify event shape
	return async function handler(event: any, _context: any) {
		const url = new URL(event.path, `https://${event.headers.host}`);
		const request = new Request(url.toString(), {
			method: event.httpMethod,
			headers: event.headers,
			body: event.body ? event.body : undefined,
		});

		const response = await app.fetch(request);

		const body = await response.text();
		const headers: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			headers[key] = value;
		});

		return { statusCode: response.status, headers, body };
	};
}

export async function startServer(_config: ServerConfig, _app: Hono) {
	console.warn("[web-runtime] Netlify adapter: startServer is a no-op. Use createHandler() instead.");
}
