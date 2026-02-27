/**
 * File-Based Routing Plugin - Parser Module
 * Detects exports in route files (default export, loader, action)
 */

import { readFileSync } from "node:fs";

export interface ParsedExports {
  hasDefaultExport: boolean;
  hasLoader: boolean;
  hasAction: boolean;
  hasMeta: boolean;
  defaultExportName?: string;
  warnings?: string[];
}

/**
 * Convert a string to PascalCase, handling special characters
 * Examples:
 *   "ssr-example" -> "SsrExample"
 *   "user_profile" -> "UserProfile"
 *   "api-v2-docs" -> "ApiV2Docs"
 */
function toPascalCase(str: string): string {
  return (
    str
      // Split by - or _ or space
      .split(/[-_\s]+/)
      // Capitalize first letter of each word
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      // Join together
      .join("")
  );
}

/**
 * Parse file content and detect exports
 * Uses regex for speed (can upgrade to AST parser if needed)
 */
export function parseFile(filePath: string): ParsedExports {
  try {
    const content = readFileSync(filePath, "utf-8");
    const warnings: string[] = [];

    // Detect default export
    const hasDefaultExport =
      /export\s+default\s+/.test(content) || /export\s*\{\s*\w+\s+as\s+default\s*\}/.test(content);

    // Try to extract default export name (for better error messages)
    let defaultExportName: string | undefined;
    const defaultMatch = content.match(/export\s+default\s+(?:function|class|const)?\s*(\w+)/);
    if (defaultMatch) {
      defaultExportName = defaultMatch[1];
    }

    // Detect loader export
    // Matches: export async function loader, export function loader
    const hasLoader =
      /export\s+async\s+function\s+loader\s*\(/.test(content) ||
      /export\s+function\s+loader\s*\(/.test(content);

    // Detect action export (Phase 3)
    const hasAction =
      /export\s+async\s+function\s+action\s*\(/.test(content) ||
      /export\s+function\s+action\s*\(/.test(content);

    // Detect meta export (Phase 2)
    // Matches: export const meta = {...}
    const hasMeta = /export\s+const\s+meta\s*=/.test(content);

    // Validation: Warn if no default export (for page/layout/error/loading files)
    if (!hasDefaultExport && !filePath.includes("_")) {
      // Ignore files in excluded folders
      const fileName = filePath.split("/").pop() || "";
      if (
        fileName === "page.tsx" ||
        fileName === "index.tsx" ||
        fileName === "layout.tsx" ||
        fileName === "error.tsx" ||
        fileName === "loading.tsx" ||
        fileName === "not-found.tsx" ||
        fileName.endsWith(".tsx")
      ) {
        warnings.push(
          `Missing default export in ${filePath}. Route files must export a default component.`
        );
      }
    }

    return {
      hasDefaultExport,
      hasLoader,
      hasAction,
      hasMeta,
      defaultExportName,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error(`[parser] Error parsing file ${filePath}:`, error);
    return {
      hasDefaultExport: false,
      hasLoader: false,
      hasAction: false,
      hasMeta: false,
      warnings: [`Failed to parse file: ${error}`],
    };
  }
}

/**
 * Generate component name from file path
 * Examples:
 *   users/index.tsx -> UsersPage
 *   users/[id]/edit.tsx -> UsersIdEditPage
 *   dashboard/(settings)/profile.tsx -> DashboardProfilePage
 */
export function generateComponentName(segments: string[], fileName: string): string {
  // Build path from segments + fileName (without extension)
  const fileNameWithoutExt = fileName.replace(/\.tsx$/, "");

  // Remove "page" or "index" from fileName
  const cleanFileName =
    fileNameWithoutExt === "page" || fileNameWithoutExt === "index" ? "" : fileNameWithoutExt;

  // Combine segments with fileName
  const allParts = [...segments, cleanFileName].filter(Boolean);

  // Convert to PascalCase
  const pascalParts = allParts.map((part) => {
    // Remove route group parentheses: (settings) -> settings
    const cleaned = part.replace(/^\((.+)\)$/, "$1");

    // Replace [id] with Id, [...slug] with Slug, [[...slug]] with Slug
    const withoutBrackets = cleaned
      .replace(/^\[\.\.\.(.+)\]$/, "$1") // [...slug] -> slug
      .replace(/^\[\[\.\.\.(.+)\]\]$/, "$1") // [[...slug]] -> slug
      .replace(/^\[(.+)\]$/, "$1"); // [id] -> id

    // Convert to PascalCase (handles -, _, etc.)
    return toPascalCase(withoutBrackets);
  });

  // Special case: if no parts (root page.tsx or index.tsx), use "Home"
  if (pascalParts.length === 0) {
    return "HomePage";
  }

  // Join and append "Page"
  return `${pascalParts.join("")}Page`;
}

/**
 * Generate loader name from component name
 * UsersIdEditPage -> usersIdEditLoader
 */
export function generateLoaderName(componentName: string): string {
  // Remove "Page" suffix and make first letter lowercase
  const withoutPage = componentName.replace(/Page$/, "");
  return `${withoutPage.charAt(0).toLowerCase() + withoutPage.slice(1)}Loader`;
}

/**
 * Generate action name from component name
 * UsersIdEditPage -> usersIdEditAction
 */
export function generateActionName(componentName: string): string {
  // Remove "Page" suffix and make first letter lowercase
  const withoutPage = componentName.replace(/Page$/, "");
  return `${withoutPage.charAt(0).toLowerCase() + withoutPage.slice(1)}Action`;
}

/**
 * Generate layout component name from path segments
 * users/ -> UsersLayout
 * dashboard/(settings)/ -> DashboardLayout (group ignored in name)
 */
export function generateLayoutName(segments: string[]): string {
  const pascalParts = segments.map((part) => {
    // Remove route group parentheses
    const cleaned = part.replace(/^\((.+)\)$/, "$1");

    // Replace dynamic segments
    const withoutBrackets = cleaned
      .replace(/^\[\.\.\.(.+)\]$/, "$1")
      .replace(/^\[\[\.\.\.(.+)\]\]$/, "$1")
      .replace(/^\[(.+)\]$/, "$1");

    // Convert to PascalCase (handles -, _, etc.)
    return toPascalCase(withoutBrackets);
  });

  return `${pascalParts.join("")}Layout`;
}

/**
 * Generate meta name from component name
 * UsersIdEditPage -> usersIdEditMeta
 */
export function generateMetaName(componentName: string): string {
  // Remove "Page" suffix and make first letter lowercase
  const withoutPage = componentName.replace(/Page$/, "");
  return `${withoutPage.charAt(0).toLowerCase() + withoutPage.slice(1)}Meta`;
}
