/// <reference types="vite/client" />

declare module "virtual:server-actions-manifest" {
  interface ActionMeta {
    filePath: string;
    functionName: string;
  }

  const manifest: {
    salt: string;
    actions: Record<string, ActionMeta>;
  };

  export default manifest;
}

declare module "virtual:server-actions-runtime" {
  export function callServerAction(actionHash: string, args: unknown[]): Promise<unknown>;
}
