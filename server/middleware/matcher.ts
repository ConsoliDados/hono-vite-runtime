import type { MatcherFunction, MatcherPattern } from './types'

/**
 * Converts a glob pattern to a regular expression
 * Supports Next.js-style patterns:
 * - '/dashboard/:path*' → matches /dashboard/anything
 * - '/api/:id' → matches /api/123
 * - '/((?!api).*)' → matches everything except paths containing 'api'
 */
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except for our pattern markers
  let regexPattern = pattern
    // Escape dots
    .replace(/\./g, '\\.')
    // Escape question marks that aren't part of regex groups
    .replace(/\?(?![^(]*\))/g, '\\?')

  // Convert glob patterns to regex
  regexPattern = regexPattern
    // Convert :param* to match anything (greedy)
    .replace(/:(\w+)\*/g, '.*')
    // Convert :param to match a single segment
    .replace(/:(\w+)/g, '([^/]+)')
    // Convert * to match anything within a segment
    .replace(/(?<!\.)(\*)/g, '[^/]*')

  // Ensure the pattern matches the full path
  if (!regexPattern.startsWith('^')) {
    regexPattern = `^${regexPattern}`
  }
  if (!regexPattern.endsWith('$')) {
    regexPattern = `${regexPattern}$`
  }

  return new RegExp(regexPattern)
}

/**
 * Creates a matcher function from a single pattern
 */
function createSingleMatcher(pattern: MatcherPattern): MatcherFunction {
  if (pattern instanceof RegExp) {
    return (path: string) => pattern.test(path)
  }

  // Handle negation patterns: !(pattern)
  if (pattern.startsWith('!')) {
    const innerPattern = pattern.slice(1)
    const innerMatcher = createSingleMatcher(innerPattern)
    return (path: string) => !innerMatcher(path)
  }

  // Convert glob pattern to regex
  const regex = globToRegex(pattern)
  return (path: string) => regex.test(path)
}

/**
 * Creates a matcher function from one or more patterns
 * If multiple patterns are provided, returns true if ANY pattern matches (OR logic)
 */
export function createMatcher(patterns?: MatcherPattern | MatcherPattern[]): MatcherFunction {
  // No patterns = match everything
  if (!patterns) {
    return () => true
  }

  // Single pattern
  if (!Array.isArray(patterns)) {
    return createSingleMatcher(patterns)
  }

  // Multiple patterns - match if ANY pattern matches
  const matchers = patterns.map(createSingleMatcher)
  return (path: string) => matchers.some((matcher) => matcher(path))
}

/**
 * Normalizes a request path for matching
 * Removes query strings and trailing slashes
 */
export function normalizePath(path: string): string {
  // Remove query string
  const pathWithoutQuery = path.split('?')[0]

  // Remove trailing slash (except for root path)
  if (pathWithoutQuery !== '/' && pathWithoutQuery.endsWith('/')) {
    return pathWithoutQuery.slice(0, -1)
  }

  return pathWithoutQuery
}
