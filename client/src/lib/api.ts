export class ApiError extends Error {
  status: number;
  details?: unknown[];

  constructor(status: number, message: string, details?: unknown[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'cc_token';

// Token lives in localStorage for this prototype-grade session. Production should use an httpOnly cookie.
export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string | null) => {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.set(null);
      window.dispatchEvent(new Event('cc:logout'));
    }
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.message ?? 'Something went wrong. Please try again.', err.details);
  }
  return body as { data: T; meta?: Record<string, unknown> };
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json: json ?? {} });
export const patch = <T,>(path: string, json: unknown) => api<T>(path, { method: 'PATCH', json });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const detail = Array.isArray(err.details) && err.details.length
      ? (err.details as { message?: string; path?: string }[]).map((d) => d.message).filter(Boolean).join('. ')
      : '';
    return detail && err.status === 400 ? `${err.message}: ${detail}` : err.message;
  }
  return 'Network error. Check your connection and try again.';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'coordinator' | 'admin';
  college: string;
  branch: string;
  year: number | null;
  interests: string[];
  skills: string[];
  preferredCategories: string[];
  followedClubs: string[];
  clubIds: string[];
  notificationPrefs: { inApp: boolean; email: boolean; deadlineReminders: boolean };
  onboarded: boolean;
}

export const CATEGORY_LABELS: Record<string, string> = {
  hackathon: 'Hackathon', internship: 'Internship', placement: 'Placement', workshop: 'Workshop',
  seminar: 'Seminar', technical: 'Technical event', cultural: 'Cultural event',
  club_recruitment: 'Club recruitment', competition: 'Competition', notice: 'Important notice',
};

export const STATUS_LABELS: Record<string, string> = {
  open: 'Open for registration', upcoming: 'Upcoming', completed: 'Completed', expired: 'Expired',
};

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString(undefined, withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}
