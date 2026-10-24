import { Announcement, Registration, AnnouncementDoc } from '../models/index.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { checkEligibility } from './eligibility.js';
import { createNotifications } from './notifications.js';
import { isExpired } from './recommender.js';

export async function getPublishedOpportunity(id: string, now = new Date()): Promise<AnnouncementDoc> {
  const a = await Announcement.findOne({ _id: id, status: 'published' });
  if (!a) throw notFound('Opportunity not found');
  if (isExpired({ registrationDeadline: a.registrationDeadline, eventStart: a.eventStart }, now)) {
    throw conflict('Registration is closed for this opportunity');
  }
  return a;
}

/**
 * Registers a student. Duplicate and capacity checks are enforced atomically:
 * the capacity counter is incremented with a conditional update, and rolled back
 * if the registration insert fails.
 */
export async function registerStudent(
  student: { id: string; branch: string; year: number | null },
  opportunityId: string,
  now = new Date(),
) {
  const a = await getPublishedOpportunity(opportunityId, now);
  const eligibility = checkEligibility(a.eligibility, student);
  if (!eligibility.eligible) throw forbidden(eligibility.reason);

  const existing = await Registration.findOne({ user: student.id, announcement: a._id });
  if (existing?.status === 'registered') throw conflict('You are already registered for this opportunity');

  // Reserve a seat atomically (no-op for unlimited events).
  if (a.capacity !== null) {
    const reserved = await Announcement.updateOne(
      { _id: a._id, $expr: { $lt: ['$registrationCount', '$capacity'] } },
      { $inc: { registrationCount: 1 } },
    );
    if (reserved.modifiedCount === 0) throw conflict('This opportunity is full');
  } else {
    await Announcement.updateOne({ _id: a._id }, { $inc: { registrationCount: 1 } });
  }

  try {
    if (existing) {
      existing.status = 'registered';
      await existing.save();
    } else {
      await Registration.create({ user: student.id, announcement: a._id, status: 'registered' });
    }
  } catch (err) {
    await Announcement.updateOne({ _id: a._id }, { $inc: { registrationCount: -1 } });
    throw err;
  }

  await createNotifications([{
    userId: student.id,
    type: 'registration_confirmed',
    title: 'Registration confirmed',
    body: a.title,
    link: `/registrations`,
    dedupeKey: `reg:${student.id}:${a.id}:${Date.now()}`,
  }]);
  return a;
}

export async function cancelRegistration(studentId: string, opportunityId: string) {
  const reg = await Registration.findOne({ user: studentId, announcement: opportunityId, status: 'registered' });
  if (!reg) throw badRequest('You are not registered for this opportunity');
  reg.status = 'cancelled';
  await reg.save();
  await Announcement.updateOne({ _id: opportunityId, registrationCount: { $gt: 0 } }, { $inc: { registrationCount: -1 } });
}
