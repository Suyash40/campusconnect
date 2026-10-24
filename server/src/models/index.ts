import mongoose, { Schema, HydratedDocument, Types } from 'mongoose';

export const ROLES = ['student', 'coordinator', 'admin'] as const;
export const CATEGORIES = [
  'hackathon', 'internship', 'placement', 'workshop', 'seminar', 'technical',
  'cultural', 'club_recruitment', 'competition', 'notice',
] as const;
export const APPLICATION_STATUSES = [
  'interested', 'applied', 'assessment', 'interview', 'selected', 'rejected', 'withdrawn',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: (typeof ROLES)[number];
  college: string;
  branch: string;
  year: number | null;
  interests: string[];
  skills: string[];
  preferredCategories: string[];
  followedClubs: Types.ObjectId[];
  clubIds: Types.ObjectId[];
  notificationPrefs: { inApp: boolean; email: boolean; deadlineReminders: boolean };
  onboarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnnouncement {
  title: string;
  description: string;
  category: Category;
  organizerName: string;
  club: Types.ObjectId | null;
  eventStart: Date | null;
  eventEnd: Date | null;
  registrationDeadline: Date | null;
  mode: 'online' | 'offline' | 'hybrid' | 'unspecified';
  venue: string;
  onlineLink: string;
  eligibility: { branches: string[]; years: number[]; minTeamSize: number | null; maxTeamSize: number | null; notes: string };
  requiredSkills: string[];
  tags: string[];
  registrationUrl: string;
  contactDetails: string;
  additionalInstructions: string;
  benefits: string;
  targetAudience: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  capacity: number | null;
  registrationCount: number;
  viewCount: number;
  saveCount: number;
  status: 'draft' | 'published' | 'archived';
  sourceMessage: string;
  warnings: string[];
  createdBy: Types.ObjectId;
  publishedAt: Date | null;
  archiveReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    college: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
    year: { type: Number, min: 1, max: 6, default: null },
    interests: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    preferredCategories: { type: [String], default: [] },
    followedClubs: [{ type: Schema.Types.ObjectId, ref: 'Club' }],
    clubIds: [{ type: Schema.Types.ObjectId, ref: 'Club' }],
    notificationPrefs: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      deadlineReminders: { type: Boolean, default: true },
    },
    onboarded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const clubSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '', maxlength: 2000 },
    category: { type: String, default: 'technical' },
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 10000 },
    category: { type: String, enum: CATEGORIES, required: true },
    organizerName: { type: String, default: '', trim: true },
    club: { type: Schema.Types.ObjectId, ref: 'Club', index: true },
    eventStart: { type: Date, default: null },
    eventEnd: { type: Date, default: null },
    registrationDeadline: { type: Date, default: null },
    mode: { type: String, enum: ['online', 'offline', 'hybrid', 'unspecified'], default: 'unspecified' },
    venue: { type: String, default: '' },
    onlineLink: { type: String, default: '' },
    eligibility: {
      branches: { type: [String], default: [] },
      years: { type: [Number], default: [] },
      minTeamSize: { type: Number, default: null },
      maxTeamSize: { type: Number, default: null },
      notes: { type: String, default: '' },
    },
    requiredSkills: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    registrationUrl: { type: String, default: '' },
    contactDetails: { type: String, default: '' },
    additionalInstructions: { type: String, default: '' },
    benefits: { type: String, default: '' },
    targetAudience: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    capacity: { type: Number, default: null, min: 1 },
    registrationCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    sourceMessage: { type: String, default: '', maxlength: 20000 },
    warnings: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publishedAt: { type: Date, default: null },
    archiveReason: { type: String, default: '' },
  },
  { timestamps: true },
);
announcementSchema.index({ status: 1, eventStart: 1 });
announcementSchema.index({ title: 'text', description: 'text', tags: 'text', organizerName: 'text' });

const registrationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    announcement: { type: Schema.Types.ObjectId, ref: 'Announcement', required: true },
    status: { type: String, enum: ['registered', 'cancelled'], default: 'registered' },
  },
  { timestamps: true },
);
registrationSchema.index({ user: 1, announcement: 1 }, { unique: true });
registrationSchema.index({ announcement: 1, status: 1 });

const savedSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    announcement: { type: Schema.Types.ObjectId, ref: 'Announcement', required: true },
  },
  { timestamps: true },
);
savedSchema.index({ user: 1, announcement: 1 }, { unique: true });

const applicationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, trim: true, maxlength: 120 },
    kind: { type: String, enum: ['internship', 'placement'], default: 'internship' },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'interested' },
    notes: { type: String, default: '', maxlength: 2000 },
    // Set only by coordinators/admins; kept separate from the student-managed status.
    verified: {
      status: { type: String, enum: APPLICATION_STATUSES, default: null },
      by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
    // Unique key prevents duplicate sends (e.g. the same deadline reminder twice).
    dedupeKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

const feedbackSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    announcement: { type: Schema.Types.ObjectId, ref: 'Announcement', required: true },
    value: { type: String, enum: ['more_like_this', 'not_relevant'], required: true },
  },
  { timestamps: true },
);
feedbackSchema.index({ user: 1, announcement: 1 }, { unique: true });

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    target: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const User = mongoose.model<IUser>('User', userSchema);
export const Club = mongoose.model('Club', clubSchema);
export const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);
export const Registration = mongoose.model('Registration', registrationSchema);
export const SavedOpportunity = mongoose.model('SavedOpportunity', savedSchema);
export const Application = mongoose.model('Application', applicationSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const RecommendationFeedback = mongoose.model('RecommendationFeedback', feedbackSchema);
export const AuditLog = mongoose.model('AuditLog', auditSchema);

export type UserDoc = HydratedDocument<IUser>;
export type AnnouncementDoc = HydratedDocument<IAnnouncement>;
