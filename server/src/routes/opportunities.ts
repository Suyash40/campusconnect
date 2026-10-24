import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import {
  Announcement, AnnouncementDoc, CATEGORIES, Registration, RecommendationFeedback,
  SavedOpportunity, UserDoc,
} from '../models/index.js';
import { forbidden, notFound, ok, parsePagination } from '../lib/http.js';
import { checkEligibility } from '../services/eligibility.js';
import { activeFilter, opportunityStatus, toOpportunitySummary } from '../services/opportunities.js';
import { rankOpportunities, RankableOpportunity } from '../services/recommender.js';
import { registerStudent, cancelRegistration } from '../services/registration.js';

const router = Router();
router.use(requireAuth);

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const browseQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  organizer: z.string().trim().max(100).optional(),
  branch: z.string().trim().max(60).optional(),
  year: z.coerce.number().int().min(1).max(4).optional(),
  skill: z.string().trim().max(40).optional(),
  mode: z.enum(['online', 'offline', 'hybrid']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['active', 'open', 'upcoming', 'completed', 'expired', 'all']).default('active'),
  sort: z.enum(['relevance', 'deadline', 'start', 'recent', 'popular']).default('recent'),
  page: z.string().optional(),
  limit: z.string().optional(),
});

router.get('/', async (req, res) => {
  const q = browseQuery.parse(req.query);
  const now = new Date();
  const { page, limit, skip } = parsePagination(q as Record<string, unknown>);
  const filter: Record<string, unknown> = { status: 'published' };
  const and: Record<string, unknown>[] = [];

  if (q.status === 'active') and.push(activeFilter(now));
  if (q.status === 'open') and.push({ registrationDeadline: { $gte: now } });
  if (q.status === 'upcoming') and.push({ registrationDeadline: { $gte: now }, eventStart: { $gt: now } });
  if (q.status === 'completed') and.push({ eventEnd: { $lt: now } });
  if (q.status === 'expired') and.push({ $or: [{ registrationDeadline: { $lt: now } }, { registrationDeadline: null, eventStart: { $lt: now } }] });

  if (q.category) filter.category = q.category;
  if (q.mode) filter.mode = { $in: [q.mode, 'hybrid'] };
  if (q.organizer) filter.organizerName = new RegExp(escapeRegex(q.organizer), 'i');
  if (q.branch) filter['eligibility.branches'] = { $in: [new RegExp(`^${escapeRegex(q.branch)}$`, 'i')] };
  if (q.year) and.push({ $or: [{ 'eligibility.years': { $size: 0 } }, { 'eligibility.years': q.year }] });
  if (q.skill) filter.requiredSkills = new RegExp(`^${escapeRegex(q.skill)}$`, 'i');
  if (q.from || q.to) {
    filter.eventStart = {
      ...(q.from ? { $gte: new Date(q.from) } : {}),
      ...(q.to ? { $lte: new Date(q.to) } : {}),
    };
  }
  if (q.q) and.push({ $text: { $search: q.q } });
  if (and.length) filter.$and = and;

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    relevance: { score: -1, publishedAt: -1 },
    deadline: { registrationDeadline: 1 },
    start: { eventStart: 1 },
    recent: { publishedAt: -1 },
    popular: { registrationCount: -1, saveCount: -1 },
  };
  const projection = q.q ? { score: { $meta: 'textScore' } } : {};
  const sort = q.sort === 'relevance' && !q.q ? sortMap.recent : sortMap[q.sort];

  const [items, total] = await Promise.all([
    Announcement.find(filter, projection).sort(sort).skip(skip).limit(limit).populate('club', 'name').lean(),
    Announcement.countDocuments(filter),
  ]);

  const data = items.map((a) => {
    const summary = toOpportunitySummary(a as unknown as AnnouncementDoc & { _id: Types.ObjectId }, now);
    const elig = checkEligibility(a.eligibility, { branch: req.user!.branch, year: req.user!.year });
    return { ...summary, eligibleForYou: elig.eligible, eligibilityReason: elig.eligible ? null : elig.reason };
  });
  ok(res, data, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

async function studentCanView(user: UserDoc, a: AnnouncementDoc & { status: string; createdBy: Types.ObjectId; club?: Types.ObjectId | null }) {
  if (a.status === 'published') return true;
  if (user.role === 'admin') return true;
  return user.role === 'coordinator' && user.clubIds.some((c) => String(c) === String(a.club));
}

router.get('/:id', async (req, res) => {
  const id = objectId.parse(req.params.id);
  const a = await Announcement.findById(id).populate('club', 'name description').lean();
  if (!a) throw notFound('Opportunity not found');
  if (!(await studentCanView(req.user!, a as never))) throw notFound('Opportunity not found');

  const user = req.user!;
  const now = new Date();
  const isStudent = user.role === 'student';
  if (isStudent && a.status === 'published') {
    await Announcement.updateOne({ _id: id }, { $inc: { viewCount: 1 } });
  }
  const [registration, saved, feedback, related] = await Promise.all([
    Registration.findOne({ user: user._id, announcement: id, status: 'registered' }, { _id: 1 }).lean(),
    SavedOpportunity.exists({ user: user._id, announcement: id }),
    RecommendationFeedback.findOne({ user: user._id, announcement: id }, { value: 1 }).lean(),
    Announcement.find({
      _id: { $ne: id },
      status: 'published',
      category: a.category,
      ...activeFilter(now),
    }).sort({ publishedAt: -1 }).limit(4).select('title category registrationDeadline eventStart').lean(),
  ]);
  const elig = checkEligibility(a.eligibility, { branch: user.branch, year: user.year });
  const summary = toOpportunitySummary(a as unknown as AnnouncementDoc & { _id: Types.ObjectId }, now);
  ok(res, {
    ...summary,
    description: a.description,
    venue: a.venue,
    onlineLink: a.onlineLink,
    registrationUrl: a.registrationUrl,
    contactDetails: a.contactDetails,
    additionalInstructions: a.additionalInstructions,
    benefits: a.benefits,
    targetAudience: a.targetAudience,
    eligibilityNotes: a.eligibility.notes,
    eligibleForYou: elig.eligible,
    eligibilityReason: elig.eligible ? null : elig.reason,
    club: a.club ? { id: String((a.club as unknown as { _id: Types.ObjectId })._id), name: (a.club as unknown as { name: string }).name } : null,
    isRegistered: Boolean(registration),
    isSaved: Boolean(saved),
    feedback: feedback?.value ?? null,
    registrationOpen: summary.status === 'open',
    related: related.map((r) => ({ id: String(r._id), title: r.title, category: r.category, registrationDeadline: r.registrationDeadline })),
  });
});

router.post('/:id/register', async (req, res) => {
  if (req.user!.role !== 'student') throw forbidden('Only students can register for opportunities');
  const id = objectId.parse(req.params.id);
  const a = await registerStudent({ id: String(req.user!._id), branch: req.user!.branch, year: req.user!.year }, id);
  ok(res, { registered: true, title: a.title }, undefined, 201);
});

router.delete('/:id/register', async (req, res) => {
  const id = objectId.parse(req.params.id);
  await cancelRegistration(String(req.user!._id), id);
  ok(res, { registered: false });
});

router.post('/:id/save', async (req, res) => {
  const id = objectId.parse(req.params.id);
  if (!(await Announcement.exists({ _id: id, status: 'published' }))) throw notFound('Opportunity not found');
  const result = await SavedOpportunity.updateOne(
    { user: req.user!._id, announcement: id },
    { $setOnInsert: { user: req.user!._id, announcement: id } },
    { upsert: true },
  );
  if (result.upsertedCount) await Announcement.updateOne({ _id: id }, { $inc: { saveCount: 1 } });
  ok(res, { saved: true });
});

router.delete('/:id/save', async (req, res) => {
  const id = objectId.parse(req.params.id);
  const removed = await SavedOpportunity.deleteOne({ user: req.user!._id, announcement: id });
  if (removed.deletedCount) await Announcement.updateOne({ _id: id, saveCount: { $gt: 0 } }, { $inc: { saveCount: -1 } });
  ok(res, { saved: false });
});

export default router;
