import { Announcement, Registration, SavedOpportunity, User } from '../models/index.js';
import { createNotifications, NotificationInput } from './notifications.js';

const HOUR = 60 * 60 * 1000;

/**
 * Sends "deadline in < 24h" reminders to students who registered for or saved an
 * opportunity. Idempotent: each (student, opportunity) pair is notified at most once
 * thanks to the dedupeKey unique index.
 */
export async function runDeadlineReminderSweep(now = new Date()): Promise<number> {
  const soon = await Announcement.find({
    status: 'published',
    registrationDeadline: { $gt: now, $lte: new Date(now.getTime() + 24 * HOUR) },
  }, { title: 1, registrationDeadline: 1 }).lean();
  if (soon.length === 0) return 0;

  const ids = soon.map((a) => a._id);
  const [regs, saves] = await Promise.all([
    Registration.find({ announcement: { $in: ids }, status: 'registered' }, { user: 1, announcement: 1 }).lean(),
    SavedOpportunity.find({ announcement: { $in: ids } }, { user: 1, announcement: 1 }).lean(),
  ]);

  const pairs = new Map<string, { userId: string; annId: string }>();
  for (const r of [...regs, ...saves]) {
    pairs.set(`${r.user}:${r.announcement}`, { userId: String(r.user), annId: String(r.announcement) });
  }
  const userIds = [...new Set([...pairs.values()].map((p) => p.userId))];
  const wantsReminder = new Set(
    (await User.find({ _id: { $in: userIds }, 'notificationPrefs.deadlineReminders': { $ne: false } }, { _id: 1 }).lean())
      .map((u) => String(u._id)),
  );

  const byId = new Map(soon.map((a) => [String(a._id), a]));
  const items: NotificationInput[] = [];
  for (const { userId, annId } of pairs.values()) {
    if (!wantsReminder.has(userId)) continue;
    const a = byId.get(annId);
    if (!a || !a.registrationDeadline) continue;
    items.push({
      userId,
      type: 'deadline_reminder',
      title: 'Registration closes within 24 hours',
      body: `${a.title} closes ${a.registrationDeadline.toUTCString()}`,
      link: `/opportunities/${annId}`,
      dedupeKey: `deadline:${userId}:${annId}`,
    });
  }
  return createNotifications(items);
}
