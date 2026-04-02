/**
 * REST: use relative `/api-proxy` in the browser so Next.js forwards to the Nest API
 * (see `next.config.ts` → BACKEND_URL, default http://localhost:3000).
 * Set NEXT_PUBLIC_API_URL to call the API directly (must match backend CORS).
 *
 * Dev: run Nest on :3000 (`crickpredict-backend`) and Next on :3001 (`npm run dev` in frontend).
 *
 * WebSockets: Socket.IO cannot use the Next rewrite; use NEXT_PUBLIC_SOCKET_URL (direct backend).
 */
const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE =
  explicit ||
  (typeof window !== "undefined" ? "/api-proxy" : "http://localhost:3000");

export const SOCKET_BASE =
  process.env.NEXT_PUBLIC_SOCKET_URL?.trim() ||
  explicit ||
  "http://localhost:3000";
