/**
 * File-Based Routing Plugin - Scanner Module
 * Recursively scans pages/ directory and builds file list
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  dirName: string;
}

interface ScanOptions {
  debug?: boolean;
}

/**
 * Check if path should be ignored
 */
function shouldIgnore(pathSegment: string): boolean {
  // Ignore folders/files starting with _
  if (pathSegment.startsWith("_")) return true;

  // Ignore node_modules
  if (pathSegment === "node_modules") return true;

  // Ignore .git, .DS_Store, etc.
  if (pathSegment.startsWith(".")) return true;

  return false;
}

/**
 * Check if file is a server action (should be ignored)
 */
function isServerAction(fileName: string): boolean {
  return fileName.endsWith(".server.ts") || fileName.endsWith(".server.tsx");
}

/**
 * Check if file is a valid route file
 */
function isRouteFile(fileName: string): boolean {
  // Only .tsx files
  if (!fileName.endsWith(".tsx")) return false;

  // Ignore server actions
  if (isServerAction(fileName)) return false;

  return true;
}

/**
 * Recursively scan directory for route files
 */
export function scanDirectory(
  dir: string,
  baseDir: string,
  options: ScanOptions = {}
): ScannedFile[] {
  const files: ScannedFile[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const absolutePath = join(dir, entry);
      const stat = statSync(absolutePath);

      // Check if should ignore
      if (shouldIgnore(entry)) {
        if (options.debug) {
          console.log(`[scanner] Ignoring: ${entry}`);
        }
        continue;
      }

      if (stat.isDirectory()) {
        // Recursively scan subdirectory
        const subFiles = scanDirectory(absolutePath, baseDir, options);
        files.push(...subFiles);
      } else if (stat.isFile()) {
        // Check if valid route file
        if (isRouteFile(entry)) {
          const relativePath = relative(baseDir, absolutePath);

          files.push({
            absolutePath,
            relativePath,
            fileName: entry,
            dirName: relative(baseDir, dir) || ".",
          });

          if (options.debug) {
            console.log(`[scanner] Found route file: ${relativePath}`);
          }
        } else if (options.debug) {
          console.log(`[scanner] Skipping non-route file: ${entry}`);
        }
      }
    }
  } catch (error) {
    console.error(`[scanner] Error scanning directory ${dir}:`, error);
  }

  return files;
}

/**
 * Parse file path into segments
 */
export function parseFilePath(relativePath: string): {
  segments: string[];
  fileName: string;
  fileType: "page" | "layout" | "error" | "loading" | "not-found";
} {
  // Normalize path separators
  const normalized = relativePath.split(sep).join("/");

  // Split into segments
  const parts = normalized.split("/");
  const fileName = parts[parts.length - 1];
  const segments = parts.slice(0, -1);

  // Determine file type
  let fileType: "page" | "layout" | "error" | "loading" | "not-found" = "page";

  if (fileName === "layout.tsx") {
    fileType = "layout";
  } else if (fileName === "error.tsx") {
    fileType = "error";
  } else if (fileName === "loading.tsx") {
    fileType = "loading";
  } else if (fileName === "page.tsx" || fileName === "index.tsx") {
    fileType = "page";
  } else if (fileName === "not-found.tsx") {
    fileType = "not-found";
  }

  return { segments, fileName, fileType };
}

/**
 * Convert path segment to route segment
 * - [id] -> :id (dynamic)
 * - [...slug] -> * (catch-all)
 * - [[...slug]] -> * (optional catch-all)
 * - (group) -> ignored in path
 */
export function convertSegmentToRoute(segment: string): {
  routeSegment: string;
  isDynamic: boolean;
  isCatchAll: boolean;
  isOptionalCatchAll: boolean;
  isGroup: boolean;
  originalSegment: string;
} {
  const originalSegment = segment;

  // Check for route group (group)
  if (segment.startsWith("(") && segment.endsWith(")")) {
    return {
      routeSegment: "", // Groups don't contribute to path
      isDynamic: false,
      isCatchAll: false,
      isOptionalCatchAll: false,
      isGroup: true,
      originalSegment,
    };
  }

  // Check for optional catch-all [[...slug]]
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    const _param = segment.slice(5, -2);
    return {
      routeSegment: "*", // React Router catch-all
      isDynamic: true,
      isCatchAll: false,
      isOptionalCatchAll: true,
      isGroup: false,
      originalSegment,
    };
  }

  // Check for catch-all [...slug]
  if (segment.startsWith("[...") && segment.endsWith("]")) {
    const _param = segment.slice(4, -1);
    return {
      routeSegment: "*", // React Router catch-all
      isDynamic: true,
      isCatchAll: true,
      isOptionalCatchAll: false,
      isGroup: false,
      originalSegment,
    };
  }

  // Check for dynamic parameter [id]
  if (segment.startsWith("[") && segment.endsWith("]")) {
    const param = segment.slice(1, -1);
    return {
      routeSegment: `:${param}`,
      isDynamic: true,
      isCatchAll: false,
      isOptionalCatchAll: false,
      isGroup: false,
      originalSegment,
    };
  }

  // Regular static segment
  return {
    routeSegment: segment,
    isDynamic: false,
    isCatchAll: false,
    isOptionalCatchAll: false,
    isGroup: false,
    originalSegment,
  };
}
