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

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg =
        (body && typeof body === 'object' && 'message' in body
          ? String((body as { message?: unknown }).message)
          : `HTTP ${res.status}`);
      throw new ApiError(msg, res.status, body);
    }
    return body as T;
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      throw new ApiError('Request timeout', 408);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
