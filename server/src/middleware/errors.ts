import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http.js';
import { zodDetails } from '../lib/http.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Route not found' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { message: 'Validation failed', details: zodDetails(err) } });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return res.status(400).json({ error: { message: 'Validation failed', details } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { message: 'Invalid identifier' } });
  }
  if ((err as { code?: number })?.code === 11000) {
    return res.status(409).json({ error: { message: 'This record already exists' } });
  }
  // Log the server-side detail, but never send internals to the client.
  console.error('[server error]', err instanceof Error ? err.message : 'unknown');
  res.status(500).json({ error: { message: 'Something went wrong. Please try again.' } });
}
