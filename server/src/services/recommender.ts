import { checkEligibility } from './eligibility.js';

/**
 * Transparent hybrid recommender. No model is trained: every component is an
 * explicit, documented heuristic so the ranking can be explained and tested.
 *
 * Hard filters (applied first, never overridden by score):
 *   - opportunity must be published and not expired
 *   - student must satisfy mandatory eligibility (branch / year)
 *   - opportunity must not be marked "not relevant" by this student
 *
 * Score (each component in [0, 1], weighted sum in [0, 1]):
 *   interest   0.30  overlap of student interests with title/tags/category/description
 *   skill      0.20  overlap of student skills with required skills (neutral 0.5 if none required)
 *   category   0.15  opportunity category is in the student's preferred categories
 *   recency    0.10  exp(-ageDays / 30) since publication
 *   deadline   0.15  closer upcoming registration deadline (within 14 days) scores higher
 *   club       0.10  organizer club is followed by the student
 * Explicit feedback: "more_like_this" adds +0.10 (capped at 1).
 *
 * Cold start: with no interests, skills, or preferred categories, the score is
 * based on recency and deadline only, and the explanation says so.
 */

export const WEIGHTS = { interest: 0.3, skill: 0.2, category: 0.15, recency: 0.1, deadline: 0.15, club: 0.1 } as const;
export const MORE_LIKE_THIS_BOOST = 0.1;

export interface RankableOpportunity {
  id: string;
  title: string;
  category: string;
  tags: string[];
  description: string;
  requiredSkills: string[];
  clubId: string | null;
  publishedAt: Date;
  registrationDeadline: Date | null;
  eventStart: Date | null;
  eligibility: { branches: string[]; years: number[] };
}

export interface RankingProfile {
  interests: string[];
  skills: string[];
  preferredCategories: string[];
  followedClubs: string[];
  branch: string;
  year: number | null;
}

export interface RankingContext {
  now: Date;
  /** Announcement IDs the student marked "not relevant". */
  notRelevant: Set<string>;
  moreLikeThis: Set<string>;
}

export interface Recommendation {
  id: string;
  score: number;
  eligible: boolean;
  profileBased: boolean;
  reasons: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const norm = (s: string) => s.trim().toLowerCase();

function overlapRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const set = new Set(b.map(norm));
  const hits = a.filter((x) => set.has(norm(x))).length;
  return Math.min(1, hits / Math.min(a.length, b.length));
}

function matchedTerms(a: string[], text: string): string[] {
  const lower = text.toLowerCase();
  return a.filter((x) => x && lower.includes(norm(x)));
}

export function deadlineScore(deadline: Date | null, now: Date): number {
  if (!deadline) return 0.3; // unknown deadline: neutral-low
  const days = (deadline.getTime() - now.getTime()) / DAY_MS;
  if (days < 0) return 0;
  if (days > 14) return 0.2;
  return 1 - days / 14 * 0.5; // 1.0 at the deadline, 0.5 at 14 days out
}

export function isExpired(op: Pick<RankableOpportunity, 'registrationDeadline' | 'eventStart'>, now: Date): boolean {
  const cutoff = op.registrationDeadline ?? op.eventStart;
  return cutoff !== null && cutoff.getTime() < now.getTime();
}

export function scoreOpportunity(
  op: RankableOpportunity,
  profile: RankingProfile,
  ctx: RankingContext,
): Recommendation {
  const reasons: string[] = [];
  const text = `${op.title} ${op.description}`;

  // Hard filters
  if (ctx.notRelevant.has(op.id)) {
    return { id: op.id, score: 0, eligible: false, profileBased: false, reasons: ['Hidden: marked not relevant'] };
  }
  const eligible = checkEligibility(op.eligibility, profile);
  if (!eligible.eligible) {
    return { id: op.id, score: 0, eligible: false, profileBased: false, reasons: [eligible.reason] };
  }
  if (isExpired(op, ctx.now)) {
    return { id: op.id, score: 0, eligible: false, profileBased: false, reasons: ['Expired'] };
  }

  const interestHits = matchedTerms(profile.interests, `${text} ${op.tags.join(' ')} ${op.category}`);
  const interest = profile.interests.length ? Math.min(1, interestHits.length / 2) : 0;

  const skillHits = matchedTerms(profile.skills, op.requiredSkills.join(' ') || '');
  const skill = op.requiredSkills.length === 0 ? 0.5 : overlapRatio(profile.skills, op.requiredSkills);

  const category = profile.preferredCategories.includes(op.category) ? 1 : 0;

  const ageDays = Math.max(0, (ctx.now.getTime() - op.publishedAt.getTime()) / DAY_MS);
  const recency = Math.exp(-ageDays / 30);

  const deadline = deadlineScore(op.registrationDeadline, ctx.now);

  const followed = op.clubId !== null && profile.followedClubs.includes(op.clubId);
  const club = followed ? 1 : 0;

  let score =
    WEIGHTS.interest * interest +
    WEIGHTS.skill * skill +
    WEIGHTS.category * category +
    WEIGHTS.recency * recency +
    WEIGHTS.deadline * deadline +
    WEIGHTS.club * club;

  if (ctx.moreLikeThis.has(op.id)) score = Math.min(1, score + MORE_LIKE_THIS_BOOST);

  if (interestHits.length) reasons.push(`Matches your interests: ${interestHits.slice(0, 3).join(', ')}`);
  if (skillHits.length) reasons.push(`Uses your skills: ${skillHits.slice(0, 3).join(', ')}`);
  if (category) reasons.push(`In your preferred category`);
  if (followed) reasons.push('From a club you follow');
  if (op.eligibility.branches.length || op.eligibility.years.length) reasons.push('Open to your branch and year');
  if (deadline >= 0.5 && op.registrationDeadline) reasons.push('Registration closes soon');

  const profileBased = profile.interests.length + profile.skills.length + profile.preferredCategories.length === 0;
  if (profileBased) reasons.push('Ranked by recency and deadline. Add interests to personalise.');
  if (reasons.length === 0) reasons.push('Newly published and open to your profile');

  return { id: op.id, score: Math.round(score * 1000) / 1000, eligible: true, profileBased, reasons };
}

export function rankOpportunities(
  ops: RankableOpportunity[],
  profile: RankingProfile,
  ctx: RankingContext,
  limit = 10,
): Recommendation[] {
  return ops
    .map((op) => scoreOpportunity(op, profile, ctx))
    .filter((r) => r.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

