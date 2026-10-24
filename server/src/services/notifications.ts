import { Notification, User } from '../models/index.js';
import { checkEligibility } from './eligibility.js';

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  dedupeKey?: string;
}

/** Inserts notifications, skipping any whose dedupeKey already exists (duplicate-send protection). */
export async function createNotifications(items: NotificationInput[]): Promise<number> {
  if (items.length === 0) return 0;
  try {
    const docs = await Notification.insertMany(
      items.map((i) => ({
        user: i.userId,
        type: i.type,
        title: i.title,
        body: i.body ?? '',
        link: i.link ?? '',
        dedupeKey: i.dedupeKey,
      })),
      { ordered: false },
    );
    return docs.length;
  } catch (err) {
    // Duplicate-key errors are expected for already-sent notifications; count what was inserted.
    const inserted = (err as { insertedDocs?: unknown[] }).insertedDocs?.length ?? 0;
    const onlyDupes = (err as { writeErrors?: { code?: number }[] }).writeErrors?.every((e) => e.code === 11000);
    if (onlyDupes) return inserted;
    throw err;
  }
}

/** Notifies students who would be eligible and interested in a newly published announcement. */
export async function notifyNewPublication(a: {
  id: string;
  title: string;
  eligibility: { branches: string[]; years: number[] };
  clubId: string | null;
}) {
  const students = await User.find({ role: 'student', onboarded: true, 'notificationPrefs.inApp': true }, { branch: 1, year: 1, followedClubs: 1 }).lean();
  const items: NotificationInput[] = [];
  for (const s of students) {
    const followed = a.clubId !== null && (s.followedClubs ?? []).some((c) => String(c) === a.clubId);
    const eligible = checkEligibility(a.eligibility, { branch: s.branch ?? '', year: s.year ?? null }).eligible;
    if (!eligible && !followed) continue;
    items.push({
      userId: String(s._id),
      type: followed ? 'club_update' : 'new_announcement',
      title: followed ? 'New update from a club you follow' : 'New opportunity for you',
      body: a.title,
      link: `/opportunities/${a.id}`,
      dedupeKey: `publish:${a.id}:${s._id}`,
    });
  }
  return createNotifications(items);
}
