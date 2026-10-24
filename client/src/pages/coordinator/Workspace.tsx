import { Link, useLocation, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Archive, Download, Megaphone, Plus, Send, Sparkles } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader, Skeleton, Pagination } from '../../components/ui';
import { CATEGORY_LABELS, errorMessage, formatDate, get, post } from '../../lib/api';

interface CoordDashboard {
  published: number; drafts: number; archived: number; upcomingEvents: number; registrations: number; views: number; saves: number;
  performance: { id: string; title: string; registrations: number; views: number; saves: number; capacity: number | null }[];
  recentActivity: { action: string; target: string; at: string }[];
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="card"><p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}

export function CoordinatorDashboard() {
  const q = useQuery({ queryKey: ['coord', 'dashboard'], queryFn: () => get<CoordDashboard>('/coordinator/dashboard') });
  const d = q.data?.data;
  return (
    <>
      <PageHeader title="Coordinator dashboard" subtitle="Your clubs' announcements, registrations and recent activity."
        actions={<Link to="/coordinator/announcements/new" className="btn-primary"><Sparkles className="h-4 w-4" aria-hidden />Create with AI</Link>} />
      {q.isLoading && <Skeleton lines={4} />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Published" value={d.published} /><Stat label="Drafts" value={d.drafts} />
            <Stat label="Upcoming events" value={d.upcomingEvents} /><Stat label="Registrations" value={d.registrations} />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <section className="card xl:col-span-2" aria-labelledby="perf">
              <h2 id="perf" className="mb-3 font-semibold">Announcement performance</h2>
              {d.performance.length === 0 ? <p className="text-sm text-[var(--muted)]">Publish an announcement to see its performance.</p> : (
                <div className="h-64" role="img" aria-label="Bar chart of registrations, views and saves per published announcement">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.performance.map((p) => ({ name: p.title.slice(0, 22), Registrations: p.registrations, Views: p.views, Saves: p.saves }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend /><Bar dataKey="Registrations" fill="#F97316" /><Bar dataKey="Views" fill="#6366F1" /><Bar dataKey="Saves" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
            <section className="card" aria-labelledby="act">
              <h2 id="act" className="mb-3 font-semibold">Recent activity</h2>
              {d.recentActivity.length === 0 ? <p className="text-sm text-[var(--muted)]">No activity yet.</p> : (
                <ul className="space-y-3 text-sm">{d.recentActivity.map((a, i) => <li key={i}><span className="font-medium">{a.action.replace(/[._]/g, ' ')}</span><span className="block text-xs text-[var(--muted)]">{formatDate(a.at, true)}</span></li>)}</ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

const STATUS_TONE = { draft: 'amber', published: 'green', archived: 'neutral' } as const;

interface AnnRow { id: string; title: string; category: string; status: keyof typeof STATUS_TONE; eventStart: string | null; registrationDeadline: string | null; activeRegistrations: number; warnings: string[] }

export function CoordinatorAnnouncements() {
  const location = useLocation() as { state?: { published?: string; notified?: number } };
  const qc = useQueryClient();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [err, setErr] = useState('');
  const q = useQuery({
    queryKey: ['announcements', status, search, page],
    queryFn: () => get<AnnRow[]>(`/announcements?status=${status}&page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    placeholderData: (p) => p,
  });
  const publish = useMutation({
    mutationFn: (id: string) => post(`/announcements/${id}/publish`, { confirm: true }),
    onSuccess: () => { setErr(''); qc.invalidateQueries({ queryKey: ['announcements'] }); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const archive = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => post(`/announcements/${id}/archive`, { reason }),
    onSuccess: () => { setErr(''); qc.invalidateQueries({ queryKey: ['announcements'] }); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const rows = q.data?.data ?? [];

  return (
    <>
      <PageHeader title="Announcements" subtitle="Drafts, published and archived opportunities for your clubs."
        actions={<Link to="/coordinator/announcements/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />New announcement</Link>} />
      {location.state?.published && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">Published “{location.state.published}”. {location.state.notified ?? 0} students were notified.</p>}
      {err && <p role="alert" className="mb-4 text-sm text-red-600">{err}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="ann-search">Search announcements</label>
        <input id="ann-search" className="input max-w-xs" placeholder="Search by title" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <label className="sr-only" htmlFor="ann-status">Filter by status</label>
        <select id="ann-status" className="input max-w-[180px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="all">All statuses</option><option value="draft">Drafts</option><option value="published">Published</option><option value="archived">Archived</option>
        </select>
      </div>
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && rows.length === 0 && <EmptyState title="No announcements here" description="Create one from a WhatsApp message in under a minute." action={<Link to="/coordinator/announcements/new" className="btn-primary">Create with AI</Link>} />}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Announcements</caption>
            <thead className="text-xs uppercase text-[var(--muted)]"><tr><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Event</th><th className="p-3">Registrations</th><th className="p-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3"><p className="font-medium">{r.title}</p><p className="text-xs text-[var(--muted)]">{CATEGORY_LABELS[r.category]}{r.warnings.length ? ` · ${r.warnings.length} warning(s)` : ''}</p></td>
                  <td className="p-3"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                  <td className="p-3">{formatDate(r.eventStart)}</td>
                  <td className="p-3">{r.activeRegistrations}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {r.status !== 'archived' && <Link className="btn-ghost" to={`/coordinator/announcements/${r.id}/edit`}>Edit</Link>}
                      {r.status === 'draft' && <Button variant="ghost" onClick={() => publish.mutate(r.id)} disabled={publish.isPending}><Send className="h-4 w-4" aria-hidden />Publish</Button>}
                      {r.status === 'published' && <Link className="btn-ghost" to={`/coordinator/events/${r.id}/attendees`}>Attendees</Link>}
                      {r.status !== 'archived' && (
                        <Button variant="ghost" onClick={() => { const reason = window.prompt('Reason for archiving (shown to registered students):'); if (reason && reason.trim().length >= 3) archive.mutate({ id: r.id, reason: reason.trim() }); }}>
                          <Archive className="h-4 w-4" aria-hidden />Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={Number(q.data?.meta?.totalPages ?? 1)} onChange={setPage} />
    </>
  );
}

export function CoordinatorEvents() {
  const q = useQuery({ queryKey: ['coord', 'events'], queryFn: () => get<{ id: string; title: string; eventStart: string | null; capacity: number | null; registrationCount: number }[]>('/coordinator/events') });
  const items = q.data?.data ?? [];
  return (
    <>
      <PageHeader title="Events" subtitle="Upcoming published events with registration counts." />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && items.length === 0 && <EmptyState title="No upcoming events" description="Published events with open registration appear here." />}
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((e) => (
          <li key={e.id} className="card flex flex-col gap-2">
            <h3 className="font-semibold">{e.title}</h3>
            <p className="text-sm text-[var(--muted)]">{formatDate(e.eventStart, true)}</p>
            <p className="text-sm">{e.registrationCount}{e.capacity ? ` / ${e.capacity}` : ''} registered</p>
            <Link className="btn-secondary mt-2 w-fit" to={`/coordinator/events/${e.id}/attendees`}>View attendees</Link>
          </li>
        ))}
      </ul>
    </>
  );
}

interface Attendee { name: string; email: string; branch: string; year: number | null; college: string; registeredAt: string }

export function Attendees() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['attendees', id], queryFn: () => get<{ event: { title: string; capacity: number | null; registrationCount: number }; attendees: Attendee[] }>(`/coordinator/events/${id}/attendees`), enabled: Boolean(id) });
  const d = q.data?.data;
  const exportCsv = () => {
    if (!d) return;
    const rows = [['Name', 'Email', 'Branch', 'Year', 'College', 'Registered at'], ...d.attendees.map((a) => [a.name, a.email, a.branch, String(a.year ?? ''), a.college, a.registeredAt])];
    // Quote every field and neutralise spreadsheet formulas so exported names cannot run as formulas.
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'attendees.csv'; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader title={d ? `Attendees: ${d.event.title}` : 'Attendees'} subtitle={d ? `${d.event.registrationCount}${d.event.capacity ? ` of ${d.event.capacity}` : ''} registered` : ''}
        actions={<Button variant="secondary" onClick={exportCsv} disabled={!d || d.attendees.length === 0}><Download className="h-4 w-4" aria-hidden />Export CSV</Button>} />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {d && d.attendees.length === 0 && <EmptyState title="No registrations yet" description="Students who register will appear here." />}
      {d && d.attendees.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Registered students</caption>
            <thead className="text-xs uppercase text-[var(--muted)]"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Branch</th><th className="p-3">Year</th><th className="p-3">Registered</th></tr></thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {d.attendees.map((a) => <tr key={a.email + a.registeredAt}><td className="p-3">{a.name}</td><td className="p-3">{a.email}</td><td className="p-3">{a.branch}</td><td className="p-3">{a.year ?? '—'}</td><td className="p-3">{formatDate(a.registeredAt, true)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function CoordinatorClubs() {
  const q = useQuery({ queryKey: ['clubs', 'managed'], queryFn: () => get<{ id: string; name: string; description: string; tags: string[] }[]>('/clubs/managed') });
  return (
    <>
      <PageHeader title="My clubs" subtitle="Clubs you can publish announcements for." />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.data.length === 0 && <EmptyState title="No clubs assigned" description="Ask an administrator to assign a club to your account." />}
      <div className="grid gap-4 md:grid-cols-2">
        {q.data?.data.map((c) => (
          <article key={c.id} className="card"><h3 className="font-semibold">{c.name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{c.description || 'No description yet.'}</p>
            <Link to={`/coordinator/announcements/new`} className="btn-secondary mt-3 inline-flex"><Megaphone className="h-4 w-4" aria-hidden />New announcement</Link></article>
        ))}
      </div>
    </>
  );
}

export function CoordinatorAnalytics() {
  const q = useQuery({ queryKey: ['coord', 'dashboard'], queryFn: () => get<CoordDashboard>('/coordinator/dashboard') });
  const d = q.data?.data;
  const [filter, setFilter] = useState('');
  return (
    <>
      <PageHeader title="Analytics" subtitle="Engagement for your published announcements." />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Stat label="Views" value={d.views} /><Stat label="Saves" value={d.saves} /><Stat label="Registrations" value={d.registrations} /><Stat label="Published" value={d.published} /></div>
          <section className="card mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Engagement by announcement</h2>
              <Field label="Filter by title" id="af"><input id="af" className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} /></Field>
            </div>
            <div className="h-72" role="img" aria-label="Line chart of views and registrations by announcement">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.performance.filter((p) => p.title.toLowerCase().includes(filter.toLowerCase())).map((p) => ({ name: p.title.slice(0, 18), Views: p.views, Registrations: p.registrations }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend />
                  <Line type="monotone" dataKey="Views" stroke="#6366F1" /><Line type="monotone" dataKey="Registrations" stroke="#F97316" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </>
  );
}
