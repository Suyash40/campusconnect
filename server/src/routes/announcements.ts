import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Announcement, AnnouncementDoc, CATEGORIES, Club, Registration, UserDoc } from '../models/index.js';
import { forbidden, notFound, ok, conflict, badRequest } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { isSafeHttpUrl } from '../lib/urls.js';
import { computeWarnings, publishBlockers } from '../services/announcementRules.js';
import { extractAnnouncements } from '../services/aiClient.js';
import { createNotifications, notifyNewPublication } from '../services/notifications.js';

const router = Router();
router.use(requireAuth, requireRole('coordinator', 'admin'));

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const optionalDate = z.union([z.string().datetime({ offset: true }), z.literal(''), z.null()]).optional()
  .transform((v) => (v ? new Date(v) : null));
const url = z.string().trim().max(500).refine((v) => isSafeHttpUrl(v), 'Must be a valid http(s) URL').default('');

export const announcementInput = z.object({
  title: z.string().trim().max(200).default(''),
  description: z.string().max(10000).default(''),
  category: z.enum(CATEGORIES),
  clubId: objectId,
  organizerName: z.string().trim().max(120).default(''),
  eventStart: optionalDate,
  eventEnd: optionalDate,
  registrationDeadline: optionalDate,
  mode: z.enum(['online', 'offline', 'hybrid', 'unspecified']).default('unspecified'),
  venue: z.string().trim().max(200).default(''),
  onlineLink: url,
  eligibility: z.object({
    branches: z.array(z.string().trim().max(60)).max(20).default([]),
    years: z.array(z.number().int().min(1).max(4)).max(4).default([]),
    minTeamSize: z.number().int().min(1).nullable().default(null),
    maxTeamSize: z.number().int().min(1).nullable().default(null),
    notes: z.string().max(500).default(''),
  }).default({ branches: [], years: [], minTeamSize: null, maxTeamSize: null, notes: '' }),
  requiredSkills: z.array(z.string().trim().max(40)).max(20).default([]),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  registrationUrl: url,
  contactDetails: z.string().max(300).default(''),
  additionalInstructions: z.string().max(2000).default(''),
  benefits: z.string().max(1000).default(''),
  targetAudience: z.string().max(300).default(''),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  capacity: z.number().int().min(1).nullable().default(null),
  sourceMessage: z.string().max(20000).default(''),
});

const isAdmin = (u: UserDoc) => u.role === 'admin';

/** Coordinators may only manage announcements for clubs they belong to. */
function assertCanManage(user: UserDoc, a: { club?: unknown }) {
  if (isAdmin(user)) return;
  const clubId = a.club ? String(a.club) : '';
  if (!user.clubIds.some((c) => String(c) === clubId)) throw forbidden('You can only manage announcements for your clubs');
}

async function assertClubAllowed(user: UserDoc, clubId: string) {
  const club = await Club.findById(clubId);
  if (!club) throw notFound('Club not found');
  if (!isAdmin(user) && !user.clubIds.some((c) => String(c) === clubId)) {
    throw forbidden('You can only create announcements for your clubs');
  }
  return club;
}

const toView = (a: AnnouncementDoc) => {
  const { _id, club, ...rest } = a.toObject();
  return { ...rest, id: String(_id), club: club ? String(club) : null };
};

async function loadAnnouncement(id: string) {
  const a = await Announcement.findById(id);
  if (!a) throw notFound('Announcement not found');
  return a;
}

/** Recomputes warnings and potential duplicates before saving or publishing. */
async function refreshWarnings(a: InstanceType<typeof Announcement>) {
  const warnings = computeWarnings(a);
  const dupe = await Announcement.exists({
    _id: { $ne: a._id },
    club: a.club,
    status: { $ne: 'archived' },
    title: new RegExp(`^${a.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (dupe) warnings.push('Potential duplicate: an announcement with the same title exists for this club');
  a.warnings = warnings;
}

router.get('/', async (req, res) => {
  const q = z.object({
    status: z.enum(['draft', 'published', 'archived', 'all']).default('all'),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const filter: Record<string, unknown> = {};
  if (!isAdmin(req.user!)) filter.club = { $in: req.user!.clubIds };
  if (q.status !== 'all') filter.status = q.status;
  if (q.search) filter.title = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([
    Announcement.find(filter).sort({ updatedAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Announcement.countDocuments(filter),
  ]);
  const regs = await Registration.aggregate([
    { $match: { announcement: { $in: items.map((i) => i._id) }, status: 'registered' } },
    { $group: { _id: '$announcement', n: { $sum: 1 } } },
  ]);
  const regCount = new Map(regs.map((r) => [String(r._id), r.n as number]));
  ok(
    res,
    items.map((a) => ({ ...a, id: String(a._id), club: a.club ? String(a.club) : null, activeRegistrations: regCount.get(String(a._id)) ?? 0 })),
    { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  );
});

router.get('/:id', async (req, res) => {
  const a = await loadAnnouncement(req.params.id);
  assertCanManage(req.user!, a);
  ok(res, toView(a));
});

router.post('/', async (req, res) => {
  const body = announcementInput.parse(req.body);
  await assertClubAllowed(req.user!, body.clubId);
  const { clubId, ...rest } = body;
  const a = new Announcement({ ...rest, club: clubId, createdBy: req.user!._id, status: 'draft' });
  await refreshWarnings(a);
  await a.save();
  await audit(String(req.user!._id), 'announcement.draft_created', String(a._id));
  ok(res, toView(a), undefined, 201);
});

router.patch('/:id', async (req, res) => {
  const a = await loadAnnouncement(req.params.id);
  assertCanManage(req.user!, a);
  if (a.status === 'archived') throw conflict('Archived announcements cannot be edited');
  // Zod's partial() keeps defaults, so keep only the keys the client actually sent.
  const parsed = announcementInput.partial().parse(req.body);
  const body = Object.fromEntries(Object.entries(parsed).filter(([key]) => key in req.body));
  const { clubId, ...rest } = body as Partial<typeof parsed>;
  if (clubId) {
    await assertClubAllowed(req.user!, clubId);
    a.club = new Types.ObjectId(clubId);
  }
  const previousStart = a.eventStart?.getTime() ?? null;
  Object.assign(a, rest);
  await refreshWarnings(a);
  await a.save();

  // Registered students must hear about changed event times.
  if (a.status === 'published' && a.eventStart?.getTime() !== previousStart) {
    const regs = await Registration.find({ announcement: a._id, status: 'registered' }, { user: 1 }).lean();
    await createNotifications(regs.map((r) => ({
      userId: String(r.user),
      type: 'event_updated',
      title: 'Event time changed',
      body: a.title,
      link: `/opportunities/${a.id}`,
      dedupeKey: `update:${a.id}:${r.user}:${a.eventStart?.getTime() ?? 'none'}`,
    })));
  }
  await audit(String(req.user!._id), 'announcement.updated', String(a._id));
  ok(res, toView(a));
});

router.post('/:id/publish', async (req, res) => {
  const { confirm } = z.object({ confirm: z.literal(true, { message: 'Please confirm before publishing' }) }).parse(req.body);
  const a = await loadAnnouncement(req.params.id);
  assertCanManage(req.user!, a);
  if (a.status === 'archived') throw conflict('Archived announcements cannot be published');
  await refreshWarnings(a);
  const blockers = publishBlockers(a);
  if (blockers.length) throw badRequest('Cannot publish yet', blockers);
  if (!confirm) throw badRequest('Please confirm before publishing');

  a.status = 'published';
  a.publishedAt = new Date();
  await a.save();
  await audit(String(req.user!._id), 'announcement.published', String(a._id), { warnings: a.warnings.length });
  const notified = await notifyNewPublication({
    id: String(a._id),
    title: a.title,
    eligibility: a.eligibility,
    clubId: a.club ? String(a.club) : null,
  });
  ok(res, { ...toView(a), notified });
});

router.post('/:id/archive', async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
  const a = await loadAnnouncement(req.params.id);
  assertCanManage(req.user!, a);
  const wasPublished = a.status === 'published';
  a.status = 'archived';
  a.archiveReason = reason;
  await a.save();
  if (wasPublished) {
    const regs = await Registration.find({ announcement: a._id, status: 'registered' }, { user: 1 }).lean();
    await createNotifications(regs.map((r) => ({
      userId: String(r.user),
      type: 'event_cancelled',
      title: 'Opportunity withdrawn',
      body: `${a.title}: ${reason}`,
      link: '/registrations',
      dedupeKey: `cancel:${a.id}:${r.user}`,
    })));
  }
  await audit(String(req.user!._id), 'announcement.archived', String(a._id), { reason });
  ok(res, toView(a));
});

// AI extraction: the message is untrusted data. It is sent to the AI service as content only.
const extractLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.post('/ai/extract', extractLimiter, async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(10).max(20000) }).parse(req.body);
  const result = await extractAnnouncements(text);
  await audit(String(req.user!._id), 'ai.extract', '', { chars: text.length, provider: result.provider });
  ok(res, result);
});


export default router;
