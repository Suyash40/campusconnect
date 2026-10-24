import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CalendarDays, Check, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader, Skeleton } from '../../components/ui';
import { CATEGORY_LABELS, del, errorMessage, formatDate, get, patch, post, STATUS_LABELS } from '../../lib/api';

interface Summary { id: string; title: string; category: string; organizerName: string; status: keyof typeof STATUS_LABELS; registrationDeadline: string | null; eventStart: string | null; timing?: string; savedAt?: string; registeredAt?: string }

export function Registrations() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['registrations'], queryFn: () => get<Summary[]>('/registrations/mine') });
  const cancel = useMutation({
    mutationFn: (id: string) => del(`/opportunities/${id}/register`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registrations'] }),
  });
  const [msg, setMsg] = useState('');
  const items = q.data?.data ?? [];
  const upcoming = items.filter((i) => i.timing !== 'past');
  const past = items.filter((i) => i.timing === 'past');

  return (
    <>
      <PageHeader title="My registrations" subtitle="Events you have registered for, with the next steps." />
      {msg && <p role="status" className="mb-4 text-sm">{msg}</p>}
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && items.length === 0 && <EmptyState title="No registrations yet" description="Register for an opportunity and it will appear here." action={<Link to="/opportunities" className="btn-primary">Browse opportunities</Link>} />}
      <div className="grid gap-4 md:grid-cols-2">
        {[...upcoming, ...past].map((r) => (
          <article key={r.id} className="card space-y-2">
            <div className="flex flex-wrap gap-2"><Badge tone="brand">{CATEGORY_LABELS[r.category]}</Badge><Badge tone={r.timing === 'past' ? 'neutral' : 'green'}>{r.timing === 'past' ? 'Completed' : 'Upcoming'}</Badge></div>
            <h3 className="font-semibold"><Link to={`/opportunities/${r.id}`} className="hover:text-brand-600">{r.title}</Link></h3>
            <p className="text-sm text-[var(--muted)]">{r.organizerName}</p>
            <p className="text-sm"><CalendarDays className="mr-1 inline h-4 w-4" aria-hidden />Event: {formatDate(r.eventStart, true)}</p>
            {r.timing !== 'past' && (
              <Button variant="secondary" onClick={() => cancel.mutate(r.id, { onSuccess: () => setMsg('Registration cancelled.'), onError: (e) => setMsg(errorMessage(e)) })}>Cancel registration</Button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

export function Saved() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['saved'], queryFn: () => get<Summary[]>('/saved') });
  const unsave = useMutation({
    mutationFn: (id: string) => del(`/opportunities/${id}/save`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved'] }); qc.invalidateQueries({ queryKey: ['saved-ids'] }); },
  });
  const items = q.data?.data ?? [];
  return (
    <>
      <PageHeader title="Saved opportunities" subtitle="Keep track of what you want to apply for later." />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && items.length === 0 && <EmptyState title="Nothing saved yet" description="Use Save on any opportunity to keep it here." action={<Link to="/opportunities" className="btn-primary">Browse opportunities</Link>} />}
      <ul className="divide-y rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
        {items.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link to={`/opportunities/${s.id}`} className="font-medium hover:text-brand-600">{s.title}</Link>
              <p className="text-xs text-[var(--muted)]">{CATEGORY_LABELS[s.category]} · {STATUS_LABELS[s.status]} · Register by {formatDate(s.registrationDeadline)}</p>
            </div>
            <Button variant="secondary" onClick={() => unsave.mutate(s.id)} aria-label={`Remove ${s.title} from saved`}><Trash2 className="h-4 w-4" aria-hidden />Remove</Button>
          </li>
        ))}
      </ul>
    </>
  );
}

const APP_STATUSES = ['interested', 'applied', 'assessment', 'interview', 'selected', 'rejected', 'withdrawn'] as const;
const appSchema = z.object({
  company: z.string().trim().min(2, 'Enter the company name'),
  role: z.string().trim().min(2, 'Enter the role'),
  kind: z.enum(['internship', 'placement']),
  status: z.enum(APP_STATUSES),
  notes: z.string().max(2000).optional(),
});
type AppValues = z.infer<typeof appSchema>;
interface Application { id: string; company: string; role: string; kind: string; status: string; notes: string; verified?: { status: string | null; at: string | null } }

export function Applications() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['applications'], queryFn: () => get<Application[]>('/applications') });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AppValues>({ resolver: zodResolver(appSchema), defaultValues: { kind: 'internship', status: 'interested', notes: '' } });
  const create = useMutation({
    mutationFn: (v: AppValues) => post('/applications', v),
    onSuccess: () => { reset(); setOpen(false); qc.invalidateQueries({ queryKey: ['applications'] }); },
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/applications/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/applications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  });
  const items = q.data?.data ?? [];

  return (
    <>
      <PageHeader title="Application tracker" subtitle="Your own status updates. Verified updates from the college appear separately." actions={<Button onClick={() => setOpen((v) => !v)}><Plus className="h-4 w-4" aria-hidden />Add application</Button>} />
      {open && (
        <form className="card mb-6 grid gap-3 md:grid-cols-2" onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
          <Field label="Company" id="company" error={errors.company?.message}><input id="company" className="input" {...register('company')} /></Field>
          <Field label="Role" id="role" error={errors.role?.message}><input id="role" className="input" {...register('role')} /></Field>
          <Field label="Type" id="kind" error={errors.kind?.message}><select id="kind" className="input" {...register('kind')}><option value="internship">Internship</option><option value="placement">Placement</option></select></Field>
          <Field label="Status" id="status" error={errors.status?.message}><select id="status" className="input" {...register('status')}>{APP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
          <div className="md:col-span-2"><Field label="Notes" id="notes"><textarea id="notes" rows={2} className="input" {...register('notes')} /></Field></div>
          <div className="md:col-span-2 flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>Save application</Button></div>
        </form>
      )}
      {q.isLoading && <Skeleton />}
      {q.data && items.length === 0 && <EmptyState title="No applications tracked" description="Add internships and placements to track each stage." />}
      <div className="overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Your applications</caption>
          <thead className="text-xs uppercase text-[var(--muted)]"><tr><th className="p-3">Company</th><th className="p-3">Role</th><th className="p-3">Type</th><th className="p-3">Your status</th><th className="p-3">Verified update</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {items.map((a) => (
              <tr key={a.id}>
                <td className="p-3 font-medium">{a.company}</td>
                <td className="p-3">{a.role}</td>
                <td className="p-3 capitalize">{a.kind}</td>
                <td className="p-3">
                  <label className="sr-only" htmlFor={`st-${a.id}`}>Status for {a.company}</label>
                  <select id={`st-${a.id}`} className="input max-w-[160px] py-1" value={a.status} onChange={(e) => update.mutate({ id: a.id, status: e.target.value })}>
                    {APP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3">{a.verified?.status ? <Badge tone="green"><Check className="mr-1 inline h-3 w-3" aria-hidden />{a.verified.status}</Badge> : <span className="text-[var(--muted)]">Not verified</span>}</td>
                <td className="p-3 text-right"><Button variant="ghost" onClick={() => remove.mutate(a.id)} aria-label={`Delete application for ${a.company}`}><Trash2 className="h-4 w-4" aria-hidden /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">Tip: <Link to="/assistant" className="text-brand-600 inline-flex items-center gap-1"><Bot className="h-3 w-3" aria-hidden />ask CampusBot</Link> which placement drives are open this week.</p>
    </>
  );
}
