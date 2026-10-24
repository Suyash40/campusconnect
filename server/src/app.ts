import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clubRoutes from './routes/clubs.js';
import announcementRoutes from './routes/announcements.js';
import opportunityRoutes from './routes/opportunities.js';
import engagementRoutes from './routes/engagement.js';
import workspaceRoutes from './routes/workspace.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { env } from './config/env.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: false }));
  app.use(express.json({ limit: '200kb' }));
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok' } }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/clubs', clubRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/opportunities', opportunityRoutes);
  // Mounted last. Each router applies auth only to its own path prefixes, so unknown routes still return 404.
  app.use('/api', engagementRoutes);
  app.use('/api', workspaceRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
