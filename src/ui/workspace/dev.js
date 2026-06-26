/**
 * Dev server entry for Vite dev mode with HMR.
 * Exports the Fresh App instance — the Vite plugin handles the dev server.
 * Token auth is disabled in dev mode (localhost-only, no exposure risk).
 */

import { createWorkspaceApp } from "./server.js";

export const app = createWorkspaceApp({
    cwd: Deno.cwd(),
    token: "",
    skipTokenCheck: true,
});
