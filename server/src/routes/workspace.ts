import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Announcement, AuditLog, Club, Registration, User, ROLES } from '../models/index.js';
import { badRequest, forbidden, notFound, ok, parsePagination, conflict } from '../lib/http.js';
import { audit } from '../lib/audit.js';
import { activeFilter, opportunityStatus } from '../services/opportunities.js';
import { runDeadlineReminderSweep } from '../services/reminders.js';

const router = Router();
router.use(['/coordinator', '/admin'], requireAuth);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// ---------- Coordinator ----------

router.get('/coordinator/dashboard', requireRole('coordinator', 'admin'), async (req, res) => {
  const user = req.user!;
  const now = new Date();
  const clubFilter = user.role === 'admin' ? {} : { club: { $in: user.clubIds } };
  const [byStatus, upcoming, regTotals, recent, perAnnouncement] = await Promise.all([
    Announcement.aggregate([{ $match: clubFilter }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Announcement.countDocuments({ ...clubFilter, status: 'published', eventStart: { $gte: now } }),
    Announcement.aggregate([{ $match: { ...clubFilter, status: 'published' } }, { $group: { _id: null, registrations: { $sum: '$registrationCount' }, views: { $sum: '$viewCount' }, saves: { $sum: '$saveCount' } } }]),
    AuditLog.find({ actor: user._id }).sort({ createdAt: -1 }).limit(8).lean(),
    Announcement.find({ ...clubFilter, status: 'published' }).sort({ registrationCount: -1 }).limit(5)
      .select('title registrationCount viewCount saveCount capacity').lean(),
  ]);
  const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.n as number]));
  ok(res, {
    published: counts.published ?? 0,
    drafts: counts.draft ?? 0,
    archived: counts.archived ?? 0,
    upcomingEvents: upcoming,
    registrations: regTotals[0]?.registrations ?? 0,
    views: regTotals[0]?.views ?? 0,
    saves: regTotals[0]?.saves ?? 0,
    performance: perAnnouncement.map((a) => ({ id: String(a._id), title: a.title, registrations: a.registrationCount, views: a.viewCount, saves: a.saveCount, capacity: a.capacity })),
    recentActivity: recent.map((r) => ({ action: r.action, target: r.target, at: r.createdAt })),
  });
});

router.get('/coordinator/events/:id/attendees', requireRole('coordinator', 'admin'), async (req, res) => {
  const id = objectId.parse(req.params.id);
  const a = await Announcement.findById(id).lean();
  if (!a) throw notFound('Event not found');
  if (req.user!.role !== 'admin' && !req.user!.clubIds.some((c) => String(c) === String(a.club))) {
    throw forbidden('You can only view attendees for your clubs');
  }
  const regs = await Registration.find({ announcement: id, status: 'registered' })
    .populate('user', 'name email branch year college')
    .sort({ createdAt: 1 })
    .lean();
  ok(res, {
    event: { id: String(a._id), title: a.title, capacity: a.capacity, registrationCount: a.registrationCount, status: opportunityStatus(a) },
    attendees: regs.map((r) => {
      const u = r.user as unknown as { name: string; email: string; branch: string; year: number; college: string } | null;
      return { name: u?.name ?? 'Deleted user', email: u?.email ?? '', branch: u?.branch ?? '', year: u?.year ?? null, college: u?.college ?? '', registeredAt: r.createdAt };
    }),
  });
});

router.get('/coordinator/events', requireRole('coordinator', 'admin'), async (req, res) => {
  const clubFilter = req.user!.role === 'admin' ? {} : { club: { $in: req.user!.clubIds } };
  const items = await Announcement.find({ ...clubFilter, status: 'published', ...activeFilter(new Date()) })
    .sort({ eventStart: 1 }).limit(100).select('title category eventStart registrationDeadline capacity registrationCount').lean();
  ok(res, items.map((a) => ({ ...a, id: String(a._id) })));
});

// ---------- Admin ----------

router.get('/admin/analytics', requireRole('admin'), async (_req, res) => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [users, publishedCount, clubs, upcoming, trend, categories, moderation] = await Promise.all([
    User.countDocuments(),
    Announcement.countDocuments({ status: 'published' }),
    Club.countDocuments(),
    Announcement.countDocuments({ status: 'published', eventStart: { $gte: now } }),
    Registration.aggregate([
      { $match: { status: 'registered', createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Announcement.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', opportunities: { $sum: 1 }, registrations: { $sum: '$registrationCount' } } },
      { $sort: { registrations: -1 } },
    ]),
    Announcement.countDocuments({ status: 'published', warnings: { $exists: true, $ne: [] } }),
  ]);
  ok(res, {
    totals: { users, publishedAnnouncements: publishedCount, activeClubs: clubs, upcomingEvents: upcoming },
    registrationTrend: trend.map((t) => ({ month: t._id, registrations: t.n })),
    categories: categories.map((c) => ({ category: c._id, opportunities: c.opportunities, registrations: c.registrations })),
    moderationQueue: moderation,
  });
});

router.get('/admin/users', requireRole('admin'), async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const q = z.string().trim().max(100).optional().parse(req.query.search);
  const filter = q ? { $or: [{ name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }] } : {};
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('name email role branch year clubIds createdAt').lean(),
    User.countDocuments(filter),
  ]);
  ok(res, items.map((u) => ({ ...u, id: String(u._id), clubIds: u.clubIds.map(String) })), { page, limit, total, totalPages: Math.ceil(total / limit) });
});

// Role changes are admin-only and audited. Admins cannot demote themselves (prevents lock-out).
router.patch('/admin/users/:id/role', requireRole('admin'), async (req, res) => {
  const id = objectId.parse(req.params.id);
  const body = z.object({
    role: z.enum(ROLES),
    clubIds: z.array(objectId).max(20).default([]),
  }).parse(req.body);
  if (id === String(req.user!._id) && body.role !== 'admin') throw conflict('You cannot remove your own admin role');
  if (body.role === 'coordinator' && body.clubIds.length === 0) throw badRequest('Assign at least one club to a coordinator');
  const user = await User.findById(id);
  if (!user) throw notFound('User not found');
  const clubs = await Club.find({ _id: { $in: body.clubIds } }, { _id: 1 }).lean();
  if (clubs.length !== body.clubIds.length) throw badRequest('One or more clubs do not exist');
  const previous = user.role;
  user.role = body.role;
  user.clubIds = body.role === 'coordinator' ? clubs.map((c) => c._id) : [];
  await user.save();
  await audit(String(req.user!._id), 'user.role_changed', id, { from: previous, to: body.role });
  ok(res, { id, role: user.role });
});

router.get('/admin/audit', requireRole('admin'), async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const items = await AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email').lean();
  ok(res, items.map((i) => ({ ...i, id: String(i._id) })), { page, limit });
});

router.get('/admin/moderation', requireRole('admin'), async (_req, res) => {
  const items = await Announcement.find({ status: 'published', warnings: { $exists: true, $ne: [] } })
    .sort({ publishedAt: -1 }).limit(50).select('title warnings club publishedAt').populate('club', 'name').lean();
  ok(res, items.map((a) => ({ ...a, id: String(a._id), club: (a.club as unknown as { name?: string })?.name ?? '' })));
});

router.post('/admin/reminders/run', requireRole('admin'), async (req, res) => {
  const sent = await runDeadlineReminderSweep();
  await audit(String(req.user!._id), 'reminders.swept', '', { created: sent });
  ok(res, { created: sent });
});

export default router;
