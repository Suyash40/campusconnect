import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, UserDoc } from '../models/index.js';
import { forbidden, unauthorized } from '../lib/http.js';

export type Role = 'student' | 'coordinator' | 'admin';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDoc;
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

/** Resolves the bearer token to a fresh DB user so revoked/demoted users lose access immediately. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw unauthorized();
    let payload: { sub?: string };
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
    } catch {
      throw unauthorized('Session expired. Please log in again.');
    }
    const user = await User.findById(payload.sub);
    if (!user) throw unauthorized();
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role as Role)) return next(forbidden());
    next();
  };
