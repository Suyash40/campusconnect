import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { User, CATEGORIES } from '../models/index.js';
import { ok } from '../lib/http.js';
import { publicUser } from './auth.js';

const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  college: z.string().trim().max(160).optional(),
  branch: z.string().trim().max(80).optional(),
  year: z.coerce.number().int().min(1).max(4).nullable().optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  preferredCategories: z.array(z.enum(CATEGORIES)).max(10).optional(),
  notificationPrefs: z
    .object({ inApp: z.boolean(), email: z.boolean(), deadlineReminders: z.boolean() })
    .partial()
    .optional(),
  onboarded: z.boolean().optional(),
});

router.get('/me', (req, res) => ok(res, { user: publicUser(req.user!) }));

router.patch('/me', async (req, res) => {
  const body = profileSchema.parse(req.body);
  const user = req.user!;
  const { notificationPrefs, ...rest } = body;
  Object.assign(user, rest);
  if (notificationPrefs) {
    user.notificationPrefs = { ...user.notificationPrefs, ...notificationPrefs };
  }
  await user.save();
  ok(res, { user: publicUser(user) });
});

export const followedClubIds = async (userId: string) =>
  (await User.findById(userId, { followedClubs: 1 }).lean())?.followedClubs.map(String) ?? [];

export default router;
