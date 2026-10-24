/**
 * Demo data for local development and the viva demo. Every record is clearly labelled
 * as demo data (club names end with "(Demo)"). Run with: npm run seed
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Announcement, Club, User } from '../models/index.js';

const DAY = 86400000;
const PASSWORD = 'Demo@12345';

async function main() {
  await mongoose.connect(env.MONGO_URI);
  await Promise.all([Announcement.deleteMany({ sourceMessage: /^DEMO:/ }), Club.deleteMany({ name: /\(Demo\)$/ }), User.deleteMany({ email: /@demo\.campusconnect\.test$/ })]);
  const hash = await bcrypt.hash(PASSWORD, 12);
  const now = Date.now();

  const clubs = await Club.insertMany([
    { name: 'Coding Club (Demo)', category: 'technical', tags: ['coding', 'hackathon', 'python'], description: 'Competitive programming and hackathons.' },
    { name: 'AI & ML Society (Demo)', category: 'technical', tags: ['machine learning', 'ai', 'data'], description: 'Workshops and projects in AI and ML.' },
    { name: 'Cultural Committee (Demo)', category: 'cultural', tags: ['music', 'dance'], description: 'Fests and cultural events.' },
  ]);
  const [coding, aiml, cultural] = clubs;

  const coord = await User.create({ name: 'Demo Coordinator', email: 'coordinator@demo.campusconnect.test', passwordHash: hash, role: 'coordinator', clubIds: [coding._id, aiml._id], college: 'Demo College', branch: 'CSE', year: 4, onboarded: true });
  await User.create({ name: 'Demo Student', email: 'student@demo.campusconnect.test', passwordHash: hash, role: 'student', college: 'Demo College', branch: 'AI & ML', year: 3, interests: ['machine learning', 'python'], skills: ['python', 'data analysis'], preferredCategories: ['hackathon', 'workshop'], followedClubs: [aiml._id], onboarded: true });
  await User.create({ name: 'Demo Student 2', email: 'student2@demo.campusconnect.test', passwordHash: hash, role: 'student', college: 'Demo College', branch: 'ECE', year: 2, interests: ['music'], skills: [], preferredCategories: ['cultural'], onboarded: true });
  await User.create({ name: 'Demo Admin', email: 'admin@demo.campusconnect.test', passwordHash: hash, role: 'admin', college: 'Demo College', onboarded: true });

  const base = { mode: 'offline', organizerName: '', status: 'published', publishedAt: new Date(now - 3 * DAY), createdBy: coord._id, sourceMessage: 'DEMO: seeded' } as const;
  await Announcement.insertMany([
    { ...base, title: 'AI Hackathon 2026', category: 'hackathon', club: coding._id, organizerName: 'Coding Club', description: 'A 24-hour hackathon building ML-powered tools.', eventStart: new Date(now + 12 * DAY), eventEnd: new Date(now + 13 * DAY), registrationDeadline: new Date(now + 6 * DAY), venue: 'Lab Block C', registrationUrl: 'https://example.com/hackathon', eligibility: { branches: ['CSE', 'AI & ML'], years: [2, 3], minTeamSize: 2, maxTeamSize: 4, notes: '' }, requiredSkills: ['python'], tags: ['machine learning', 'hackathon'], capacity: 60, registrationCount: 0, priority: 'high' },
    { ...base, title: 'Intro to Machine Learning Workshop', category: 'workshop', club: aiml._id, organizerName: 'AI & ML Society', description: 'Hands-on workshop on supervised learning with scikit-learn.', eventStart: new Date(now + 4 * DAY), eventEnd: new Date(now + 4 * DAY + 3 * 3600000), registrationDeadline: new Date(now + 2 * DAY), venue: 'Seminar Hall', registrationUrl: 'https://example.com/ml-workshop', eligibility: { branches: [], years: [], minTeamSize: null, maxTeamSize: null, notes: '' }, requiredSkills: [], tags: ['machine learning', 'python'], capacity: 30, registrationCount: 0 },
    { ...base, title: 'Cultural Night', category: 'cultural', club: cultural._id, organizerName: 'Cultural Committee', description: 'Music and dance performances by students.', eventStart: new Date(now + 20 * DAY), eventEnd: new Date(now + 20 * DAY + 4 * 3600000), registrationDeadline: new Date(now + 15 * DAY), venue: 'Main Auditorium', registrationUrl: 'https://example.com/cultural', eligibility: { branches: [], years: [], minTeamSize: null, maxTeamSize: null, notes: '' }, requiredSkills: [], tags: ['music', 'dance'], capacity: null, registrationCount: 0 },
    { ...base, title: 'Expired Workshop (Demo)', category: 'workshop', club: coding._id, description: 'Used to demonstrate expired-opportunity handling.', eventStart: new Date(now - 10 * DAY), eventEnd: new Date(now - 10 * DAY + 3600000), registrationDeadline: new Date(now - 12 * DAY), venue: 'Lab 2', registrationUrl: 'https://example.com/expired', eligibility: { branches: [], years: [], minTeamSize: null, maxTeamSize: null, notes: '' }, requiredSkills: [], tags: ['workshop'], capacity: null, registrationCount: 0 },
  ]);
  console.log(`Seeded demo data. Demo password for all demo accounts: ${PASSWORD}`);
  console.log('Accounts: student@demo.campusconnect.test, coordinator@demo.campusconnect.test, admin@demo.campusconnect.test');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});
