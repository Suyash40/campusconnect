import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/index.js';

/**
 * Creates the first admin from environment variables when no admin exists.
 * Admins cannot be created through public registration.
 */
export async function bootstrapAdmin() {
  if (!env.ADMIN_SEED_EMAIL || !env.ADMIN_SEED_PASSWORD) return;
  if (await User.exists({ role: 'admin' })) return;
  await User.create({
    name: 'Platform Admin',
    email: env.ADMIN_SEED_EMAIL,
    passwordHash: await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12),
    role: 'admin',
    college: 'CampusConnect',
    branch: '',
    onboarded: true,
  });
  console.log(`Bootstrapped admin account ${env.ADMIN_SEED_EMAIL}`);
}
