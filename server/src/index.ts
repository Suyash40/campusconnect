import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { Notification, Registration, User } from './models/index.js';
import { runDeadlineReminderSweep } from './services/reminders.js';
import { bootstrapAdmin } from './scripts/bootstrapAdmin.js';

async function main() {
  await mongoose.connect(env.MONGO_URI);
  // Unique indexes (dedupe keys, one registration per student) must exist before traffic arrives.
  await Promise.all([User.syncIndexes(), Notification.syncIndexes(), Registration.syncIndexes()]);
  await bootstrapAdmin();

  createApp().listen(env.PORT, () => console.log(`CampusConnect API listening on :${env.PORT}`));

  setInterval(() => {
    runDeadlineReminderSweep().catch((err) => console.error('[reminders]', err instanceof Error ? err.message : err));
  }, env.REMINDER_INTERVAL_MINUTES * 60 * 1000);
}

main().catch((err) => {
  console.error('Failed to start server', err instanceof Error ? err.message : err);
  process.exit(1);
});
