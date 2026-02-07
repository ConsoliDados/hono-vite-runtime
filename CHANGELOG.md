# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-02-05

### Fixed
- **file-based-routing:** Fixed nested layout bug where route groups with layouts were not properly nesting
  - Route groups like `(home)/layout.tsx` now correctly nest inside `pages/layout.tsx`
  - Groups with layouts create wrapper routes with `path: ""` (invisible in URLs)
  - Groups without layouts remain transparent (children promoted up)
  - Fixes collision where multiple layouts mapped to same directory key

### Changed
- **generator.ts (lines 43-45):** Include route groups in directory keys to prevent collisions
- **generator.ts (lines 450-504):** Added special handling for route group nodes in `generateRouteObject()`

## [0.1.0] - 2026-01-XX

### Added
- Initial core runtime setup
- File-based routing plugin with TanStack Router integration
- Server actions plugin with hash-based routing
- Hono server integration with SSR support
- Dynamic API route loader
- Multi-platform deployment adapters (Node, Vercel, Netlify, Cloudflare, Docker)
