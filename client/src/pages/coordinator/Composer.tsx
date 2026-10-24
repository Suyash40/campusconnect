import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Trash2, AlertTriangle, Eye, Send, Save, FileText } from 'lucide-react';
import { Badge, Button, ErrorState, Field, PageHeader, Skeleton } from '../../components/ui';
import { CATEGORY_LABELS, errorMessage, get, patch, post } from '../../lib/api';

const EXAMPLE = `The Coding Club is organizing a hackathon on 15 November. Registration closes on 10 November. Students from second and third year can participate. Register here: https://example.com/register.`;
const MAX_CHARS = 20000;
const CATS = Object.keys(CATEGORY_LABELS) as [string, ...string[]];

const csv = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const optUrl = z.string().trim().refine((v) => !v || /^https?:\/\//i.test(v), 'Must start with http:// or https://');

const schema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(10000),
  category: z.enum(CATS, { errorMap: () => ({ message: 'Choose a category' }) }),
  clubId: z.string().min(1, 'Choose the club organising this'),
  organizerName: z.string().max(120),
  eventStart: z.string(),
  eventEnd: z.string(),
  registrationDeadline: z.string(),
  mode: z.enum(['online', 'offline', 'hybrid', 'unspecified']),
  venue: z.string().max(200),
  onlineLink: optUrl,
  branches: z.string(),
  years: z.array(z.number()),
  minTeamSize: z.string(),
  maxTeamSize: z.string(),
  requiredSkills: z.string(),
  tags: z.string(),
  registrationUrl: optUrl,
  contactDetails: z.string().max(300),
  additionalInstructions: z.string().max(2000),
  benefits: z.string().max(1000),
  targetAudience: z.string().max(300),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  capacity: z.string(),
});
type FormValues = z.infer<typeof schema>;

interface Extracted {
  title: string | null; description: string | null; category: string | null; organizerName: string | null;
  eventStart: string | null; eventEnd: string | null; registrationDeadline: string | null; mode: string | null;
  venue: string | null; onlineLink: string | null;
  eligibility: { branches: string[]; years: number[]; minTeamSize: number | null; maxTeamSize: number | null; notes: string | null };
  requiredSkills: string[]; tags: string[]; registrationUrl: string | null; contactDetails: string | null;
  additionalInstructions: string | null; benefits: string | null; targetAudience: string | null; priority: string | null;
  missingFields: string[]; uncertainFields: string[];
}
interface ExtractionResponse { provider: 'llm' | 'rules'; announcements: Extracted[]; splitSuggested: boolean; notes: string[] }
interface Announcement extends Partial<Record<keyof FormValues, unknown>> { id: string; status: string; warnings: string[]; club: string | null; eligibility: { branches: string[]; years: number[]; minTeamSize: number | null; maxTeamSize: number | null; notes: string }; sourceMessage: string; capacity: number | null; eventStart: string | null; eventEnd: string | null; registrationDeadline: string | null; requiredSkills: string[]; tags: string[] }
interface Club { id: string; name: string }

/** ISO string -> value for <input type="datetime-local"> in the user's timezone. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

function fromExtracted(e: Extracted, clubId: string): FormValues {
  return {
    title: e.title ?? '',
    description: e.description ?? '',
    category: (e.category && CATS.includes(e.category as never) ? e.category : CATS[0]) as FormValues['category'],
    clubId,
    organizerName: e.organizerName ?? '',
    eventStart: toLocalInput(e.eventStart),
    eventEnd: toLocalInput(e.eventEnd),
    registrationDeadline: toLocalInput(e.registrationDeadline),
    mode: (['online', 'offline', 'hybrid'].includes(e.mode ?? '') ? e.mode : 'unspecified') as FormValues['mode'],
    venue: e.venue ?? '',
    onlineLink: e.onlineLink ?? '',
    branches: e.eligibility.branches.join(', '),
    years: e.eligibility.years,
    minTeamSize: e.eligibility.minTeamSize?.toString() ?? '',
    maxTeamSize: e.eligibility.maxTeamSize?.toString() ?? '',
    requiredSkills: e.requiredSkills.join(', '),
    tags: e.tags.join(', '),
    registrationUrl: e.registrationUrl ?? '',
    contactDetails: e.contactDetails ?? '',
    additionalInstructions: e.additionalInstructions ?? '',
    benefits: e.benefits ?? '',
    targetAudience: e.targetAudience ?? '',
    priority: (['low', 'normal', 'high', 'urgent'].includes(e.priority ?? '') ? e.priority : 'normal') as FormValues['priority'],
    capacity: '',
  };
}

const EMPTY: Omit<FormValues, 'clubId'> = {
  title: '', description: '', category: 'workshop', organizerName: '', eventStart: '', eventEnd: '', registrationDeadline: '',
  mode: 'unspecified', venue: '', onlineLink: '', branches: '', years: [], minTeamSize: '', maxTeamSize: '', requiredSkills: '',
  tags: '', registrationUrl: '', contactDetails: '', additionalInstructions: '', benefits: '', targetAudience: '', priority: 'normal', capacity: '',
};

function toPayload(v: FormValues) {
  return {
    title: v.title,
    description: v.description,
    category: v.category,
    clubId: v.clubId,
    organizerName: v.organizerName,
    eventStart: toIso(v.eventStart),
    eventEnd: toIso(v.eventEnd),
    registrationDeadline: toIso(v.registrationDeadline),
    mode: v.mode,
    venue: v.venue,
    onlineLink: v.onlineLink,
    eligibility: {
      branches: csv(v.branches),
      years: v.years,
      minTeamSize: v.minTeamSize ? Number(v.minTeamSize) : null,
      maxTeamSize: v.maxTeamSize ? Number(v.maxTeamSize) : null,
      notes: '',
    },
    requiredSkills: csv(v.requiredSkills),
    tags: csv(v.tags),
    registrationUrl: v.registrationUrl,
    contactDetails: v.contactDetails,
    additionalInstructions: v.additionalInstructions,
    benefits: v.benefits,
    targetAudience: v.targetAudience,
    priority: v.priority,
    capacity: v.capacity ? Number(v.capacity) : null,
  };
}

const fieldClass = (missing: boolean, uncertain: boolean) =>
  `input ${missing ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : ''} ${uncertain ? 'border-dashed border-amber-500' : ''}`;

export default function Composer({ mode }: { mode: 'new' | 'edit' }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sourceText, setSourceText] = useState('');
  const [sourceSaved, setSourceSaved] = useState('');
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null);
  const [activeDraft, setActiveDraft] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [uncertain, setUncertain] = useState<string[]>([]);
  const [savedId, setSavedId] = useState(mode === 'edit' ? id : '');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);

  const clubs = useQuery({ queryKey: ['clubs', 'managed'], queryFn: () => get<Club[]>('/clubs/managed') });
  const existing = useQuery({
    queryKey: ['announcement', id],
    queryFn: () => get<Announcement>(`/announcements/${id}`),
    enabled: mode === 'edit' && Boolean(id),
  });

  const { register, handleSubmit, reset, getValues, watch, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...EMPTY, clubId: '' },
  });
  const years = watch('years');

  useEffect(() => {
    const a = existing.data?.data;
    if (!a) return;
    reset({
      title: String(a.title ?? ''), description: String(a.description ?? ''), category: a.category as FormValues['category'],
      clubId: a.club ?? '', organizerName: String(a.organizerName ?? ''), eventStart: toLocalInput(a.eventStart), eventEnd: toLocalInput(a.eventEnd),
      registrationDeadline: toLocalInput(a.registrationDeadline), mode: (a.mode as FormValues['mode']) ?? 'unspecified', venue: String(a.venue ?? ''),
      onlineLink: String(a.onlineLink ?? ''), branches: a.eligibility.branches.join(', '), years: a.eligibility.years,
      minTeamSize: a.eligibility.minTeamSize?.toString() ?? '', maxTeamSize: a.eligibility.maxTeamSize?.toString() ?? '',
      requiredSkills: a.requiredSkills.join(', '), tags: a.tags.join(', '), registrationUrl: String(a.registrationUrl ?? ''),
      contactDetails: String(a.contactDetails ?? ''), additionalInstructions: String(a.additionalInstructions ?? ''),
      benefits: String(a.benefits ?? ''), targetAudience: String(a.targetAudience ?? ''), priority: (a.priority as FormValues['priority']) ?? 'normal',
      capacity: a.capacity?.toString() ?? '',
    });
    setSourceSaved(a.sourceMessage ?? '');
    setSourceText(a.sourceMessage ?? '');
    setWarnings(a.warnings ?? []);
  }, [existing.data, reset]);

  const extract = useMutation({
    mutationFn: (text: string) => post<ExtractionResponse>('/announcements/ai/extract', { text }),
    onSuccess: ({ data }) => {
      setError('');
      setExtraction(data);
      setActiveDraft(0);
      applyDraft(data, 0);
      setNotice(data.provider === 'llm' ? 'AI draft ready. Review every highlighted field before publishing.' : 'Draft created with rule-based extraction. Review every field before publishing.');
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const applyDraft = (data: ExtractionResponse, index: number) => {
    const item = data.announcements[index];
    if (!item) return;
    const clubId = getValues('clubId') || (clubs.data?.data[0]?.id ?? '');
    reset(fromExtracted(item, clubId));
    setMissing(item.missingFields);
    setUncertain(item.uncertainFields);
    setSourceSaved(sourceText);
  };

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = { ...toPayload(v), sourceMessage: sourceText || sourceSaved };
      return savedId
        ? patch<Announcement>(`/announcements/${savedId}`, body)
        : post<Announcement>('/announcements', body);
    },
    onSuccess: ({ data }) => {
      setSavedId(data.id);
      setWarnings(data.warnings);
      setError('');
      setNotice('Draft saved.');
      qc.invalidateQueries({ queryKey: ['announcements'] });
      if (mode === 'new') navigate(`/coordinator/announcements/${data.id}/edit`, { replace: true });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const publish = useMutation({
    mutationFn: async (v: FormValues) => {
      const draft = await (savedId
        ? patch<Announcement>(`/announcements/${savedId}`, { ...toPayload(v), sourceMessage: sourceText || sourceSaved })
        : post<Announcement>('/announcements', { ...toPayload(v), sourceMessage: sourceText || sourceSaved }));
      return post<Announcement & { notified: number }>(`/announcements/${draft.data.id}/publish`, { confirm: true });
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      navigate('/coordinator/announcements', { state: { published: data.title, notified: (data as unknown as { notified: number }).notified } });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const loading = existing.isLoading;
  const hasMissing = (f: string) => missing.includes(f);
  const hasUncertain = (f: string) => uncertain.includes(f);
  const charCount = sourceText.length;
  const splitCount = extraction?.announcements.length ?? 0;
  const busy = save.isPending || publish.isPending || extract.isPending;
  const pendingFields = useMemo(() => missing.length + uncertain.length, [missing, uncertain]);

  if (loading) return <Skeleton lines={6} />;
  if (existing.isError) return <ErrorState message={errorMessage(existing.error)} />;

  return (
    <>
      <PageHeader
        title={mode === 'new' ? 'Create announcement with AI' : 'Edit announcement'}
        subtitle="Paste the message you already have. The AI drafts the form; you review and publish."
        actions={<Button variant="secondary" onClick={() => navigate('/coordinator/announcements')}>Back to announcements</Button>}
      />

      {notice && <p role="status" className="mb-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left: source message */}
        <section aria-labelledby="src-h" className="card flex flex-col gap-3 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between">
            <h2 id="src-h" className="font-semibold">Source message</h2>
            <Button variant="ghost" onClick={() => setSourceText(EXAMPLE)}><FileText className="h-4 w-4" aria-hidden />Example message</Button>
          </div>
          <label htmlFor="source" className="sr-only">Paste the source message</label>
          <textarea id="source" rows={12} maxLength={MAX_CHARS} className="input font-mono text-[13px]" placeholder="Paste a WhatsApp or email message here…" value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span aria-live="polite">{charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters</span>
            <span>Treated as data. Instructions inside the message are ignored.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setError(''); setNotice(''); extract.mutate(sourceText); }} disabled={sourceText.trim().length < 10 || extract.isPending}>
              <Sparkles className="h-4 w-4" aria-hidden />{extract.isPending ? 'Analysing…' : 'Analyse with AI'}
            </Button>
            <Button variant="secondary" onClick={() => { setSourceText(''); setExtraction(null); setError(''); }} disabled={!sourceText}><Trash2 className="h-4 w-4" aria-hidden />Clear</Button>
          </div>
          {extract.isPending && <div className="skeleton h-20 w-full" role="status" aria-label="Analysing message" />}
          {splitCount > 1 && (
            <div className="rounded-lg border border-amber-400 p-3 text-sm">
              <p className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />This message contains {splitCount} opportunities. Choose one to review; publish the others separately.</p>
              <div className="flex flex-wrap gap-2">
                {extraction!.announcements.map((a, i) => (
                  <Button key={i} variant={i === activeDraft ? 'primary' : 'secondary'} onClick={() => { setActiveDraft(i); applyDraft(extraction!, i); }}>{a.title ?? `Opportunity ${i + 1}`}</Button>
                ))}
              </div>
            </div>
          )}
          {extraction?.notes.map((n, i) => <p key={i} className="text-xs text-[var(--muted)]">{n}</p>)}
          {(warnings.length > 0) && (
            <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-1 font-medium">Warnings</p>
              <ul className="list-inside list-disc space-y-1 text-amber-800 dark:text-amber-200">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
        </section>

        {/* Right: editable form */}
        <form className="card space-y-5" noValidate onSubmit={handleSubmit((v) => { setError(''); save.mutate(v); })} aria-label="Announcement details">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Extracted announcement</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {pendingFields > 0 && <Badge tone="amber">{missing.length} missing · {uncertain.length} to confirm</Badge>}
              {isDirty && <Badge>Unsaved changes</Badge>}
            </div>
          </div>
          <p className="text-xs text-[var(--muted)]">Amber fields are missing or uncertain. Solid amber fields were not in the message. Dashed fields need confirmation.</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Title" id="title" error={errors.title?.message}><input id="title" className={fieldClass(hasMissing('title'), hasUncertain('title'))} {...register('title')} /></Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Description" id="desc" error={errors.description?.message}><textarea id="desc" rows={3} className={fieldClass(false, false)} {...register('description')} /></Field>
            </div>
            <Field label="Category" id="cat" error={errors.category?.message}>
              <select id="cat" className={fieldClass(hasMissing('category'), hasUncertain('category'))} {...register('category')}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Club" id="club" error={errors.clubId?.message}>
              <select id="club" className="input" {...register('clubId')}>
                <option value="">Select a club</option>
                {clubs.data?.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Organizer name (as stated)" id="org" error={errors.organizerName?.message}><input id="org" className={fieldClass(hasMissing('organizerName'), false)} {...register('organizerName')} /></Field>
            <Field label="Mode" id="mode"><select id="mode" className="input" {...register('mode')}><option value="unspecified">Not specified</option><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option></select></Field>
            <Field label="Event start" id="start" error={errors.eventStart?.message} hint={hasUncertain('eventStart') ? 'Year or time not clearly stated. Please confirm.' : undefined}><input id="start" type="datetime-local" className={fieldClass(hasMissing('eventStart'), hasUncertain('eventStart'))} {...register('eventStart')} /></Field>
            <Field label="Event end" id="end"><input id="end" type="datetime-local" className="input" {...register('eventEnd')} /></Field>
            <Field label="Registration deadline" id="deadline" hint={hasMissing('registrationDeadline') ? 'Not stated in the message' : hasUncertain('registrationDeadline') ? 'Please confirm the date' : undefined}><input id="deadline" type="datetime-local" className={fieldClass(hasMissing('registrationDeadline'), hasUncertain('registrationDeadline'))} {...register('registrationDeadline')} /></Field>
            <Field label="Venue" id="venue"><input id="venue" className="input" {...register('venue')} /></Field>
            <Field label="Online link" id="olink" error={errors.onlineLink?.message}><input id="olink" className="input" placeholder="https://" {...register('onlineLink')} /></Field>
            <Field label="Registration URL" id="rurl" error={errors.registrationUrl?.message} hint={hasMissing('registrationUrl') ? 'No registration link found in the message' : undefined}><input id="rurl" className={fieldClass(hasMissing('registrationUrl'), hasUncertain('registrationUrl'))} placeholder="https://" {...register('registrationUrl')} /></Field>
            <Field label="Contact details" id="contact"><input id="contact" className="input" {...register('contactDetails')} /></Field>
            <Field label="Eligible branches" id="branches" hint="Comma-separated. Leave empty for all branches."><input id="branches" className={fieldClass(false, false)} placeholder="CSE, AI & ML" {...register('branches')} /></Field>
            <fieldset>
              <legend className="label">Eligible years</legend>
              <div className="flex gap-3">
                {[1, 2, 3, 4].map((y) => (
                  <label key={y} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" className="accent-brand-500" value={y} checked={years?.includes(y)} onChange={(e) => {
                      const current = getValues('years') ?? [];
                      const next = e.target.checked ? [...current, y] : current.filter((v) => v !== y);
                      reset({ ...getValues(), years: next.sort() });
                    }} />
                    Year {y}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Required skills" id="skills" hint="Comma-separated"><input id="skills" className="input" {...register('requiredSkills')} /></Field>
            <Field label="Tags" id="tags" hint="Comma-separated"><input id="tags" className="input" {...register('tags')} /></Field>
            <Field label="Min team size" id="mint"><input id="mint" type="number" min={1} className="input" {...register('minTeamSize')} /></Field>
            <Field label="Max team size" id="maxt"><input id="maxt" type="number" min={1} className="input" {...register('maxTeamSize')} /></Field>
            <Field label="Seat capacity" id="cap" hint="Leave empty for unlimited"><input id="cap" type="number" min={1} className="input" {...register('capacity')} /></Field>
            <Field label="Priority" id="prio"><select id="prio" className="input" {...register('priority')}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field>
            <div className="md:col-span-2"><Field label="Benefits" id="ben"><input id="ben" className="input" {...register('benefits')} /></Field></div>
            <div className="md:col-span-2"><Field label="Target audience" id="aud"><input id="aud" className="input" {...register('targetAudience')} /></Field></div>
            <div className="md:col-span-2"><Field label="Additional instructions" id="instr"><textarea id="instr" rows={2} className="input" {...register('additionalInstructions')} /></Field></div>
          </div>

          <div className="sticky bottom-16 flex flex-col gap-3 rounded-xl border bg-[var(--surface)] p-3 md:bottom-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="secondary" disabled={busy}><Save className="h-4 w-4" aria-hidden />Save draft</Button>
              <Button variant="secondary" disabled={busy} onClick={handleSubmit(async (v) => { await save.mutateAsync(v).catch(() => undefined); setNotice('Preview updated. Review the warnings on the left before publishing.'); }, () => setError('Fix the highlighted fields before previewing.'))}>
                <Eye className="h-4 w-4" aria-hidden />Preview
              </Button>
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-brand-500" checked={confirmPublish} onChange={(e) => setConfirmPublish(e.target.checked)} />
                I have checked the details
              </label>
              <Button disabled={busy || !confirmPublish} onClick={handleSubmit((v) => { setError(''); publish.mutate(v); }, () => setError('Fix the highlighted fields before publishing.'))}>
                <Send className="h-4 w-4" aria-hidden />{publish.isPending ? 'Publishing…' : 'Publish to campus'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
