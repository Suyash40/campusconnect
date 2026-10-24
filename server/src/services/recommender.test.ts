import { describe, expect, it } from 'vitest';
import { rankOpportunities, RankableOpportunity, RankingProfile, scoreOpportunity } from './recommender.js';
import { checkEligibility } from './eligibility.js';

const now = new Date('2026-06-01T00:00:00Z');
const day = 24 * 60 * 60 * 1000;

const base: RankableOpportunity = {
  id: 'a',
  title: 'AI Hackathon',
  category: 'hackathon',
  tags: ['machine learning'],
  description: 'Build models with Python',
  requiredSkills: ['python'],
  clubId: 'club1',
  publishedAt: new Date(now.getTime() - 2 * day),
  registrationDeadline: new Date(now.getTime() + 5 * day),
  eventStart: new Date(now.getTime() + 10 * day),
  eligibility: { branches: [], years: [] },
};

const student: RankingProfile = {
  interests: ['machine learning'],
  skills: ['python'],
  preferredCategories: ['hackathon'],
  followedClubs: [],
  branch: 'AI & ML',
  year: 3,
};
const ctx = { now, notRelevant: new Set<string>(), moreLikeThis: new Set<string>() };

describe('eligibility (hard filter)', () => {
  it('passes when criteria are empty', () => {
    expect(checkEligibility({ branches: [], years: [] }, { branch: '', year: null }).eligible).toBe(true);
  });
  it('blocks a branch outside the criteria', () => {
    const r = checkEligibility({ branches: ['CSE'], years: [] }, { branch: 'ECE', year: 2 });
    expect(r.eligible).toBe(false);
  });
  it('fails closed when the profile is incomplete', () => {
    const r = checkEligibility({ branches: [], years: [2, 3] }, { branch: 'CSE', year: null });
    expect(r.eligible).toBe(false);
  });
});

describe('scoreOpportunity', () => {
  it('never marks an ineligible opportunity as eligible, even with a perfect match', () => {
    const op = { ...base, eligibility: { branches: [], years: [1] } };
    const r = scoreOpportunity(op, student, ctx);
    expect(r.eligible).toBe(false);
    expect(r.score).toBe(0);
  });

  it('excludes expired opportunities', () => {
    const op = { ...base, registrationDeadline: new Date(now.getTime() - day), eventStart: new Date(now.getTime() - day) };
    expect(scoreOpportunity(op, student, ctx).eligible).toBe(false);
  });

  it('excludes opportunities the student marked not relevant', () => {
    const r = scoreOpportunity(base, student, { ...ctx, notRelevant: new Set(['a']) });
    expect(r.eligible).toBe(false);
  });

  it('explains matched interests and skills', () => {
    const r = scoreOpportunity(base, student, ctx);
    expect(r.reasons.join(' ')).toMatch(/interests: machine learning/);
    expect(r.reasons.join(' ')).toMatch(/skills: python/);
  });

  it('flags cold-start (profile-based) ranking when the profile is empty', () => {
    const empty: RankingProfile = { ...student, interests: [], skills: [], preferredCategories: [] };
    const r = scoreOpportunity(base, empty, ctx);
    expect(r.profileBased).toBe(true);
    expect(r.eligible).toBe(true);
  });

  it('"more like this" raises the score', () => {
    const plain = scoreOpportunity(base, student, ctx).score;
    const boosted = scoreOpportunity(base, student, { ...ctx, moreLikeThis: new Set(['a']) }).score;
    expect(boosted).toBeGreaterThan(plain);
  });
});

describe('rankOpportunities', () => {
  it('ranks the better-matching opportunity first and drops ineligible ones', () => {
    const weak: RankableOpportunity = { ...base, id: 'b', title: 'Cultural fest', category: 'cultural', tags: [], description: 'Dance', requiredSkills: [], clubId: null };
    const blocked: RankableOpportunity = { ...base, id: 'c', eligibility: { branches: ['Mechanical'], years: [] } };
    const ranked = rankOpportunities([weak, blocked, base], student, ctx);
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
