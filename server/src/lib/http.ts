import { Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Not authenticated') => new HttpError(401, msg);
export const forbidden = (msg = 'You do not have permission for this action') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

export function ok(res: Response, data: unknown, meta?: Record<string, unknown>, status = 200) {
  res.status(status).json({ data, ...(meta ? { meta } : {}) });
}

/** Parses a page/limit pair, clamping to safe bounds. */
export function parsePagination(q: Record<string, unknown>) {
  const page = Math.max(1, Number.parseInt(String(q.page ?? '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(String(q.limit ?? '12'), 10) || 12));
  return { page, limit, skip: (page - 1) * limit };
}

export function zodDetails(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}
