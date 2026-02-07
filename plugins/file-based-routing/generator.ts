/**
 * File-Based Routing Plugin - Generator Module
 * Generates routes.tsx content from route tree
 */

import {
  generateActionName,
  generateComponentName,
  generateLayoutName,
  generateLoaderName,
  generateMetaName,
  parseFile,
} from './parser'
import { type ScannedFile, convertSegmentToRoute, parseFilePath } from './scanner'
import type { RouteFile, RouteNode } from './types.ts'

function generateMetaHandler(metaName: string) {
  return `handle: { meta: ({ data, params }: any) => createMeta(${metaName}, { data, params }) }`
}

/**
 * Build route tree from scanned files
 */
export function buildRouteTree(files: ScannedFile[], _baseDir: string): RouteNode {
  // Create root node
  const root: RouteNode = {
    path: '/',
    fullPath: '/',
    originalSegment: '',
    isDynamic: false,
    isCatchAll: false,
    isOptionalCatchAll: false,
    isGroup: false,
    children: [],
  }

  // Group files by directory
  const filesByDir = new Map<string, ScannedFile[]>()

  for (const file of files) {
    const { segments, fileName: _fileName, fileType: _fileType } = parseFilePath(file.relativePath)

    // Use segments directly (including route groups) for directory key
    // This allows (home)/layout.tsx and layout.tsx to be separate entries
    const dirKey = segments.length === 0 ? '.' : segments.join('/')

    if (!filesByDir.has(dirKey)) {
      filesByDir.set(dirKey, [])
    }
    filesByDir.get(dirKey)?.push(file)
  }

  // Build tree structure
  for (const [dirPath, dirFiles] of filesByDir.entries()) {
    // Skip root-level files - they're handled specially below
    if (dirPath === '.') {
      continue
    }

    const segments = dirPath.split('/')

    // Find or create node for this path
    let currentNode = root

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const routeInfo = convertSegmentToRoute(segment)
      const pathSoFar = segments.slice(0, i + 1)

      // Find existing child or create new one
      let childNode = currentNode.children.find((child) => child.originalSegment === segment)

      if (!childNode) {
        const fullPath = buildFullPath(pathSoFar)

        childNode = {
          path: routeInfo.routeSegment,
          fullPath,
          originalSegment: segment,
          isDynamic: routeInfo.isDynamic,
          isCatchAll: routeInfo.isCatchAll,
          isOptionalCatchAll: routeInfo.isOptionalCatchAll,
          isGroup: routeInfo.isGroup,
          children: [],
          parent: currentNode,
        }

        currentNode.children.push(childNode)
      }

      currentNode = childNode
    }

    // Attach files to this node
    for (const file of dirFiles) {
      const { fileName, fileType } = parseFilePath(file.relativePath)
      const exports = parseFile(file.absolutePath)

      if (fileType === 'layout') {
        const componentName = generateLayoutName(segments)
        currentNode.layout = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: fileType,
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          componentName,
          loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
          metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
        }
      } else if (fileName === 'page.tsx' || fileName === 'index.tsx') {
        // page.tsx or index.tsx become index routes
        const componentName = generateComponentName(segments, fileName)
        currentNode.page = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: fileType,
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          componentName,
          loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
          actionName: exports.hasAction ? generateActionName(componentName) : undefined,
          metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
        }
      } else if (fileType === 'error') {
        const componentName = generateComponentName(segments, fileName)
        currentNode.error = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: fileType,
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          componentName,
          loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
          metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
        }
      } else if (fileType === 'loading') {
        const componentName = generateComponentName(segments, fileName)
        currentNode.loading = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: fileType,
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          componentName,
          loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
          metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
        }
      } else if (fileType === 'not-found') {
        const componentName = generateComponentName(segments, fileName)
        currentNode.notFound = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: fileType,
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          componentName,
          loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
          metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
        }
      } else {
        // Other files (edit.tsx, about.tsx, etc.) become named child routes
        const routePath = fileName.replace(/\.tsx$/, '')
        const componentName = generateComponentName(segments, fileName)
        const fullPath = buildFullPath([...segments, routePath])

        // Create a child node for this route
        const childNode: RouteNode = {
          path: routePath,
          fullPath,
          originalSegment: routePath,
          isDynamic: false,
          isCatchAll: false,
          isOptionalCatchAll: false,
          isGroup: false,
          children: [],
          parent: currentNode,
          page: {
            absolutePath: file.absolutePath,
            relativePath: file.relativePath,
            type: 'page',
            hasDefaultExport: exports.hasDefaultExport,
            hasLoader: exports.hasLoader,
            hasAction: exports.hasAction,
            hasMeta: exports.hasMeta,
            componentName,
            loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
            actionName: exports.hasAction ? generateActionName(componentName) : undefined,
            metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
          },
        }

        currentNode.children.push(childNode)
      }
    }
  }

  // Handle root-level files specially (pages/layout.tsx, pages/page.tsx, etc.)
  if (filesByDir.has('.')) {
    // biome-ignore lint/style/noNonNullAssertion: It's fine, there are here root files
    const rootFiles = filesByDir.get('.')!
    for (const file of rootFiles) {
      const { fileName, fileType } = parseFilePath(file.relativePath)
      const exports = parseFile(file.absolutePath)

      if (fileType === 'layout') {
        root.layout = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: 'layout',
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          componentName: 'Layout',
          metaName: exports.hasMeta ? generateMetaName('Layout') : undefined,
        }
      } else if (fileName === 'page.tsx' || fileName === 'index.tsx') {
        // page.tsx or index.tsx become the root index route
        const componentName = generateComponentName([], fileName)
        root.page = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: 'page',
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          componentName,
          loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
          actionName: exports.hasAction ? generateActionName(componentName) : undefined,
          metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
        }
      } else if (fileType === 'loading' || fileName === 'loading.tsx') {
        // loading File
        const componentName = generateComponentName([], fileName)
        root.loading = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: 'loading',
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          // componentName: "RootLoading",
          componentName,
          metaName: exports.hasMeta ? generateMetaName('Lloading') : undefined,
        }
      } else if (fileType === 'not-found') {
        const componentName = generateComponentName([], fileName)
        root.notFound = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          type: fileType,
          hasDefaultExport: exports.hasDefaultExport,
          hasLoader: exports.hasLoader,
          hasAction: exports.hasAction,
          hasMeta: exports.hasMeta,
          componentName,
          loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
          metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
        }
      } else {
        // Other files (ssr-example.tsx, about.tsx, etc.) become named child routes
        // Extract filename without extension as the route path
        const routePath = fileName.replace(/\.tsx$/, '')
        const componentName = generateComponentName([], fileName)

        // Create a child node for this route
        const childNode: RouteNode = {
          path: routePath,
          fullPath: `/${routePath}`,
          originalSegment: routePath,
          isDynamic: false,
          isCatchAll: false,
          isOptionalCatchAll: false,
          isGroup: false,
          children: [],
          parent: root,
          page: {
            absolutePath: file.absolutePath,
            relativePath: file.relativePath,
            type: 'page',
            hasDefaultExport: exports.hasDefaultExport,
            hasLoader: exports.hasLoader,
            hasAction: exports.hasAction,
            hasMeta: exports.hasMeta,
            componentName,
            loaderName: exports.hasLoader ? generateLoaderName(componentName) : undefined,
            actionName: exports.hasAction ? generateActionName(componentName) : undefined,
            metaName: exports.hasMeta ? generateMetaName(componentName) : undefined,
          },
        }

        root.children.push(childNode)
      }
    }
  }

  return root
}

/**
 * Build full path from segments (applying group logic)
 */
function buildFullPath(segments: string[]): string {
  const parts: string[] = []

  for (const segment of segments) {
    const routeInfo = convertSegmentToRoute(segment)
    if (!routeInfo.isGroup && routeInfo.routeSegment) {
      parts.push(routeInfo.routeSegment)
    }
  }

  return `/${parts.join('/')}`
}

/**
 * Generate import statement for a route file
 */
function generateImport(file: RouteFile, pagesDir: string, codeSplitting: boolean): string {
  // Convert absolute path to relative import from src/
  const importPath = file.relativePath.replace(/\.tsx$/, '')

  // Layouts, errors, and loading components should never be lazy
  // - Layouts are wrappers that need to be immediate
  // - Errors need to be ready when errors occur
  // - Loading components are fallbacks for Suspense
  if (
    file.type === 'layout' ||
    file.type === 'error' ||
    file.type === 'loading' ||
    file.type === 'not-found'
  ) {
    return `import ${file.componentName} from './${pagesDir}/${importPath}';`
  }

  // Build named imports list (loader, action, meta)
  const namedImports: string[] = []
  if (file.hasLoader && file.loaderName) {
    namedImports.push(`loader as ${file.loaderName}`)
  }
  if (file.hasAction && file.actionName) {
    namedImports.push(`action as ${file.actionName}`)
  }
  if (file.hasMeta && file.metaName) {
    namedImports.push(`meta as ${file.metaName}`)
  }

  // If code splitting enabled, use React.lazy for components
  if (codeSplitting) {
    const lazyImport = `const ${file.componentName} = lazy(() => import('./${pagesDir}/${importPath}'));`

    // If we have named imports (loader/meta), import them separately
    if (namedImports.length > 0) {
      const namedImportStr = `import { ${namedImports.join(', ')} } from './${pagesDir}/${importPath}';`
      return `${namedImportStr}\n${lazyImport}`
    }

    return lazyImport
  }

  // Non-lazy import (code splitting disabled)
  if (namedImports.length > 0) {
    return `import ${file.componentName}, { ${namedImports.join(', ')} } from './${pagesDir}/${importPath}';`
  }

  return `import ${file.componentName} from './${pagesDir}/${importPath}';`
}

/**
 * Wrap element with Suspense if needed for lazy loading
 */
function wrapWithSuspense(
  element: string,
  indent: string,
  codeSplitting: boolean,
  customLoading?: RouteFile
): string {
  if (!codeSplitting) {
    return element
  }

  // Code splitting ativado (lazy loading) - SEMPRE usa Suspense
  if (customLoading) {
    // TEM loading.tsx na hierarquia: Suspense COM fallback customizado
    return `<Suspense fallback={<${customLoading.componentName} />}>\n${indent}  ${element}\n${indent}</Suspense>`
    // biome-ignore lint/style/noUselessElse: customLoading is optional
  } else {
    // NÃO TEM loading.tsx: Suspense SEM fallback (fallback vazio/null)
    return `<Suspense>\n${indent}  ${element}\n${indent}</Suspense>`
  }
}

// function findLoadingInHierarchy(node: RouteNode): RouteFile | null {
// 	if (node.loading) {
// 		return node.loading;
// 	}
// 	if (node.parent) {
// 		return findLoadingInHierarchy(node.parent);
// 	}
// 	return null;
// }

/**
 * Generate RouteObject for a route node
 */
function generateRouteObject(
  node: RouteNode,
  indent = '    ',
  codeSplitting = false,
  isRootWithLayout = false
): string {
  const lines: string[] = []

  //If root node and HAS layout, o page.tsx become children index
  if (node.path === '/' && isRootWithLayout && node.page) {
    lines.push(`${indent}{`)
    lines.push(`${indent}  index: true,`)
    const element = wrapWithSuspense(
      `<${node.page.componentName} />`,
      `${indent}  `,
      codeSplitting,
      node.loading
    )
    lines.push(`${indent}  element: ${element},`)
    if (node.page.hasLoader && node.page.loaderName) {
      lines.push(`${indent}  loader: ${node.page.loaderName},`)
    }
    if (node.page.hasAction && node.page.actionName) {
      lines.push(`${indent}  action: ${node.page.actionName},`)
    }
    if (node.page.hasMeta && node.page.metaName) {
      lines.push(`${indent}  ${generateMetaHandler(node.page.metaName)},`)
    }
    lines.push(`${indent}},`)
  }

  // Handle route groups
  if (node.isGroup) {
    if (node.layout) {
      // Group WITH layout: Create route wrapper with path: ""
      lines.push(`${indent}{`)
      lines.push(`${indent}  path: "",  // Route group - invisible in URL`)
      lines.push(`${indent}  element: <${node.layout.componentName} />,`)

      if (node.error) {
        lines.push(`${indent}  errorElement: <${node.error.componentName} />,`)
      }

      lines.push(`${indent}  children: [`)

      // Add page as index child if exists
      if (node.page) {
        lines.push(`${indent}    {`)
        lines.push(`${indent}      index: true,`)
        const element = wrapWithSuspense(
          `<${node.page.componentName} />`,
          `${indent}    `,
          codeSplitting,
          node.loading
        )
        lines.push(`${indent}      element: ${element},`)
        if (node.page.hasLoader && node.page.loaderName) {
          lines.push(`${indent}      loader: ${node.page.loaderName},`)
        }
        if (node.page.hasAction && node.page.actionName) {
          lines.push(`${indent}      action: ${node.page.actionName},`)
        }
        if (node.page.hasMeta && node.page.metaName) {
          lines.push(`${indent}      ${generateMetaHandler(node.page.metaName)},`)
        }
        lines.push(`${indent}    },`)
      }

      // Add regular children
      for (const child of node.children) {
        const childStr = generateRouteObject(child, `${indent}    `, codeSplitting, false)
        lines.push(childStr)
      }

      lines.push(`${indent}  ],`)
      lines.push(`${indent}},`)
    } else {
      // Group WITHOUT layout: Transparent - render children directly
      for (const child of node.children) {
        const childStr = generateRouteObject(child, indent, codeSplitting, false)
        lines.push(childStr)
      }
    }

    return lines.join('\n')
  }

  // Skip root node
  if (node.path !== '/') {
    // Special handling for optional catch-all [[...slug]]
    // Don't create intermediate node - inject routes directly into parent
    if (node.isOptionalCatchAll && node.page) {
      const element = wrapWithSuspense(
        `<${node.page.componentName} />`,
        `${indent}  `,
        codeSplitting,
        node.loading
      )

      // Index route for /blog
      lines.push(`${indent}{`)
      lines.push(`${indent}  index: true,`)
      lines.push(`${indent}  element: ${element},`)
      if (node.page.hasLoader && node.page.loaderName) {
        lines.push(`${indent}  loader: ${node.page.loaderName},`)
      }
      if (node.page.hasAction && node.page.actionName) {
        lines.push(`${indent}  action: ${node.page.actionName},`)
      }
      if (node.page.hasMeta && node.page.metaName) {
        lines.push(`${indent}  ${generateMetaHandler(node.page.metaName)},`)
      }
      lines.push(`${indent}},`)

      // Wildcard route for /blog/*
      lines.push(`${indent}{`)
      lines.push(`${indent}  path: "*",`)
      lines.push(`${indent}  element: ${element},`)
      if (node.page.hasLoader && node.page.loaderName) {
        lines.push(`${indent}  loader: ${node.page.loaderName},`)
      }
      if (node.page.hasAction && node.page.actionName) {
        lines.push(`${indent}  action: ${node.page.actionName},`)
      }
      if (node.page.hasMeta && node.page.metaName) {
        lines.push(`${indent}  ${generateMetaHandler(node.page.metaName)},`)
      }
      lines.push(`${indent}},`)

      return lines.join('\n')
    }

    lines.push(`${indent}{`)

    // Add path
    if (node.path === '*') {
      lines.push(`${indent}  path: "*",`)
    } else if (node.path) {
      lines.push(`${indent}  path: "${node.path}",`)
    } else {
      // Index route
      lines.push(`${indent}  index: true,`)
    }

    // Determine how to handle page and layout
    const hasChildren = node.children.length > 0
    const hasPageWithLayout = node.layout && node.page
    const hasPageWithoutLayoutButWithChildren = !node.layout && node.page && hasChildren

    if (node.layout) {
      // Has layout: layout becomes element, page becomes index child (if present)
      lines.push(`${indent}  element: <${node.layout.componentName} />,`)
    }

    // Add error boundary if present (applies to the route level)
    if (node.error) {
      lines.push(`${indent}  errorElement: <${node.error.componentName} />,`)
    }

    if (!node.layout && node.page && !hasChildren) {
      // Has page but no children and no layout: page becomes element
      const element = wrapWithSuspense(
        `<${node.page.componentName} />`,
        `${indent}  `,
        codeSplitting,
        node.loading
      )
      lines.push(`${indent}  element: ${element},`)

      if (node.page.hasLoader && node.page.loaderName) {
        lines.push(`${indent}  loader: ${node.page.loaderName},`)
      }

      if (node.page.hasAction && node.page.actionName) {
        lines.push(`${indent}  action: ${node.page.actionName},`)
      }

      if (node.page.hasMeta && node.page.metaName) {
        lines.push(`${indent}  ${generateMetaHandler(node.page.metaName)},`)
      }
    }
    // else: Has page WITH children but NO layout -> page becomes index child (handled below)

    // Add children
    const needsChildren = hasChildren || hasPageWithLayout || hasPageWithoutLayoutButWithChildren

    if (needsChildren) {
      lines.push(`${indent}  children: [`)

      // If node has page (with layout OR with children but no layout), page becomes index child
      if (hasPageWithLayout || hasPageWithoutLayoutButWithChildren) {
        lines.push(`${indent}    {`)
        lines.push(`${indent}      index: true,`)

        const element = wrapWithSuspense(
          `<${node.page?.componentName} />`,
          `${indent}      `,
          codeSplitting,
          node.loading
        )
        lines.push(`${indent}      element: ${element},`)

        if (node.page?.hasLoader && node.page.loaderName) {
          lines.push(`${indent}      loader: ${node.page.loaderName},`)
        }

        if (node.page?.hasAction && node.page.actionName) {
          lines.push(`${indent}      action: ${node.page.actionName},`)
        }

        if (node.page?.hasMeta && node.page.metaName) {
          lines.push(`${indent}  ${generateMetaHandler(node.page.metaName)},`)
        }

        lines.push(`${indent}    },`)
      }

      // Add regular children
      for (const child of node.children) {
        const childStr = generateRouteObject(child, `${indent}    `, codeSplitting, false)
        lines.push(childStr)
      }

      lines.push(`${indent}  ],`)
    }

    lines.push(`${indent}},`)
  } else {
    // Root node - just generate children
    for (const child of node.children) {
      const childStr = generateRouteObject(child, indent, codeSplitting, false)
      lines.push(childStr)
    }
  }

  return lines.join('\n')
}

/**
 * Generate complete routes.tsx content
 */
export function generateRoutesFile(
  routeTree: RouteNode,
  pagesDir: string,
  codeSplitting = false
): string {
  // Collect all route files
  const allFiles: RouteFile[] = []

  function collectFiles(node: RouteNode) {
    if (node.layout) allFiles.push(node.layout)
    if (node.page) allFiles.push(node.page)
    if (node.error) allFiles.push(node.error)
    if (node.loading) allFiles.push(node.loading)
    if (node.notFound) allFiles.push(node.notFound)

    for (const child of node.children) {
      collectFiles(child)
    }
  }

  collectFiles(routeTree)

  // Generate imports
  const imports = allFiles.map((file) => generateImport(file, pagesDir, codeSplitting))

  // Check if root has layout (pages/layout.tsx)
  const hasRootLayout = routeTree.layout !== undefined

  // Add React imports if code splitting is enabled
  const reactImports = codeSplitting ? "import { lazy, Suspense } from 'react';\n" : ''

  const createMetaImport = "import { createMeta } from '@consolidados/hono-vite-runtime/plugins/apply-meta';"

  const errorElement = routeTree.notFound
    ? `errorElement: <${routeTree.notFound?.componentName}/>,`
    : 'errorElement: null,'

  // Build file content
  let content: string

  if (hasRootLayout) {
    // TEM pages/layout.tsx - Layout vira element, HomePage vira index child
    const rootLayoutElement = `<${routeTree.layout?.componentName} />`

    // Generate route objects - passa flag isRootWithLayout=true
    const routeObjects = generateRouteObject(routeTree, '      ', codeSplitting, true)

    content = `// This file is auto-generated by file-based-routing plugin
/** biome-ignore-all lint/suspicious/noExplicitAny: generated code */
/** biome-ignore-all assist/source/organizeImports: generated code  */
// DO NOT EDIT MANUALLY - changes will be overwritten

${reactImports}import type { RouteObject } from 'react-router-dom';
${createMetaImport}

// Auto-generated imports
${imports.join('\n')}

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Suspense>${rootLayoutElement}</Suspense>,
    ${errorElement}
    children: [
${routeObjects}
    ]
  }
];
`
  } else {
    // NÃO TEM pages/layout.tsx - HomePage vira element diretamente
    // pages/page.tsx SEMPRE existe (é obrigatório ter uma home)
    const homePageElement = wrapWithSuspense(
      `<${routeTree.page?.componentName} />`,
      '    ',
      codeSplitting,
      routeTree.loading
    )

    // Gera apenas os children (sem o root page que vira element)
    const childrenRoutes: string[] = []
    for (const child of routeTree.children) {
      const childStr = generateRouteObject(child, '      ', codeSplitting, false)
      childrenRoutes.push(childStr)
    }

    // Monta loader/action/meta do HomePage
    const homeLoader =
      routeTree.page?.hasLoader && routeTree.page.loaderName
        ? `loader: ${routeTree.page.loaderName},`
        : ''

    const homeAction =
      routeTree.page?.hasAction && routeTree.page.actionName
        ? `action: ${routeTree.page.actionName},`
        : ''

    const homeMeta =
      routeTree.page?.hasMeta && routeTree.page.metaName
        ? `handle: { meta: ({ data, params }: any) => createMeta(${routeTree.page.metaName}, { data, params }) },`
        : ''

    content = `// This file is auto-generated by file-based-routing plugin
/** biome-ignore-all lint/suspicious/noExplicitAny: generated code */
/** biome-ignore-all assist/source/organizeImports: generated code  */
// DO NOT EDIT MANUALLY - changes will be overwritten

${reactImports}import type { RouteObject } from 'react-router-dom';
${createMetaImport}

// Auto-generated imports
${imports.join('\n')}

export const routes: RouteObject[] = [
  {
    path: "/",
    element: ${homePageElement},
    ${homeLoader}
    ${homeAction}
    ${homeMeta}
    ${errorElement}
    children: [
${childrenRoutes.join('\n')}
    ]
  }
];
`
  }

  return content
}
