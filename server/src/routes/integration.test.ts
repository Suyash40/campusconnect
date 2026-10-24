/**
 * End-to-end API tests against a real MongoDB. Skipped unless MONGO_URI is set, for example:
 *   MONGO_URI=mongodb://127.0.0.1:27017/campusconnect_test npm test
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';
import { Announcement, Club, Registration, User } from '../models/index.js';
import { signToken } from '../middleware/auth.js';

const hasDb = Boolean(process.env.MONGO_URI);
const app = createApp();

describe.skipIf(!hasDb)('API integration', () => {
  let coordToken = '';
  let studentToken = '';
  let studentCseId = '';
  let clubId = '';
  let announcementId = '';

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI!);
    await Promise.all([User.deleteMany({}), Club.deleteMany({}), Announcement.deleteMany({}), Registration.deleteMany({})]);
    const hash = await bcrypt.hash('Password123', 10);
    const club = await Club.create({ name: 'Test Club' });
    clubId = String(club._id);
    const coord = await User.create({ name: 'Coord', email: 'c@test.dev', passwordHash: hash, role: 'coordinator', clubIds: [club._id] });
    const student = await User.create({ name: 'CSE Student', email: 's@test.dev', passwordHash: hash, role: 'student', branch: 'CSE', year: 3, onboarded: true });
    studentCseId = String(student._id);
    await User.create({ name: 'ECE Student', email: 'e@test.dev', passwordHash: hash, role: 'student', branch: 'ECE', year: 3, onboarded: true });
    coordToken = signToken(String(coord._id));
    studentToken = signToken(String(student._id));
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it('rejects a student calling a coordinator endpoint', async () => {
    const res = await request(app).post('/api/announcements').set('authorization', `Bearer ${studentToken}`).send({});
    expect(res.status).toBe(403);
  });

  it('refuses publication until the required fields and confirmation are present', async () => {
    const created = await request(app).post('/api/announcements').set('authorization', `Bearer ${coordToken}`)
      .send({ title: 'Robotics Workshop', category: 'workshop', clubId, eligibility: { branches: ['CSE'], years: [] } });
    expect(created.status).toBe(201);
    announcementId = created.body.data.id;
    const noConfirm = await request(app).post(`/api/announcements/${announcementId}/publish`).set('authorization', `Bearer ${coordToken}`).send({});
    expect(noConfirm.status).toBe(400);
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    await request(app).patch(`/api/announcements/${announcementId}`).set('authorization', `Bearer ${coordToken}`)
      .send({ registrationDeadline: future, registrationUrl: 'https://example.com/r' });
    const published = await request(app).post(`/api/announcements/${announcementId}/publish`).set('authorization', `Bearer ${coordToken}`).send({ confirm: true });
    expect(published.status).toBe(200);
  });

  it('blocks ineligible students and prevents duplicate registrations', async () => {
    const ece = await request(app).post('/api/auth/login').send({ email: 'e@test.dev', password: 'Password123' });
    const blocked = await request(app).post(`/api/opportunities/${announcementId}/register`).set('authorization', `Bearer ${ece.body.data.token}`);
    expect(blocked.status).toBe(403);

    const first = await request(app).post(`/api/opportunities/${announcementId}/register`).set('authorization', `Bearer ${studentToken}`);
    expect(first.status).toBe(201);
    const duplicate = await request(app).post(`/api/opportunities/${announcementId}/register`).set('authorization', `Bearer ${studentToken}`);
    expect(duplicate.status).toBe(409);
    expect(await Registration.countDocuments({ user: studentCseId, status: 'registered' })).toBe(1);
  });

  it('does not expose drafts to students', async () => {
    const draft = await Announcement.create({ title: 'Secret draft', category: 'notice', club: clubId, createdBy: (await User.findOne({ role: 'coordinator' }))!._id, status: 'draft' });
    const res = await request(app).get(`/api/opportunities/${draft._id}`).set('authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(404);
  });
});
