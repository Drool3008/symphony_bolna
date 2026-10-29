/**
 * The backend's address. Empty means the page's own origin: in development the
 * Vite proxy forwards /api, /events and /media to the backend. A build served
 * from somewhere else sets VITE_API_BASE, as the reference's client did
 * (reference src/lib/config.ts).
 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')

/** A backend path as a URL this page can fetch. */
export function apiUrl(path: string, base: string = API_BASE): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}
