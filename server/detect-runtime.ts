export type RuntimeName = "bun" | "node" | "vercel" | "cloudflare" | "netlify";

/**
 * Detects the current runtime environment.
 * Priority: Vercel/Netlify env flags → Cloudflare (no process) → Bun global → Node fallback.
 */
export function detectRuntime(): RuntimeName {
	if (typeof process !== "undefined" && process.env?.VERCEL) return "vercel";
	if (typeof process !== "undefined" && process.env?.NETLIFY) return "netlify";
	if (typeof globalThis.addEventListener === "function" && typeof process === "undefined")
		return "cloudflare";
	if (typeof Bun !== "undefined") return "bun";
	return "node";
}
