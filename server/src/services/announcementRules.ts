import { isSafeHttpUrl } from '../lib/urls.js';

export interface AnnouncementLike {
  title: string;
  category: string;
  registrationDeadline: Date | null | undefined;
  eventStart: Date | null | undefined;
  registrationUrl: string;
  onlineLink: string;
  eligibility: { branches?: string[] | null; years?: number[] | null } | null | undefined;
  mode: string;
}

/** Warnings shown to the coordinator. Pure so the rules are unit-testable. */
export function computeWarnings(a: AnnouncementLike, now = new Date()): string[] {
  const w: string[] = [];
  if (!a.registrationDeadline) w.push('Registration deadline is missing');
  if (!a.eventStart) w.push('Event date is missing');
  if (a.registrationDeadline && a.eventStart && a.registrationDeadline > a.eventStart) {
    w.push('Registration deadline is after the event start');
  }
  if (a.registrationDeadline && a.registrationDeadline < now) w.push('Registration deadline has already passed');
  if (!isSafeHttpUrl(a.registrationUrl)) w.push('Registration URL is not a valid http(s) link');
  if (!isSafeHttpUrl(a.onlineLink)) w.push('Online link is not a valid http(s) link');
  if ((a.eligibility?.branches ?? []).length === 0 && (a.eligibility?.years ?? []).length === 0) {
    w.push('Eligibility is not specified (open to all)');
  }
  return w;
}

/** Hard blockers that prevent publication. */
export function publishBlockers(a: AnnouncementLike): string[] {
  const b: string[] = [];
  if (a.title.trim().length < 3) b.push('Title is required');
  if (!a.registrationDeadline && !a.eventStart) b.push('Add an event date or a registration deadline before publishing');
  if (!isSafeHttpUrl(a.registrationUrl)) b.push('Registration URL must be a valid http(s) link');
  if (!isSafeHttpUrl(a.onlineLink)) b.push('Online link must be a valid http(s) link');
  return b;
}
