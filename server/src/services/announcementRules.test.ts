import { describe, expect, it } from 'vitest';
import { computeWarnings, publishBlockers, AnnouncementLike } from './announcementRules.js';

const now = new Date('2026-06-01T00:00:00Z');
const complete: AnnouncementLike = {
  title: 'Hackathon',
  category: 'hackathon',
  registrationDeadline: new Date('2026-06-10T00:00:00Z'),
  eventStart: new Date('2026-06-15T00:00:00Z'),
  registrationUrl: 'https://example.com/register',
  onlineLink: '',
  eligibility: { branches: ['CSE'], years: [2, 3] },
  mode: 'offline',
};

describe('computeWarnings', () => {
  it('returns no warnings for a complete announcement', () => {
    expect(computeWarnings(complete, now)).toEqual([]);
  });
  it('flags missing deadline, missing date and invalid URL', () => {
    const w = computeWarnings({ ...complete, registrationDeadline: null, eventStart: null, registrationUrl: 'javascript:alert(1)' }, now);
    expect(w).toEqual(expect.arrayContaining([
      'Registration deadline is missing',
      'Event date is missing',
      'Registration URL is not a valid http(s) link',
    ]));
  });
  it('flags contradictory dates', () => {
    const w = computeWarnings({ ...complete, registrationDeadline: new Date('2026-07-01T00:00:00Z') }, now);
    expect(w).toContain('Registration deadline is after the event start');
  });
  it('flags incomplete eligibility', () => {
    const w = computeWarnings({ ...complete, eligibility: { branches: [], years: [] } }, now);
    expect(w.some((x) => x.startsWith('Eligibility'))).toBe(true);
  });
});

describe('publishBlockers', () => {
  it('blocks publication without any date', () => {
    expect(publishBlockers({ ...complete, registrationDeadline: null, eventStart: null })).not.toEqual([]);
  });
  it('blocks unsafe URL schemes', () => {
    expect(publishBlockers({ ...complete, registrationUrl: 'ftp://x.y' })).not.toEqual([]);
  });
  it('allows a complete announcement', () => {
    expect(publishBlockers(complete)).toEqual([]);
  });
});
