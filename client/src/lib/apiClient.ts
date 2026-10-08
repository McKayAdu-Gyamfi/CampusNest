const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Wraps fetch for the CampusNest backend. Always sends the better-auth
 * session cookie (`credentials: "include"`) and unwraps the backend's
 * `{ success, data }` / `{ success, message }` response envelope.
 *
 * Throws ApiError for any non-2xx HTTP response (status + the backend's own
 * message). A network-level failure (backend unreachable) is NOT wrapped —
 * it propagates as whatever error `fetch` itself throws, since there's no
 * HTTP response to read a status/message from. Callers should distinguish
 * the two by checking `e instanceof ApiError`.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body: ApiEnvelope<T> = await res.json().catch(() => ({ success: false }));

  if (!res.ok) {
    throw new ApiError(res.status, body.message || `Request failed (${res.status})`);
  }

  return (body.data as T) ?? (body as unknown as T);
}
