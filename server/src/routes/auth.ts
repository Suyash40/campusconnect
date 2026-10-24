import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { conflict, ok, unauthorized, badRequest } from '../lib/http.js';
import { audit } from '../lib/audit.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

// Public registration only creates students. Coordinators and admins are assigned by an administrator.
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  college: z.string().trim().min(2).max(160),
  branch: z.string().trim().min(2).max(80),
  year: z.coerce.number().int().min(1).max(4),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const publicUser = (u: InstanceType<typeof User>) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  college: u.college,
  branch: u.branch,
  year: u.year,
  interests: u.interests,
  skills: u.skills,
  preferredCategories: u.preferredCategories,
  followedClubs: (u.followedClubs ?? []).map(String),
  clubIds: (u.clubIds ?? []).map(String),
  notificationPrefs: u.notificationPrefs,
  onboarded: u.onboarded,
});

router.post('/register', authLimiter, async (req, res) => {
  const body = registerSchema.parse(req.body);
  if (await User.exists({ email: body.email })) throw conflict('An account with this email already exists');
  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({ ...body, passwordHash, role: 'student' });
  ok(res, { token: signToken(String(user._id)), user: publicUser(user) }, undefined, 201);
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password, to avoid account enumeration.
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) throw unauthorized('Invalid email or password');
  ok(res, { token: signToken(String(user._id)), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  ok(res, { user: publicUser(req.user!) });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = z
    .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) })
    .parse(req.body);
  const user = await User.findById(req.user!._id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('Current password is incorrect');
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await audit(String(user._id), 'auth.password_changed');
  ok(res, { changed: true });
});

export default router;
