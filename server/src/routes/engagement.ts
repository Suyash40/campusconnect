import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  Announcement, AnnouncementDoc, APPLICATION_STATUSES, Application, Notification,
  Registration, RecommendationFeedback, SavedOpportunity, User,
} from '../models/index.js';
import { badRequest, notFound, ok, parsePagination } from '../lib/http.js';
import { activeFilter, opportunityStatus, toOpportunitySummary, toRankable } from '../services/opportunities.js';
import { checkEligibility } from '../services/eligibility.js';
import { rankOpportunities, RankableOpportunity } from '../services/recommender.js';
import { answerQuestion } from '../services/aiClient.js';
import { followedClubIds } from './users.js';

const router = Router();
router.use(['/registrations', '/saved', '/recommendations', '/applications', '/notifications', '/dashboard', '/assistant', '/placements'], requireAuth);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const summaryOf = (a: unknown, now = new Date()) =>
  toOpportunitySummary(a as AnnouncementDoc & { _id: Types.ObjectId }, now);

// ---------- Registrations & saved ----------

router.get('/registrations/mine', async (req, res) => {
  const regs = await Registration.find({ user: req.user!._id, status: 'registered' })
    .sort({ createdAt: -1 })
    .populate({ path: 'announcement', populate: { path: 'club', select: 'name' } })
    .lean();
  const now = new Date();
  ok(res, regs
    .filter((r) => r.announcement)
    .map((r) => ({
      registeredAt: r.createdAt,
      ...summaryOf(r.announcement, now),
      timing: (r.announcement as unknown as AnnouncementDoc).eventEnd && (r.announcement as unknown as AnnouncementDoc).eventEnd! < now ? 'past' : 'upcoming',
    })));
});

router.get('/saved', async (req, res) => {
  const saves = await SavedOpportunity.find({ user: req.user!._id }).sort({ createdAt: -1 })
    .populate({ path: 'announcement', populate: { path: 'club', select: 'name' } }).lean();
  const now = new Date();
  ok(res, saves.filter((s) => s.announcement && (s.announcement as unknown as { status: string }).status === 'published')
    .map((s) => ({ savedAt: s.createdAt, ...summaryOf(s.announcement, now) })));
});

// ---------- Recommendations ----------

router.get('/recommendations', async (req, res) => {
  const user = req.user!;
  const now = new Date();
  const [candidates, feedback] = await Promise.all([
    Announcement.find({ status: 'published', ...activeFilter(now) })
      .sort({ publishedAt: -1 }).limit(300).populate('club', '_id').lean(),
    RecommendationFeedback.find({ user: user._id }).lean(),
  ]);
  const ops: RankableOpportunity[] = candidates.map(toRankable);
  const ranked = rankOpportunities(ops, {
    interests: user.interests,
    skills: user.skills,
    preferredCategories: user.preferredCategories,
    followedClubs: (user.followedClubs ?? []).map(String),
    branch: user.branch,
    year: user.year,
  }, {
    now,
    notRelevant: new Set(feedback.filter((f) => f.value === 'not_relevant').map((f) => String(f.announcement))),
    moreLikeThis: new Set(feedback.filter((f) => f.value === 'more_like_this').map((f) => String(f.announcement))),
  }, 12);
  const byId = new Map(candidates.map((c) => [String(c._id), c]));
  ok(res, ranked.map((r) => ({
    ...summaryOf(byId.get(r.id), now),
    score: r.score,
    reasons: r.reasons,
    profileBased: r.profileBased,
  })));
});

router.post('/recommendations/feedback', async (req, res) => {
  const body = z.object({
    announcementId: objectId,
    value: z.enum(['more_like_this', 'not_relevant']),
  }).parse(req.body);
  if (!(await Announcement.exists({ _id: body.announcementId, status: 'published' }))) throw notFound('Opportunity not found');
  await RecommendationFeedback.updateOne(
    { user: req.user!._id, announcement: body.announcementId },
    { $set: { value: body.value } },
    { upsert: true },
  );
  ok(res, { recorded: true, value: body.value });
});

// ---------- Application tracker ----------

const applicationInput = z.object({
  company: z.string().trim().min(2).max(120),
  role: z.string().trim().min(2).max(120),
  kind: z.enum(['internship', 'placement']).default('internship'),
  status: z.enum(APPLICATION_STATUSES).default('interested'),
  notes: z.string().max(2000).default(''),
});

router.get('/applications', async (req, res) => {
  const items = await Application.find({ user: req.user!._id }).sort({ updatedAt: -1 }).lean();
  ok(res, items.map((a) => ({ ...a, id: String(a._id) })));
});

router.post('/applications', async (req, res) => {
  const body = applicationInput.parse(req.body);
  const app = await Application.create({ ...body, user: req.user!._id });
  ok(res, { ...app.toObject(), id: String(app._id) }, undefined, 201);
});

router.patch('/applications/:id', async (req, res) => {
  const id = objectId.parse(req.params.id);
  const body = applicationInput.partial().parse(req.body);
  const app = await Application.findOneAndUpdate({ _id: id, user: req.user!._id }, { $set: body }, { new: true });
  if (!app) throw notFound('Application not found');
  ok(res, { ...app.toObject(), id: String(app._id) });
});

router.delete('/applications/:id', async (req, res) => {
  const id = objectId.parse(req.params.id);
  const removed = await Application.deleteOne({ _id: id, user: req.user!._id });
  if (!removed.deletedCount) throw notFound('Application not found');
  ok(res, { deleted: true });
});

// Verified employer/placement updates: admins only. Kept separate from the student-managed status.
router.patch('/applications/:id/verify', requireRole('admin'), async (req, res) => {
  const id = objectId.parse(req.params.id);
  const { status } = z.object({ status: z.enum(APPLICATION_STATUSES) }).parse(req.body);
  const app = await Application.findByIdAndUpdate(id, {
    $set: { 'verified.status': status, 'verified.by': req.user!._id, 'verified.at': new Date() },
  }, { new: true });
  if (!app) throw notFound('Application not found');
  ok(res, { ...app.toObject(), id: String(app._id) });
});

// ---------- Notifications ----------

router.get('/notifications', async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const filter = { user: req.user!._id };
  const [items, unread, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ ...filter, read: false }),
    Notification.countDocuments(filter),
  ]);
  ok(res, items.map((n) => ({ ...n, id: String(n._id) })), { page, limit, total, unread, totalPages: Math.ceil(total / limit) });
});

router.post('/notifications/:id/read', async (req, res) => {
  await Notification.updateOne({ _id: objectId.parse(req.params.id), user: req.user!._id }, { read: true });
  ok(res, { read: true });
});

router.post('/notifications/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user!._id, read: false }, { read: true });
  ok(res, { read: true });
});

// ---------- Student dashboard ----------

router.get('/dashboard/student', async (req, res) => {
  const user = req.user!;
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 86400000);
  const followed = await followedClubIds(String(user._id));
  const base = { status: 'published', ...activeFilter(now) } as const;
  const populate = { path: 'club', select: 'name' } as const;

  const [recs, upcomingRaw, deadlinesRaw, trendingRaw, clubRaw, recentRaw] = await Promise.all([
    Announcement.find({ status: 'published', ...activeFilter(now) }).sort({ publishedAt: -1 }).limit(200).populate(populate).lean(),
    Announcement.find({ ...base, eventStart: { $gte: now } }).sort({ eventStart: 1 }).limit(30).populate(populate).lean(),
    Announcement.find({ ...base, registrationDeadline: { $gte: now, $lte: in14 } }).sort({ registrationDeadline: 1 }).limit(30).populate(populate).lean(),
    Announcement.find({ ...base }).sort({ registrationCount: -1, saveCount: -1, viewCount: -1 }).limit(30).populate(populate).lean(),
    followed.length ? Announcement.find({ ...base, club: { $in: followed } }).sort({ publishedAt: -1 }).limit(6).populate(populate).lean() : Promise.resolve([]),
    Announcement.find({ ...base }).sort({ publishedAt: -1 }).limit(30).populate(populate).lean(),
  ]);

  const eligibleOnly = <T extends { eligibility?: { branches?: string[]; years?: number[] } | null }>(items: T[]) =>
    items.filter((a) => checkEligibility(a.eligibility, { branch: user.branch, year: user.year }).eligible);

  const feedbackRows = await RecommendationFeedback.find({ user: user._id }).lean();
  const ranked = rankOpportunities(recs.map(toRankable), {
    interests: user.interests, skills: user.skills, preferredCategories: user.preferredCategories,
    followedClubs: followed, branch: user.branch, year: user.year,
  }, {
    now,
    notRelevant: new Set(feedbackRows.filter((f) => f.value === 'not_relevant').map((f) => String(f.announcement))),
    moreLikeThis: new Set(feedbackRows.filter((f) => f.value === 'more_like_this').map((f) => String(f.announcement))),
  }, 4);
  const byId = new Map(recs.map((r) => [String(r._id), r]));



  ok(res, {
    profile: { name: user.name, branch: user.branch, year: user.year, college: user.college, onboarded: user.onboarded },
    recommended: ranked.map((r) => ({ ...summaryOf(byId.get(r.id), now), score: r.score, reasons: r.reasons, profileBased: r.profileBased })),
    upcoming: eligibleOnly(upcomingRaw).slice(0, 5).map((a) => summaryOf(a, now)),
    deadlines: eligibleOnly(deadlinesRaw).slice(0, 5).map((a) => summaryOf(a, now)),
    trending: eligibleOnly(trendingRaw).slice(0, 5).map((a) => ({ ...summaryOf(a, now), engagement: a.registrationCount + a.saveCount })),
    followedClubUpdates: clubRaw.slice(0, 5).map((a) => summaryOf(a, now)),
    recent: eligibleOnly(recentRaw).slice(0, 5).map((a) => summaryOf(a, now)),
    placements: await eligiblePlacements(user, now, 5),
  });
});

// ---------- Placement drives ----------

/** Active placement drives the student is eligible for, earliest event first. Drives for other branches or years are not returned. */
async function eligiblePlacements(user: { branch: string; year: number | null }, now: Date, limit: number) {
  const raw = await Announcement.find({ status: 'published', category: 'placement', ...activeFilter(now) })
    .sort({ eventStart: 1 }).limit(200).populate({ path: 'club', select: 'name' }).lean();
  return raw
    .filter((a) => checkEligibility(a.eligibility, { branch: user.branch, year: user.year }).eligible)
    .slice(0, limit)
    .map((a) => summaryOf(a, now));
}

router.get('/placements', async (req, res) => {
  ok(res, await eligiblePlacements(req.user!, new Date(), 50));
});

// ---------- CampusBot ----------

const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'or', 'to', 'in', 'on', 'what', 'which', 'show', 'me', 'is', 'are', 'my', 'events', 'event', 'are', 'there', 'any', 'happening']);
const CATEGORY_WORDS: Record<string, string> = {
  hackathon: 'hackathon', hackathons: 'hackathon', workshop: 'workshop', workshops: 'workshop',
  seminar: 'seminar', seminars: 'seminar', internship: 'internship', internships: 'internship',
  placement: 'placement', placements: 'placement', competition: 'competition', competitions: 'competition',
  cultural: 'cultural', technical: 'technical', recruitment: 'club_recruitment', notice: 'notice', notices: 'notice',
};

/** Parses the question into a database filter. Only known phrases are interpreted; everything else is ignored. */
export function questionToFilter(question: string, now: Date) {
  const lower = question.toLowerCase();
  const filter: Record<string, unknown> = { status: 'published', ...activeFilter(now) };
  const categories = new Set(Object.entries(CATEGORY_WORDS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(lower)).map(([, c]) => c));
  if (categories.size) filter.category = { $in: [...categories] };
  if (/open for registration|registration open|open for|still open/.test(lower)) filter.registrationDeadline = { $gte: now };
  if (/tomorrow/.test(lower)) {
    filter.registrationDeadline = { $gte: now, $lte: new Date(now.getTime() + 2 * 86400000) };
  } else if (/this week/.test(lower)) {
    filter.eventStart = { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) };
  }
  const year = lower.match(/(first|1st|second|2nd|third|3rd|fourth|4th)[- ]year/);
  if (year) {
    const map: Record<string, number> = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4 };
    filter.$and = [...((filter.$and as unknown[]) ?? []), { $or: [{ 'eligibility.years': { $size: 0 } }, { 'eligibility.years': map[year[1]] }] }];
  }
  // Keyword terms are used only when no structured filter was found, so generic words cannot block results.
  const structured = Object.keys(filter).some((k) => k !== 'status' && k !== '$or') || Boolean(year) || Boolean(categories.size);
  const terms = structured ? [] : lower.replace(/[^a-z0-9/&+ -]/g, ' ').split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t) && !CATEGORY_WORDS[t]);
  return { filter, terms };
}

const assistantSchema = z.object({ question: z.string().trim().min(1).max(500) });
const GREETING = /^(hi+|hey+|hello+|hola|yo|sup|namaste|good (morning|afternoon|evening))[\s!.?]*$/i;
router.post('/assistant', async (req, res) => {
  const { question } = assistantSchema.parse(req.body);
  const user = req.user!;
  if (GREETING.test(question)) {
    const name = user.name.split(' ')[0] || 'there';
    return ok(res, { answer: `Hey ${name}! 👋 I'm CampusBot. Ask me about hackathons, placement drives, deadlines or clubs. For example: "Which placement drives are open?"`, records: [], provider: 'rules' });
  }
  const now = new Date();
  const { filter, terms } = questionToFilter(question, now);
  if (terms.length) {
    const regex = terms.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    filter.$and = [...((filter.$and as unknown[]) ?? []), { $or: [{ title: { $in: regex } }, { tags: { $in: regex } }, { requiredSkills: { $in: regex } }, { organizerName: { $in: regex } }, { description: { $in: regex } }] }];
  }
  if (Object.keys(filter).length === 2 && !terms.length) {
    return ok(res, { answer: 'Hmm, I am not sure what you mean yet 🤔 Try asking about hackathons, placement drives, deadlines or clubs. For example: "Which hackathons are open for registration?"', records: [], provider: 'rules' });
  }

  // Retrieve from the database, then enforce permissions: students only see records they are eligible for.
  const candidates = await Announcement.find(filter).sort({ registrationDeadline: 1, eventStart: 1 }).limit(40).populate('club', 'name').lean();
  const visible = candidates.filter((a) => user.role !== 'student' || checkEligibility(a.eligibility, { branch: user.branch, year: user.year }).eligible).slice(0, 8);
  const records = visible.map((a) => ({
    id: String(a._id),
    title: a.title,
    category: a.category,
    organizer: a.organizerName || (a.club as unknown as { name?: string })?.name || '',
    eventStart: a.eventStart?.toISOString() ?? null,
    registrationDeadline: a.registrationDeadline?.toISOString() ?? null,
    status: opportunityStatus(a, now),
    link: `/opportunities/${String(a._id)}`,
    registrationUrl: a.registrationUrl,
  }));

  if (records.length === 0) {
    return ok(res, { answer: 'Oops, I could not find anything for that one 😕 Try a different category, a date, or a club name.', records: [], provider: 'rules' });
  }

  let answer: string;
  let provider: 'llm' | 'rules' = 'rules';
  try {
    const ai = await answerQuestion(question, records);
    answer = ai.answer;
    provider = ai.provider;
  } catch {
    // The AI service is optional. Fall back to a plain summary built only from the records.
    answer = `Here you go! I found ${records.length} ${records.length === 1 ? 'match' : 'matches'} for you 🙌`;
  }
  ok(res, { answer, records, provider });
});


export default router;
