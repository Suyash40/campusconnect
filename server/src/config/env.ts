import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/campusconnect'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AI_SERVICE_URL: z.string().default('http://127.0.0.1:8000'),
  AI_SERVICE_TOKEN: z.string().default(''),
  AI_TIMEOUT_MS: z.coerce.number().default(15000),
  REMINDER_INTERVAL_MINUTES: z.coerce.number().default(15),
  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional(),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
