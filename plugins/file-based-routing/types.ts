/**
 * File-Based Routing Plugin - Type Definitions
 */

export interface PluginOptions {
  /** Directory to scan for routes (relative to src/) */
  pagesDir?: string
  /** Output file path (relative to src/) */
  outputFile?: string
  /** Enable debug logging */
  debug?: boolean
  /** Enable code splitting with React.lazy() (default: true) */
  codeSplitting?: boolean
  /** Enable TypeScript type generation (default: true) */
  typeGeneration?: boolean
  /** Directory for generated types (default: '.react-router/types') */
  typesDir?: string
  /** Enable route metadata support (default: true) */
  metadataSupport?: boolean
}

export interface RouteFile {
  /** Absolute file path */
  absolutePath: string
  /** Relative path from pages/ directory */
  relativePath: string
  /** File type */
  type: 'page' | 'layout' | 'error' | 'loading' | 'not-found'
  /** Whether file has default export (component) */
  hasDefaultExport: boolean
  /** Whether file has loader export */
  hasLoader: boolean
  /** Whether file has action export */
  hasAction: boolean
  /** Whether file has meta export (Phase 2) */
  hasMeta: boolean
  /** Generated component name */
  componentName: string
  /** Generated loader name */
  loaderName?: string
  /** Generated action name */
  actionName?: string
  /** Generated meta name (Phase 2) */
  metaName?: string
}

export interface RouteNode {
  /** Route path segment (e.g., "users", ":id", "*") */
  path: string
  /** Full route path from root */
  fullPath: string
  /** Original file system path segment (before conversion) */
  originalSegment: string
  /** Whether this is a dynamic parameter ([id]) */
  isDynamic: boolean
  /** Whether this is a catch-all route ([...slug]) */
  isCatchAll: boolean
  /** Whether this is optional catch-all ([[...slug]]) */
  isOptionalCatchAll: boolean
  /** Whether this is a route group ((group)) */
  isGroup: boolean
  /** Layout file for this route (if exists) */
  layout?: RouteFile
  /** Page file for this route (if exists) */
  page?: RouteFile
  /** Error boundary file (Phase 3) */
  error?: RouteFile
  /** Loading fallback file (Phase 3) */
  loading?: RouteFile
  /** Not FOund fallback file (Phase 3) */
  notFound?: RouteFile
  /** Child routes */
  children: RouteNode[]
  /** Parent route */
  parent?: RouteNode
}

export interface GeneratedRoute {
  /** Import statements */
  imports: string[]
  /** Route object definition */
  routeObject: string
}
