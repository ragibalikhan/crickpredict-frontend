/**
 * REST (browser): use same-origin `/api-proxy` so Next.js rewrites to Nest (see `next.config.ts` → BACKEND_URL).
 * Set NEXT_PUBLIC_API_URL to call the API directly (must match backend CORS) if the proxy misbehaves.
 *
 * Dev: Nest on :3000, Next on :3001 (`npm run dev` in frontend). Restart Next after changing `.env.local`.
 *
 * WebSockets: Socket.IO cannot use the Next rewrite — use NEXT_PUBLIC_SOCKET_URL (direct backend).
 */
const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();

const serverFallback = process.env.INTERNAL_API_URL?.trim() || "http://127.0.0.1:3000";

export const API_BASE =
  explicit ||
  (typeof window !== "undefined" ? "/api-proxy" : serverFallback);

export const SOCKET_BASE =
  process.env.NEXT_PUBLIC_SOCKET_URL?.trim() ||
  explicit ||
  "http://127.0.0.1:3000";
