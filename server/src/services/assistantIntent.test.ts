import { describe, expect, it } from 'vitest';
import { parseDate, smallTalkReply } from './assistantIntent.js';

// 30 October 2026, 10:00 in India
const now = new Date('2026-10-30T04:30:00Z');

describe('parseDate', () => {
  it('reads day-first, month-first and day/month phrasings as the same IST day', () => {
    for (const q of ['is there a drive on 20th of november', 'any drive on nov 20?', 'drive on 20/11']) {
      const day = parseDate(q, now);
      expect(day?.label).toBe('20 November 2026');
      expect(day?.start.toISOString()).toBe('2026-11-19T18:30:00.000Z');
    }
  });

  it('keeps today as a valid date', () => {
    expect(parseDate('drive on 30 october', now)?.label).toBe('30 October 2026');
  });

  it('rolls a date that has passed this year over to next year', () => {
    expect(parseDate('events on 1 october', now)?.label).toBe('1 October 2027');
  });

  it('ignores dates that do not exist and numbers that are not dates', () => {
    expect(parseDate('drive on 31 february', now)).toBeNull();
    expect(parseDate('for 1-2 years students', now)).toBeNull();
    expect(parseDate('which hackathons are open', now)).toBeNull();
  });
});

describe('smallTalkReply', () => {
  it('answers chit-chat in full', () => {
    expect(smallTalkReply('how are you?', 'Demo')).toMatch(/doing great/);
    expect(smallTalkReply('Thanks!', 'Demo')).toMatch(/welcome/);
  });

  it('greets by first name', () => {
    expect(smallTalkReply('hi', 'Demo')).toMatch(/^Hey Demo!/);
  });

  it('never replaces a real question with small talk', () => {
    expect(smallTalkReply('thanks, which hackathons are open?', 'Demo')).toBeNull();
    expect(smallTalkReply('which hackathons are open?', 'Demo')).toBeNull();
  });
});
