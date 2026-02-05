# Middleware System

Complete documentation for the custom middleware system in this application.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Pattern Matching](#pattern-matching)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Integration](#integration)
- [Best Practices](#best-practices)

## Overview

This application implements a **Next.js-style middleware system** for the Hono SSR pipeline. Middleware allows you to intercept requests before they reach route handlers, enabling use cases like:

- **Authentication guards** - Protect routes from unauthorized access
- **Authorization** - Role-based access control
- **Request logging** - Track requests and performance
- **Custom headers** - Add CORS, security headers, etc.
- **Rate limiting** - Prevent abuse
- **A/B testing** - Conditional rendering based on cookies/headers

### Key Features

- **File-based** - Simply create `src/middleware.ts`
- **Flexible matching** - Glob patterns, regex, or arrays of patterns
- **Lazy loading** - Middleware loads only when needed for optimal performance
- **Type-safe** - Full TypeScript support with Hono context
- **Framework-agnostic** - Works with any Hono-based SSR setup

## Quick Start

### 1. Create Middleware File

Create `apps/web/src/middleware.ts`:

```typescript
import { getCookie } from "hono/cookie";
import type { MiddlewareConfig, MiddlewareHandler } from "../server/middleware/types";

export const config: MiddlewareConfig = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};

export const middleware: MiddlewareHandler = async (c, next) => {
  const authSession = getCookie(c, "auth-session");

  if (!authSession) {
    return c.redirect("/");
  }

  await next();
};
```

### 2. Test It

1. Start the dev server: `bun dev`
2. Navigate to `/dashboard` without auth → Redirects to `/`
3. Set an auth cookie → Access granted

That's it! The middleware is automatically loaded and applied.

## Architecture

### How It Works

The middleware system consists of three main components:

1. **Loader** (`loader.ts`) - Discovers and imports user middleware
2. **Matcher** (`matcher.ts`) - Converts patterns to route matchers
3. **Integration** (`entry-server.tsx`) - Applies middleware to Hono app

### File Discovery

The loader checks for middleware in the following locations (in order):

1. `src/middleware.ts` ← **Recommended**
2. `src/middleware/index.ts`

### Loading Strategy

Middleware is **lazily loaded** on the first request:

```typescript
// entry-server.tsx (simplified)
let middlewareLoaded = false;
let userMiddleware = null;

app.use("*", async (c, next) => {
  if (!middlewareLoaded) {
    userMiddleware = await loadUserMiddleware();
    middlewareLoaded = true;
  }

  if (userMiddleware) {
    const matcher = createMatcher(config?.matcher);
    if (matcher(c.req.path)) {
      return await middleware(c, next);
    }
  }

  await next();
});
```

**Why lazy loading?**
- Faster initial server startup
- Middleware file is optional
- Only loaded if it exists

### Pattern Matching Flow

```
1. Request arrives (e.g., /dashboard/settings)
   ↓
2. Normalize path (remove query, trailing slash)
   ↓
3. Convert matcher pattern to regex
   "/dashboard/:path*" → /^\/dashboard\/.*$/
   ↓
4. Test normalized path against regex
   /^\/dashboard\/.*$/.test("/dashboard/settings") → true
   ↓
5. Execute middleware or skip to next handler
```

## Configuration

### MiddlewareConfig Interface

```typescript
interface MiddlewareConfig {
  matcher?: MatcherPattern | MatcherPattern[];
}

type MatcherPattern = string | RegExp;
```

### Matcher Property

The `matcher` property defines which routes the middleware should run on.

**If omitted:** Middleware runs on **all routes**

```typescript
// No config = runs on all routes
export const middleware: MiddlewareHandler = async (c, next) => {
  console.log("Runs on every request");
  await next();
};
```

**Single pattern:**

```typescript
export const config: MiddlewareConfig = {
  matcher: "/dashboard",
};
```

**Multiple patterns:**

```typescript
export const config: MiddlewareConfig = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/api/admin/:path*"],
};
```

**Logic:** If **any** pattern matches, the middleware runs (OR logic).

### MiddlewareHandler Type

```typescript
type MiddlewareHandler = (c: Context, next: Next) => Promise<Response | void>;
```

**Parameters:**
- `c` - Hono context (request, response, cookies, headers, etc.)
- `next` - Function to call the next handler in the chain

**Return:**
- `Response` - Short-circuit and return immediately
- `void` - Continue to next handler (must call `await next()`)

## Pattern Matching

The matcher system supports multiple pattern types.

### Simple Paths

Match exact routes:

```typescript
matcher: "/dashboard"
```

**Matches:**
- `/dashboard` ✅

**Does NOT match:**
- `/dashboard/settings` ❌
- `/dashboards` ❌
- `/dashboard/` (trailing slash) ❌

### Wildcard Segments

Match dynamic segments with `:param*`:

```typescript
matcher: "/dashboard/:path*"
```

**Matches:**
- `/dashboard/settings` ✅
- `/dashboard/settings/profile` ✅
- `/dashboard/a/b/c/d` ✅

**Does NOT match:**
- `/dashboard` ❌ (use array for both)

**Match both root and children:**

```typescript
matcher: ["/dashboard", "/dashboard/:path*"]
```

### Parameter Matching

Match single segments with `:param`:

```typescript
matcher: "/users/:id"
```

**Matches:**
- `/users/123` ✅
- `/users/abc` ✅

**Does NOT match:**
- `/users/123/posts` ❌ (too many segments)
- `/users` ❌ (missing segment)

**Combined example:**

```typescript
matcher: "/users/:id/posts/:postId"
// Matches: /users/123/posts/456
```

### Multiple Patterns

Use an array to match multiple routes:

```typescript
matcher: [
  "/dashboard/:path*",
  "/profile/:path*",
  "/settings/:path*",
]
```

**Logic:** Middleware runs if **ANY** pattern matches.

### Regular Expressions

For advanced patterns, use RegExp:

```typescript
matcher: /^\/api\/(?!public).*/
```

**Matches:**
- `/api/private` ✅
- `/api/admin/users` ✅

**Does NOT match:**
- `/api/public/data` ❌

**Example: Exclude specific paths**

```typescript
matcher: /^(?!.*\.(js|css|png|jpg|svg)$).*/
```

Matches all routes except static assets.

### Negation Patterns

Negate a pattern with `!`:

```typescript
matcher: "!/api/:path*"
```

**Matches:**
- `/dashboard` ✅
- `/home` ✅

**Does NOT match:**
- `/api/users` ❌
- `/api/todos` ❌

**Combine with positive patterns:**

```typescript
matcher: [
  "/:path*",      // All routes
  "!/api/:path*", // Except /api/*
]
```

### Path Normalization

Paths are automatically normalized before matching:

**Query strings removed:**
```
/dashboard?tab=settings → /dashboard
```

**Trailing slashes removed:**
```
/dashboard/ → /dashboard
```

**Exception:** Root path `/` keeps trailing slash.

## API Reference

### Types

#### MiddlewareHandler

```typescript
type MiddlewareHandler = (c: Context, next: Next) => Promise<Response | void>;
```

The main middleware function signature.

**Hono Context (`c`) provides:**
- `c.req.path` - Request path
- `c.req.method` - HTTP method
- `c.req.query(key)` - Query parameters
- `c.req.header(key)` - Request headers
- `c.req.raw` - Raw Request object
- `c.redirect(url)` - Redirect response
- `c.text(text, status)` - Text response
- `c.json(data, status)` - JSON response
- `c.html(html)` - HTML response
- `c.header(key, value)` - Set response header
- `getCookie(c, name)` - Get cookie (from `hono/cookie`)
- `setCookie(c, name, value)` - Set cookie (from `hono/cookie`)

#### MiddlewareConfig

```typescript
interface MiddlewareConfig {
  matcher?: MatcherPattern | MatcherPattern[];
}
```

Configuration object exported alongside middleware.

#### MatcherPattern

```typescript
type MatcherPattern = string | RegExp;
```

A string glob pattern or RegExp for route matching.

#### MatcherFunction

```typescript
type MatcherFunction = (path: string) => boolean;
```

Internal function type returned by `createMatcher()`.

### Functions

#### loadUserMiddleware()

```typescript
async function loadUserMiddleware(): Promise<MiddlewareModule | null>
```

Loads the user's middleware file if it exists.

**Returns:**
- `MiddlewareModule` - If middleware file found
- `null` - If no middleware file exists

**Locations checked:**
1. `src/middleware.ts`
2. `src/middleware/index.ts`

**Used by:** `entry-server.tsx` (internal)

#### createMatcher()

```typescript
function createMatcher(
  patterns?: MatcherPattern | MatcherPattern[]
): MatcherFunction
```

Converts matcher patterns into a function that tests paths.

**Parameters:**
- `patterns` - String, RegExp, array of patterns, or undefined

**Returns:**
- `MatcherFunction` - Function that tests if a path matches

**Behavior:**
- No patterns → Matches all paths
- Single pattern → Matches that pattern
- Array → Matches if ANY pattern matches (OR)

**Used by:** `entry-server.tsx` (internal)

#### normalizePath()

```typescript
function normalizePath(path: string): string
```

Normalizes a request path for consistent matching.

**Transformations:**
- Removes query string
- Removes trailing slash (except for `/`)

**Example:**

```typescript
normalizePath("/dashboard?tab=settings") // → "/dashboard"
normalizePath("/dashboard/")             // → "/dashboard"
normalizePath("/")                       // → "/"
```

## Examples

### Authentication Guard

Protect routes from unauthenticated users:

```typescript
// src/middleware.ts
import { getCookie } from "hono/cookie";
import type { MiddlewareConfig, MiddlewareHandler } from "../server/middleware/types";

export const config: MiddlewareConfig = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
  ],
};

export const middleware: MiddlewareHandler = async (c, next) => {
  const authSession = getCookie(c, "auth-session");

  if (!authSession) {
    console.log(`[Auth] Unauthorized access to ${c.req.path}`);
    return c.redirect("/login");
  }

  console.log(`[Auth] User authenticated for ${c.req.path}`);
  await next();
};
```

### Role-Based Access Control

Check user roles before allowing access:

```typescript
import { getCookie } from "hono/cookie";
import type { MiddlewareConfig, MiddlewareHandler } from "../server/middleware/types";

export const config: MiddlewareConfig = {
  matcher: "/admin/:path*",
};

export const middleware: MiddlewareHandler = async (c, next) => {
  const userRole = getCookie(c, "user-role");

  if (userRole !== "admin") {
    console.log(`[RBAC] Access denied for role: ${userRole}`);
    return c.text("Forbidden", 403);
  }

  console.log("[RBAC] Admin access granted");
  await next();
};
```

### Request Logging

Log all requests with timestamps:

```typescript
import type { MiddlewareHandler } from "../server/middleware/types";

// No config = runs on all routes
export const middleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const { method, path } = c.req;

  console.log(`[${new Date().toISOString()}] → ${method} ${path}`);

  await next();

  const duration = Date.now() - start;
  console.log(`[${new Date().toISOString()}] ← ${method} ${path} (${duration}ms)`);
};
```

### Custom CORS Headers

Add CORS headers to API routes:

```typescript
import type { MiddlewareConfig, MiddlewareHandler } from "../server/middleware/types";

export const config: MiddlewareConfig = {
  matcher: "/api/:path*",
};

export const middleware: MiddlewareHandler = async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (c.req.method === "OPTIONS") {
    return c.text("", 204);
  }

  await next();
};
```

### Rate Limiting

Simple in-memory rate limiter:

```typescript
import type { MiddlewareConfig, MiddlewareHandler } from "../server/middleware/types";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export const config: MiddlewareConfig = {
  matcher: "/api/:path*",
};

export const middleware: MiddlewareHandler = async (c, next) => {
  const ip = c.req.header("x-forwarded-for") || "unknown";
  const now = Date.now();
  const windowMs = 60_000; // 1 minute
  const maxRequests = 100;

  let record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + windowMs };
    requestCounts.set(ip, record);
  }

  record.count++;

  if (record.count > maxRequests) {
    return c.text("Rate limit exceeded", 429);
  }

  await next();
};
```

### A/B Testing

Conditionally modify responses based on cookies:

```typescript
import { getCookie, setCookie } from "hono/cookie";
import type { MiddlewareHandler } from "../server/middleware/types";

export const middleware: MiddlewareHandler = async (c, next) => {
  let variant = getCookie(c, "ab-test-variant");

  if (!variant) {
    // Randomly assign variant A or B
    variant = Math.random() > 0.5 ? "A" : "B";
    setCookie(c, "ab-test-variant", variant, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  console.log(`[A/B Test] User assigned to variant: ${variant}`);

  // Variant can be read by components via cookies
  await next();
};
```

### Maintenance Mode

Block all requests during maintenance:

```typescript
import type { MiddlewareHandler } from "../server/middleware/types";

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";

export const middleware: MiddlewareHandler = async (c, next) => {
  if (MAINTENANCE_MODE && c.req.path !== "/maintenance") {
    return c.redirect("/maintenance");
  }

  await next();
};
```

### Redirect Legacy Routes

Redirect old URLs to new ones:

```typescript
import type { MiddlewareConfig, MiddlewareHandler } from "../server/middleware/types";

const redirects: Record<string, string> = {
  "/old-dashboard": "/dashboard",
  "/settings/profile": "/profile/settings",
};

export const middleware: MiddlewareHandler = async (c, next) => {
  const newPath = redirects[c.req.path];

  if (newPath) {
    console.log(`[Redirect] ${c.req.path} → ${newPath}`);
    return c.redirect(newPath, 301); // Permanent redirect
  }

  await next();
};
```

## Integration

### How Middleware Integrates with Hono

The middleware system is integrated into the Hono SSR pipeline in `apps/web/src/entry-server.tsx`:

```typescript
// entry-server.tsx (simplified)
import { Hono } from "hono";
import { loadUserMiddleware } from "../server/middleware/loader";
import { createMatcher, normalizePath } from "../server/middleware/matcher";

const app = new Hono();

let middlewareLoaded = false;
let userMiddleware = null;

// Middleware integration
app.use("*", async (c, next) => {
  // Lazy load on first request
  if (!middlewareLoaded) {
    userMiddleware = await loadUserMiddleware();
    middlewareLoaded = true;
  }

  // Execute if path matches
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

// API routes registered here
// ...

// SSR handler registered here
// ...
```

### Execution Order

1. **Middleware** (if path matches)
2. **API routes** (`/api/*`)
3. **Server actions** (`/__server-actions`)
4. **SSR handler** (TanStack Router)

### Important Notes

- Middleware runs **before** all other handlers
- If middleware returns a `Response`, the chain stops
- If middleware calls `await next()`, execution continues
- Middleware can modify request/response headers before SSR

## Best Practices

### 1. Use Specific Matchers

**❌ Bad:**
```typescript
// Runs on EVERY request (including static assets)
export const middleware: MiddlewareHandler = async (c, next) => {
  await checkAuth(c);
  await next();
};
```

**✅ Good:**
```typescript
export const config: MiddlewareConfig = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
};

export const middleware: MiddlewareHandler = async (c, next) => {
  await checkAuth(c);
  await next();
};
```

### 2. Keep Middleware Fast

Middleware runs on every matching request. Avoid slow operations:

**❌ Bad:**
```typescript
export const middleware: MiddlewareHandler = async (c, next) => {
  // Slow database query on every request
  const user = await db.users.findBySession(getSession(c));
  // ...
};
```

**✅ Good:**
```typescript
export const middleware: MiddlewareHandler = async (c, next) => {
  // Fast cookie check
  const session = getCookie(c, "auth-session");
  if (!session) return c.redirect("/login");
  await next();
};
```

### 3. Always Call `await next()`

If you don't return a `Response`, you **must** call `await next()`:

**❌ Bad:**
```typescript
export const middleware: MiddlewareHandler = async (c, next) => {
  console.log("Request received");
  // Missing await next() → Request hangs!
};
```

**✅ Good:**
```typescript
export const middleware: MiddlewareHandler = async (c, next) => {
  console.log("Request received");
  await next(); // Continue to next handler
};
```

### 4. Use Descriptive Logging

Help with debugging by logging middleware decisions:

```typescript
export const middleware: MiddlewareHandler = async (c, next) => {
  const session = getCookie(c, "auth-session");

  if (!session) {
    console.log(`[Auth] Blocked unauthenticated access to ${c.req.path}`);
    return c.redirect("/login");
  }

  console.log(`[Auth] Allowed authenticated access to ${c.req.path}`);
  await next();
};
```

### 5. Organize Complex Middleware

For complex logic, extract helper functions:

```typescript
import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { MiddlewareHandler } from "../server/middleware/types";

// Helper function
async function validateAuth(c: Context): Promise<boolean> {
  const session = getCookie(c, "auth-session");
  if (!session) return false;

  // Additional validation logic
  // ...

  return true;
}

export const middleware: MiddlewareHandler = async (c, next) => {
  if (!(await validateAuth(c))) {
    return c.redirect("/login");
  }

  await next();
};
```

### 6. Avoid Modifying Global State

Middleware should be stateless when possible:

**❌ Bad:**
```typescript
let requestCount = 0; // Global state

export const middleware: MiddlewareHandler = async (c, next) => {
  requestCount++; // Not safe in multi-instance deployments
  await next();
};
```

**✅ Good:**
```typescript
export const middleware: MiddlewareHandler = async (c, next) => {
  // Use external store (Redis, database, etc.)
  await incrementRequestCount(c.req.path);
  await next();
};
```

### 7. Test Middleware Independently

Create test files to verify middleware behavior:

```typescript
// middleware.test.ts
import { Hono } from "hono";
import { middleware, config } from "./middleware";

const app = new Hono();
app.use("*", middleware);

// Test unauthorized access
const res1 = await app.request("/dashboard");
assert(res1.status === 302); // Redirect
assert(res1.headers.get("location") === "/");

// Test authorized access
const res2 = await app.request("/dashboard", {
  headers: { Cookie: "auth-session=valid-token" },
});
assert(res2.status === 200);
```

---

## Questions?

For more information about the overall architecture, see:
- [Root README.md](../../../../README.md) - Project overview
- [apps/web/README.md](../../README.md) - Web app documentation
- [CLAUDE.md](../../../../CLAUDE.md) - Development guidelines

**Source code:**
- [server/middleware/loader.ts](../loader.ts) - Middleware loader
- [server/middleware/matcher.ts](../matcher.ts) - Pattern matching
- [server/middleware/types.ts](../types.ts) - TypeScript types
- [src/entry-server.tsx](../../../src/entry-server.tsx) - Integration point
