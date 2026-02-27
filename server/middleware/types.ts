import type { Context, Next } from "hono";

/**
 * Middleware handler function signature
 * Receives Hono context and next function
 */

// biome-ignore lint/suspicious/noConfusingVoidType: need to be void
export type MiddlewareHandler = (c: Context, next: Next) => Promise<Response | void>;

/**
 * Matcher pattern types
 * - string: glob pattern like '/dashboard/:path*' or regex
 * - RegExp: regular expression for advanced matching
 */
export type MatcherPattern = string | RegExp;

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /**
   * Route patterns to match
   * Can be a single pattern or array of patterns
   *
   * Examples:
   * - '/dashboard/:path*' - All routes under /dashboard
   * - '/api/admin/:path*' - All admin API routes
   * - '/((?!api|_next|static).*)' - All routes except api, _next, static
   * - ['/dashboard/:path*', '/profile/:path*'] - Multiple patterns
   */
  matcher?: MatcherPattern | MatcherPattern[];
}

/**
 * User middleware module structure
 */
export interface MiddlewareModule {
  middleware: MiddlewareHandler;
  config?: MiddlewareConfig;
}

/**
 * Route matcher function
 * Returns true if the path matches the pattern
 */
export type MatcherFunction = (path: string) => boolean;
