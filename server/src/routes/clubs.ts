import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Club, User, Announcement } from '../models/index.js';
import { ok, notFound, conflict } from '../lib/http.js';
import { audit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

const clubSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  category: z.string().trim().max(40).default('technical'),
  tags: z.array(z.string().trim().max(40)).max(15).default([]),
});

router.get('/', async (req, res) => {
  const clubs = await Club.find().sort({ name: 1 }).lean();
  const followed = new Set((req.user!.followedClubs ?? []).map(String));
  ok(res, clubs.map((c) => ({ ...c, id: String(c._id), followed: followed.has(String(c._id)) })));
});

// Coordinators see only the clubs they manage; admins see all.
router.get('/managed', requireRole('coordinator', 'admin'), async (req, res) => {
  const filter = req.user!.role === 'admin' ? {} : { _id: { $in: req.user!.clubIds } };
  const clubs = await Club.find(filter).sort({ name: 1 }).lean();
  ok(res, clubs.map((c) => ({ ...c, id: String(c._id) })));
});

router.post('/', requireRole('admin'), async (req, res) => {
  const body = clubSchema.parse(req.body);
  if (await Club.exists({ name: body.name })) throw conflict('A club with this name already exists');
  const club = await Club.create({ ...body, createdBy: req.user!._id });
  await audit(String(req.user!._id), 'club.created', String(club._id), { name: club.name });
  ok(res, { ...club.toObject(), id: String(club._id) }, undefined, 201);
});

router.post('/:id/follow', async (req, res) => {
  const id = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.id);
  if (!(await Club.exists({ _id: id }))) throw notFound('Club not found');
  await User.updateOne({ _id: req.user!._id }, { $addToSet: { followedClubs: new Types.ObjectId(id) } });
  ok(res, { following: true });
});

router.post('/:id/unfollow', async (req, res) => {
  const id = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.id);
  await User.updateOne({ _id: req.user!._id }, { $pull: { followedClubs: new Types.ObjectId(id) } });
  ok(res, { following: false });
});

router.get('/:id/announcements', async (req, res) => {
  const id = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.id);
  const items = await Announcement.find({ club: id, status: 'published' })
    .sort({ publishedAt: -1 })
    .limit(20)
    .select('title category eventStart registrationDeadline publishedAt')
    .lean();
  ok(res, items.map((a) => ({ ...a, id: String(a._id) })));
});

export default router;
