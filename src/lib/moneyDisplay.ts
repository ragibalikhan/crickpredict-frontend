import { API_BASE } from './api';

/** Wallet amounts are stored as integer units; shown uniformly as Indian Rupees in the UI. */
export function formatInr(amount: number): string {
  const n = Math.floor(Number(amount) || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Resolve `/uploads/...` paths for <img src> (works with `/api-proxy` rewrites). */
export function publicUploadUrl(path: string | undefined | null): string | undefined {
  if (!path?.startsWith('/')) return undefined;
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}
