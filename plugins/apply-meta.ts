/** biome-ignore-all lint/suspicious/noExplicitAny: Metadata could be any data strtucture */
import type { StaticHandlerContext } from "react-router-dom/server";

function getValueByPath(source: Record<string, any>, path: string): unknown {
  const segments = path.split(".");

  let current: any = source;
  for (const key of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

type TemplateContext = {
  data?: Record<string, any>;
  params?: Record<string, string>;
};

// const TEMPLATE_REGEX = /\$\{([^}]+)\}/g;
const TEMPLATE_REGEX = /\{{([^}]+)\}}/g;

export function resolveTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(TEMPLATE_REGEX, (_, expression) => {
    const value = getValueByPath(ctx, expression.trim());
    return value != null ? String(value) : "";
  });
}

export type MetaDescriptor = {
  title?: string;
  description?: string;
  keywords?: string[];
};

export function createMeta(meta: MetaDescriptor, ctx: { data?: any; params?: any }) {
  const resolve = (value?: string) => (value ? resolveTemplate(value, ctx) : undefined);

  return {
    title: resolve(meta.title),
    meta: [
      meta.description && {
        name: "description",
        content: resolve(meta.description),
      },
      meta.keywords && {
        name: "keywords",
        content: Array.isArray(meta.keywords)
          ? meta.keywords.map((k) => resolve(k)).join(", ")
          : resolve(meta.keywords),
      },
    ].filter(Boolean),
  };
}

export function resolveRouteMeta(context: StaticHandlerContext) {
  const matches = context.matches;
  const loaderData = context.loaderData;
  // const request = context.request;

  for (const match of [...matches].reverse()) {
    const metaFn = match.route.handle?.meta;

    if (typeof metaFn === "function") {
      return metaFn({
        data: loaderData?.[match.route.id],
        params: match.params,
        // request,
      });
    }
  }

  return null;
}

export function applyMeta(c: StaticHandlerContext, defaultTitle?: string) {
  const resolvedMeta = resolveRouteMeta(c);
  const title = resolvedMeta?.title ?? defaultTitle ?? "Vite + Hono";

  const metaTags =
    resolvedMeta?.meta
      ?.map((m: any) => `<meta name="${m.name}" content="${m.content}" />`)
      .join("\n    ") ?? "";
  return { title, metaTags };
}
