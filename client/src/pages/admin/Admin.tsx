import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader, Pagination, Skeleton } from '../../components/ui';
import { CATEGORY_LABELS, errorMessage, formatDate, get, patch, post } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Analytics {
  totals: { users: number; publishedAnnouncements: number; activeClubs: number; upcomingEvents: number };
  registrationTrend: { month: string; registrations: number }[];
  categories: { category: string; opportunities: number; registrations: number }[];
  moderationQueue: number;
}
interface Club { id: string; name: string; description: string; category: string; tags: string[] }

export function AdminDashboard() {
  const q = useQuery({ queryKey: ['admin', 'analytics'], queryFn: () => get<Analytics>('/admin/analytics') });
  const d = q.data?.data;
  return (
    <>
      <PageHeader title="Administration" subtitle="College-wide engagement, moderation and user management." />
      {q.isLoading && <Skeleton lines={4} />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[['Registered users', d.totals.users], ['Published announcements', d.totals.publishedAnnouncements], ['Active clubs', d.totals.activeClubs], ['Upcoming events', d.totals.upcomingEvents]].map(([l, v]) => (
              <div key={String(l)} className="card"><p className="text-xs uppercase tracking-wide text-[var(--muted)]">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
            ))}
          </div>
          <div className="mt-4 card flex items-center justify-between">
            <p className="text-sm">Moderation queue: <strong>{d.moderationQueue}</strong> published announcement(s) with warnings.</p>
            <a href="/admin/moderation" className="btn-secondary">Review</a>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="card" aria-labelledby="trend"><h2 id="trend" className="mb-3 font-semibold">Registration trend (6 months)</h2>
              {d.registrationTrend.length === 0 ? <p className="text-sm text-[var(--muted)]">No registrations in this period.</p> : (
                <div className="h-64" role="img" aria-label="Line chart of monthly registrations"><ResponsiveContainer width="100%" height="100%"><LineChart data={d.registrationTrend.map((t) => ({ month: t.month, Registrations: t.registrations }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Line dataKey="Registrations" stroke="#F97316" /></LineChart></ResponsiveContainer></div>
              )}
            </section>
            <section className="card" aria-labelledby="cats"><h2 id="cats" className="mb-3 font-semibold">Popular categories</h2>
              {d.categories.length === 0 ? <p className="text-sm text-[var(--muted)]">No published opportunities yet.</p> : (
                <div className="h-64" role="img" aria-label="Bar chart of registrations by category"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.categories.map((c) => ({ name: CATEGORY_LABELS[c.category] ?? c.category, Registrations: c.registrations }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="Registrations" fill="#6366F1" /></BarChart></ResponsiveContainer></div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

interface UserRow { id: string; name: string; email: string; role: 'student' | 'coordinator' | 'admin'; branch: string; year: number | null; clubIds: string[] }

export function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const users = useQuery({ queryKey: ['admin', 'users', search, page], queryFn: () => get<UserRow[]>(`/admin/users?page=${page}&limit=15${search ? `&search=${encodeURIComponent(search)}` : ''}`), placeholderData: (p) => p });
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: () => get<Club[]>('/clubs') });
  const save = useMutation({
    mutationFn: (u: UserRow & { clubIds: string[] }) => patch(`/admin/users/${u.id}/role`, { role: u.role, clubIds: u.role === 'coordinator' ? u.clubIds : [] }),
    onSuccess: () => { setEditing(null); setErr(''); setMsg('Role updated and recorded in the audit log.'); qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
    onError: (e) => setErr(errorMessage(e)),
  });
  return (
    <>
      <PageHeader title="Users and roles" subtitle="Assign coordinator accounts to clubs. Admin roles are granted here only." />
      {msg && <p role="status" className="mb-4 text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}
      {err && <p role="alert" className="mb-4 text-sm text-red-600">{err}</p>}
      <label htmlFor="usearch" className="sr-only">Search users</label>
      <input id="usearch" className="input mb-4 max-w-sm" placeholder="Search by name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      {users.isLoading && <Skeleton />}
      {users.isError && <ErrorState message={errorMessage(users.error)} onRetry={() => users.refetch()} />}
      {users.data && users.data.data.length === 0 && <EmptyState title="No users found" />}
      {users.data && users.data.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Users</caption>
            <thead className="text-xs uppercase text-[var(--muted)]"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Branch / year</th><th className="p-3">Role</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {users.data.data.map((u) => (
                <tr key={u.id}>
                  <td className="p-3 font-medium">{u.name}{u.id === me?.id && <span className="ml-2 text-xs text-[var(--muted)]">(you)</span>}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.branch || '—'}{u.year ? ` · Y${u.year}` : ''}</td>
                  <td className="p-3"><Badge tone={u.role === 'admin' ? 'red' : u.role === 'coordinator' ? 'blue' : 'neutral'}>{u.role}</Badge></td>
                  <td className="p-3 text-right"><Button variant="secondary" onClick={() => setEditing({ ...u, clubIds: u.clubIds ?? [] })}>Change role</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={Number(users.data?.meta?.totalPages ?? 1)} onChange={setPage} />

      {editing && (
        <div className="card mt-6 max-w-xl space-y-4" role="region" aria-label={`Change role for ${editing.name}`}>
          <h2 className="font-semibold">Change role: {editing.name}</h2>
          <Field label="Role" id="role">
            <select id="role" className="input" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as UserRow['role'] })}>
              <option value="student">Student</option><option value="coordinator">Coordinator</option><option value="admin">Admin</option>
            </select>
          </Field>
          {editing.role === 'coordinator' && (
            <fieldset>
              <legend className="label">Clubs this coordinator manages</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {clubs.data?.data.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-brand-500" checked={editing.clubIds.includes(c.id)} onChange={(e) => setEditing({ ...editing, clubIds: e.target.checked ? [...editing.clubIds, c.id] : editing.clubIds.filter((x) => x !== c.id) })} />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex gap-2">
            <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>Save</Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminClubs() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['clubs'], queryFn: () => get<Club[]>('/clubs') });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const create = useMutation({
    mutationFn: () => post('/clubs', { name, description, category: 'technical', tags: [] }),
    onSuccess: () => { setName(''); setDescription(''); setErr(''); qc.invalidateQueries({ queryKey: ['clubs'] }); },
    onError: (e) => setErr(errorMessage(e)),
  });
  return (
    <>
      <PageHeader title="Clubs" subtitle="Create clubs. Assign coordinators under Users and roles." />
      <form className="card mb-6 grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) create.mutate(); else setErr('Club name must be at least 2 characters'); }} noValidate>
        <Field label="Club name" id="cname"><input id="cname" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description" id="cdesc"><input id="cdesc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Button type="submit" disabled={create.isPending}>Add club</Button>
      </form>
      {err && <p role="alert" className="mb-4 text-sm text-red-600">{err}</p>}
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      <ul className="grid gap-3 md:grid-cols-2">{q.data?.data.map((c) => <li key={c.id} className="card"><p className="font-medium">{c.name}</p><p className="text-sm text-[var(--muted)]">{c.description || 'No description'}</p></li>)}</ul>
    </>
  );
}

export function AdminModeration() {
  const q = useQuery({ queryKey: ['admin', 'moderation'], queryFn: () => get<{ id: string; title: string; club: string; warnings: string[]; publishedAt: string }[]>('/admin/moderation') });
  return (
    <>
      <PageHeader title="Moderation queue" subtitle="Published announcements that still carry warnings. Coordinators should correct or archive them." />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.data.length === 0 && <EmptyState title="Queue is clear" description="No published announcements have open warnings." />}
      <ul className="space-y-3">
        {q.data?.data.map((a) => (
          <li key={a.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{a.title}</p><span className="text-xs text-[var(--muted)]">{a.club} · {formatDate(a.publishedAt)}</span></div>
            <ul className="mt-2 list-inside list-disc text-sm text-amber-800 dark:text-amber-200">{a.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </li>
        ))}
      </ul>
    </>
  );
}

export function AdminAudit() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => get<{ id: string; action: string; target: string; createdAt: string; actor: { name: string; email: string } | null }[]>('/admin/audit?limit=50') });
  const [msg, setMsg] = useState('');
  const runReminders = useMutation({
    mutationFn: () => post<{ created: number }>('/admin/reminders/run'),
    onSuccess: ({ data }) => { setMsg(`Reminder sweep created ${data.created} notification(s). Duplicates are skipped.`); qc.invalidateQueries({ queryKey: ['admin', 'audit'] }); },
    onError: (e) => setMsg(errorMessage(e)),
  });
  return (
    <>
      <PageHeader title="Audit log and tools" subtitle="Important actions are recorded here with the acting user."
        actions={<Button variant="secondary" onClick={() => runReminders.mutate()} disabled={runReminders.isPending}>Run deadline reminders now</Button>} />
      {msg && <p role="status" className="mb-4 text-sm">{msg}</p>}
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && (
        <div className="overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Audit log</caption>
            <thead className="text-xs uppercase text-[var(--muted)]"><tr><th className="p-3">When</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Target</th></tr></thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {q.data.data.map((r) => <tr key={r.id}><td className="p-3">{formatDate(r.createdAt, true)}</td><td className="p-3">{r.actor?.name ?? 'System'}</td><td className="p-3">{r.action}</td><td className="p-3 font-mono text-xs">{r.target || '—'}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function AdminAnnouncements() {
  const q = useQuery({ queryKey: ['announcements', 'admin'], queryFn: () => get<{ id: string; title: string; status: string; category: string; eventStart: string | null }[]>('/announcements?status=published&limit=50') });
  return (
    <>
      <PageHeader title="Announcements" subtitle="All published announcements across clubs." />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      <ul className="divide-y rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
        {q.data?.data.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium">{a.title}</p><p className="text-xs text-[var(--muted)]">{CATEGORY_LABELS[a.category]} · {formatDate(a.eventStart)}</p></div><Badge tone="green">{a.status}</Badge></li>)}
      </ul>
    </>
  );
}
