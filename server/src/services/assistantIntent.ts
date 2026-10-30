/**
 * Intent helpers for CampusBot: chit-chat replies and calendar dates in a question.
 * Pure functions, so they can be tested without a database.
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_LOOKUP: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b`, 'i');
const MONTH_FIRST = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i');
// Day/month only: "20/11" or "20-11". Single digits with a dash are skipped so "1-2 years" is not a date.
const NUMERIC_DAY_MONTH = /\b(\d{1,2})\/(\d{1,2})\b|\b(\d{2})-(\d{2})\b/;

const DAY_MS = 86400000;
const IST_OFFSET_MS = 330 * 60000;

export interface DayWindow {
  start: Date;
  end: Date;
  label: string;
}

/** Midnight in India Standard Time for a calendar date, or null when the date does not exist (for example 31 February). */
function istMidnight(year: number, month: number, day: number): Date | null {
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return new Date(utc.getTime() - IST_OFFSET_MS);
}

/**
 * Finds a calendar day in the question, for example "20th of November", "nov 20" or "20/11",
 * and returns its window in IST. A date that has already passed this year means next year.
 */
export function parseDate(question: string, now: Date): DayWindow | null {
  let day: number;
  let month: number | undefined;
  let m = question.match(DAY_FIRST);
  if (m) {
    day = Number(m[1]);
    month = MONTH_LOOKUP[m[2].slice(0, 3).toLowerCase()];
  } else if ((m = question.match(MONTH_FIRST))) {
    month = MONTH_LOOKUP[m[1].slice(0, 3).toLowerCase()];
    day = Number(m[2]);
  } else if ((m = question.match(NUMERIC_DAY_MONTH))) {
    day = Number(m[1] ?? m[3]);
    month = Number(m[2] ?? m[4]);
  } else {
    return null;
  }
  if (!month || !day) return null;

  let year = new Date(now.getTime() + IST_OFFSET_MS).getUTCFullYear();
  let start = istMidnight(year, month, day);
  if (!start) return null;
  if (start.getTime() + DAY_MS <= now.getTime()) {
    year += 1;
    start = istMidnight(year, month, day);
    if (!start) return null;
  }
  return { start, end: new Date(start.getTime() + DAY_MS), label: `${day} ${MONTH_NAMES[month - 1]} ${year}` };
}

const SMALL_TALK: { pattern: RegExp; reply: (firstName: string) => string }[] = [
  {
    pattern: /^(hi+|hey+|hello+|hola|yo|sup|namaste|good (morning|afternoon|evening))$/i,
    reply: (name) => `Hey ${name}! 👋 I'm CampusBot. Ask me about hackathons, placement drives, deadlines or clubs. For example: "Which placement drives are open?"`,
  },
  {
    pattern: /^(how are (you|u)|how r u|how'?s it going|how do you do|what'?s up)$/i,
    reply: () => "I'm doing great, thanks for asking! 😊 Ready to help you find campus opportunities. What are you looking for?",
  },
  {
    pattern: /^(who are you|what are you|what'?s your name|what is your name)$/i,
    reply: () => "I'm CampusBot, the campus assistant for CampusConnect. I answer from real campus records, like drives, hackathons and deadlines. 🤖",
  },
  {
    pattern: /^(help|what can you do|how do i use you)$/i,
    reply: () => 'I can find open hackathons, placement drives, workshops, deadlines and clubs, and check a specific date. Try "Is there a drive on 20th of November?" 📅',
  },
  {
    pattern: /^(thanks|thank you|thx|ty|thanks a lot)$/i,
    reply: () => "You're welcome! 🙌 Anything else you want to look up?",
  },
  {
    pattern: /^(bye|goodbye|see you|cya|good night)$/i,
    reply: () => 'Bye for now! 👋 Good luck with your applications.',
  },
];

/** Friendly replies for chit-chat. Only a whole message matches, so a real question is never answered with small talk. */
export function smallTalkReply(question: string, firstName: string): string | null {
  const text = question.trim().replace(/[!.?]+$/, '').trim();
  const match = SMALL_TALK.find(({ pattern }) => pattern.test(text));
  return match ? match.reply(firstName) : null;
}
