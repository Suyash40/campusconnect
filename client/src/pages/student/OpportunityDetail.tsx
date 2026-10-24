import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, ThumbsDown, ThumbsUp, MapPin, Clock } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, ErrorState, Skeleton } from '../../components/ui';
import { CATEGORY_LABELS, del, errorMessage, formatDate, get, post, STATUS_LABELS } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Detail {
  id: string; title: string; category: string; organizerName: string; description: string; mode: string;
  eventStart: string | null; eventEnd: string | null; registrationDeadline: string | null; venue: string; onlineLink: string;
  registrationUrl: string; contactDetails: string; additionalInstructions: string; benefits: string; targetAudience: string;
  eligibility: { branches: string[]; years: number[]; minTeamSize: number | null; maxTeamSize: number | null; notes: string };
  requiredSkills: string[]; tags: string[]; status: keyof typeof STATUS_LABELS; eligibleForYou: boolean; eligibilityReason: string | null;
  capacity: number | null; registrationCount: number; isRegistered: boolean; isSaved: boolean; feedback: string | null;
  club: { id: string; name: string } | null; registrationOpen: boolean;
  related: { id: string; title: string; category: string; registrationDeadline: string | null }[];
}

export default function OpportunityDetail() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const q = useQuery({ queryKey: ['opportunity', id], queryFn: () => get<Detail>(`/opportunities/${id}`), enabled: Boolean(id) });
  const o = q.data?.data;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['opportunity', id] });
    qc.invalidateQueries({ queryKey: ['saved-ids'] });
    qc.invalidateQueries({ queryKey: ['registrations'] });
  };

  const register = useMutation({
    mutationFn: () => post(`/opportunities/${id}/register`),
    onSuccess: () => { setMessage('Registration confirmed. It now appears in My registrations.'); refresh(); },
    onError: (e) => setMessage(errorMessage(e)),
  });
  const unregister = useMutation({
    mutationFn: () => del(`/opportunities/${id}/register`),
    onSuccess: () => { setMessage('Your registration was cancelled.'); refresh(); },
    onError: (e) => setMessage(errorMessage(e)),
  });
  const toggleSave = useMutation({
    mutationFn: () => (o?.isSaved ? del(`/opportunities/${id}/save`) : post(`/opportunities/${id}/save`)),
    onSuccess: refresh,
    onError: (e) => setMessage(errorMessage(e)),
  });
  const feedback = useMutation({
    mutationFn: (value: 'more_like_this' | 'not_relevant') => post('/recommendations/feedback', { announcementId: id, value }),
    onSuccess: (_d, value) => setMessage(value === 'more_like_this' ? 'Thanks. We will show more like this.' : 'Thanks. You will not see this opportunity in recommendations.'),
    onError: (e) => setMessage(errorMessage(e)),
  });

  if (q.isLoading) return <Skeleton lines={6} />;
  if (q.isError || !o) return <ErrorState message={errorMessage(q.error) || 'Opportunity not found'} />;

  const isStudent = user?.role === 'student';
  const canRegister = isStudent && o.registrationOpen && o.eligibleForYou && !o.isRegistered;
  const full = o.capacity !== null && o.registrationCount >= o.capacity;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <article className="space-y-6 xl:col-span-2">
        <header>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{CATEGORY_LABELS[o.category] ?? o.category}</Badge>
            <Badge tone={o.status === 'open' ? 'green' : o.status === 'expired' ? 'red' : 'blue'}>{STATUS_LABELS[o.status]}</Badge>
            {isStudent && !o.eligibleForYou && <Badge tone="amber">Not eligible</Badge>}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{o.title}</h1>
          <p className="text-[var(--muted)]">Organised by {o.club?.name ?? o.organizerName ?? 'Campus club'}</p>
        </header>

        <section className="card">
          <h2 className="mb-2 font-semibold">About</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{o.description || 'No description provided.'}</p>
          {o.additionalInstructions && <><h3 className="mb-1 mt-4 font-medium">Instructions</h3><p className="whitespace-pre-line text-sm">{o.additionalInstructions}</p></>}
          {o.benefits && <><h3 className="mb-1 mt-4 font-medium">Benefits</h3><p className="text-sm">{o.benefits}</p></>}
          {o.targetAudience && <><h3 className="mb-1 mt-4 font-medium">Target audience</h3><p className="text-sm">{o.targetAudience}</p></>}
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Eligibility</h2>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>Branches: {o.eligibility.branches.length ? o.eligibility.branches.join(', ') : 'All branches'}</li>
            <li>Academic year: {o.eligibility.years.length ? o.eligibility.years.map((y) => `Year ${y}`).join(', ') : 'All years'}</li>
            {(o.eligibility.minTeamSize || o.eligibility.maxTeamSize) && <li>Team size: {o.eligibility.minTeamSize ?? 1} to {o.eligibility.maxTeamSize ?? o.eligibility.minTeamSize}</li>}
            {o.requiredSkills.length > 0 && <li>Skills: {o.requiredSkills.join(', ')}</li>}
            {o.eligibility.notes && <li>{o.eligibility.notes}</li>}
          </ul>
          {isStudent && !o.eligibleForYou && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{o.eligibilityReason}</p>}
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Contact and links</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-[var(--muted)]">Contact</dt><dd>{o.contactDetails || 'Not provided'}</dd></div>
            <div><dt className="text-[var(--muted)]">Venue</dt><dd className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{o.venue || 'Not provided'}</dd></div>
            {o.onlineLink && <div><dt className="text-[var(--muted)]">Online link</dt><dd><a className="text-brand-600 underline" href={o.onlineLink} target="_blank" rel="noopener noreferrer">Join link <ExternalLink className="inline h-3 w-3" aria-hidden /></a></dd></div>}
            {o.registrationUrl && <div><dt className="text-[var(--muted)]">Official registration</dt><dd><a className="text-brand-600 underline" href={o.registrationUrl} target="_blank" rel="noopener noreferrer">Open registration form <ExternalLink className="inline h-3 w-3" aria-hidden /></a></dd></div>}
          </dl>
        </section>

        {o.related.length > 0 && (
          <section className="card">
            <h2 className="mb-2 font-semibold">Related opportunities</h2>
            <ul className="divide-y text-sm" style={{ borderColor: 'var(--border)' }}>
              {o.related.map((r) => <li key={r.id} className="py-2"><Link className="font-medium hover:text-brand-600" to={`/opportunities/${r.id}`}>{r.title}</Link></li>)}
            </ul>
          </section>
        )}
      </article>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="card space-y-4">
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-brand-600" aria-hidden /><span><span className="text-[var(--muted)]">Event:</span> {formatDate(o.eventStart, true)}</span></p>
            <p className="pl-6"><span className="text-[var(--muted)]">Ends:</span> {formatDate(o.eventEnd, true)}</p>
            <p className="pl-6"><span className="text-[var(--muted)]">Register by:</span> {formatDate(o.registrationDeadline, true)}</p>
            {o.capacity && <p className="pl-6"><span className="text-[var(--muted)]">Seats:</span> {o.registrationCount} of {o.capacity} taken</p>}
          </div>

          {message && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">{message}</p>}

          {isStudent && (
            o.isRegistered ? (
              <Button variant="secondary" className="w-full" onClick={() => unregister.mutate()} disabled={unregister.isPending}>Cancel my registration</Button>
            ) : (
              <Button className="w-full py-2.5" disabled={!canRegister || register.isPending || full} onClick={() => register.mutate()}>
                {full ? 'Event is full' : !o.registrationOpen ? 'Registration closed' : !o.eligibleForYou ? 'Not eligible' : register.isPending ? 'Registering…' : 'Register for this opportunity'}
              </Button>
            )
          )}
          {isStudent && (
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => toggleSave.mutate()} disabled={toggleSave.isPending}>{o.isSaved ? 'Saved ✓' : 'Save'}</Button>
              <Button variant="ghost" aria-label="More like this" onClick={() => feedback.mutate('more_like_this')}><ThumbsUp className="h-4 w-4" aria-hidden /></Button>
              <Button variant="ghost" aria-label="Not relevant" onClick={() => feedback.mutate('not_relevant')}><ThumbsDown className="h-4 w-4" aria-hidden /></Button>
            </div>
          )}
          {o.registrationUrl && <a className="btn-secondary w-full" href={o.registrationUrl} target="_blank" rel="noopener noreferrer">Official form <ExternalLink className="h-4 w-4" aria-hidden /></a>}
        </div>
      </aside>
    </div>
  );
}
