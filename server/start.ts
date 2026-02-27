import type { Hono } from "hono";
import type { ServerConfig } from "../plugins/web-runtime";
import { detectRuntime } from "./detect-runtime";

/**
 * Auto-detects the runtime and delegates to the matching adapter.
 *
 * `app` is the already-configured Hono SSR handler produced by Vite's SSR
 * bundle (i.e. the default export of entry-server.tsx after build).
 * The adapters wrap it with compression / static / serve — they never call
 * createSSRHandler themselves, because that would pull in virtual modules
 * that only exist inside Vite.
 */
export async function startServer(config: ServerConfig, app: Hono) {
  const detected = detectRuntime();
  const merged: ServerConfig = { ...config, runtime: detected };

  console.log(`[web-runtime] Detected runtime: ${detected}`);

  // Dynamic import — only the selected adapter is loaded at runtime.
  // Bun resolves .ts imports natively; this file is never Vite-bundled.
  const adapter = await import(`./adapters/${detected}.ts`);
  await adapter.startServer(merged, app);
}
