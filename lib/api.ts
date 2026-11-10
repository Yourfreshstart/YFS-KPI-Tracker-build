// How the browser talks to our own server (which holds the only database key).
// If the server says "please sign in" (session ended), everything listening is
// told so each screen can fall back to its sign-in prompt.
export const AUTH_LOST_EVENT = "yfs-auth-lost";

export type ApiResult<T = any> = { ok: boolean; status: number; data: T };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const method = opts.method || (opts.body !== undefined ? "POST" : "GET");
  try {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T;
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      window.dispatchEvent(new Event(AUTH_LOST_EVENT));
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} as T };
  }
}
