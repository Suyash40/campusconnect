import { Announcement, AnnouncementDoc } from '../models/index.js';
import type { RankableOpportunity } from './recommender.js';

export type OpportunityStatus = 'open' | 'upcoming' | 'completed' | 'expired';

/** Derives what a student should see for an opportunity right now. */
export function opportunityStatus(
  a: Pick<AnnouncementDoc, 'registrationDeadline' | 'eventStart' | 'eventEnd'>,
  now = new Date(),
): OpportunityStatus {
  const cutoff = a.registrationDeadline ?? a.eventStart;
  if (cutoff && cutoff < now) {
    const finished = a.eventEnd && a.eventEnd < now;
    return finished ? 'completed' : 'expired';
  }
  if (a.registrationDeadline && a.registrationDeadline >= now) return 'open';
  return 'upcoming';
}

/** Mongo filter for opportunities that are still active (not expired). */
export function activeFilter(now: Date): Record<string, unknown> {
  return {
    $or: [
      { registrationDeadline: { $gte: now } },
      { registrationDeadline: null, eventStart: { $gte: now } },
      { registrationDeadline: null, eventStart: null },
    ],
  };
}

export function toOpportunitySummary(a: AnnouncementDoc & { _id: unknown; club?: unknown }, now = new Date()) {
  return {
    id: String(a._id),
    title: a.title,
    category: a.category,
    organizerName: a.organizerName,
    clubId: a.club ? String(a.club) : null,
    mode: a.mode,
    eventStart: a.eventStart,
    eventEnd: a.eventEnd,
    registrationDeadline: a.registrationDeadline,
    tags: a.tags,
    requiredSkills: a.requiredSkills,
    eligibility: a.eligibility,
    priority: a.priority,
    capacity: a.capacity,
    registrationCount: a.registrationCount,
    status: opportunityStatus(a, now),
    publishedAt: a.publishedAt,
  };
}

export { Announcement };

/** Normalises a stored announcement (lean or hydrated) into the recommender's input shape. */
export function toRankable(a: {
  _id: unknown;
  title: string;
  category: string;
  tags?: string[];
  description?: string;
  requiredSkills?: string[];
  club?: unknown;
  publishedAt?: Date | null;
  createdAt?: Date;
  registrationDeadline?: Date | null;
  eventStart?: Date | null;
  eligibility?: { branches?: string[]; years?: number[] } | null;
}): RankableOpportunity {
  return {
    id: String(a._id),
    title: a.title,
    category: a.category,
    tags: a.tags ?? [],
    description: a.description ?? '',
    requiredSkills: a.requiredSkills ?? [],
    clubId: a.club ? String((a.club as { _id?: unknown })._id ?? a.club) : null,
    publishedAt: a.publishedAt ?? a.createdAt ?? new Date(0),
    registrationDeadline: a.registrationDeadline ?? null,
    eventStart: a.eventStart ?? null,
    eligibility: { branches: a.eligibility?.branches ?? [], years: a.eligibility?.years ?? [] },
  };
}
