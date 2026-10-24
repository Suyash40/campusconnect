import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button, EmptyState, ErrorState, Pagination, Skeleton, PageHeader } from '../../components/ui';
import { OpportunityCard } from '../../components/OpportunityCard';
import type { OpportunityItem } from '../../components/OpportunityCard';
import { CATEGORY_LABELS, errorMessage, get, post, del } from '../../lib/api';

const SORTS = [
  { v: 'recent', l: 'Newest' }, { v: 'deadline', l: 'Closing soonest' }, { v: 'start', l: 'Event date' }, { v: 'popular', l: 'Most popular' },
];

export default function Opportunities() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const qc = useQueryClient();
  const page = Number(params.get('page') ?? '1');
  const filters = {
    q: params.get('q') ?? '', category: params.get('category') ?? '', branch: params.get('branch') ?? '',
    year: params.get('year') ?? '', mode: params.get('mode') ?? '', status: params.get('status') ?? 'active',
    sort: params.get('sort') ?? 'recent', organizer: params.get('organizer') ?? '', skill: params.get('skill') ?? '',
  };

  useEffect(() => { setDraft(filters.q); }, [filters.q]);

  const query = new URLSearchParams({ page: String(page), limit: '9' });
  Object.entries(filters).forEach(([k, v]) => { if (v) query.set(k, v); });

  const list = useQuery({
    queryKey: ['opportunities', query.toString()],
    queryFn: () => get<OpportunityItem[]>(`/opportunities?${query.toString()}`),
    placeholderData: (prev) => prev,
  });
  const saved = useQuery({ queryKey: ['saved-ids'], queryFn: () => get<{ id: string }[]>('/saved') });
  const savedIds = new Set((saved.data?.data ?? []).map((s) => s.id));

  const toggleSave = useMutation({
    mutationFn: ({ id, isSaved }: { id: string; isSaved: boolean }) => (isSaved ? del(`/opportunities/${id}/save`) : post(`/opportunities/${id}/save`)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved-ids'] }); qc.invalidateQueries({ queryKey: ['saved'] }); },
  });

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.set('page', '1');
    setParams(next);
  };

  return (
    <>
      <PageHeader title="Opportunities" subtitle="Hackathons, internships, workshops and more. Expired items are hidden unless you choose to show them." />

      <form className="card mb-6 space-y-4" onSubmit={(e) => { e.preventDefault(); update({ q: draft.trim() }); }} role="search">
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">Search opportunities</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--muted)]" aria-hidden />
            <input id="q" className="input pl-9" placeholder="Search by title, tag or description" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <Button type="submit">Search</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <select aria-label="Category" className="input" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Status" className="input" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
            <option value="active">Active (not expired)</option>
            <option value="open">Open for registration</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
            <option value="all">All</option>
          </select>
          <select aria-label="Branch" className="input" value={filters.branch} onChange={(e) => update({ branch: e.target.value })}>
            <option value="">Any branch</option>
            {['CSE', 'AI & ML', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil'].map((b) => <option key={b}>{b}</option>)}
          </select>
          <select aria-label="Academic year" className="input" value={filters.year} onChange={(e) => update({ year: e.target.value })}>
            <option value="">Any year</option>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <select aria-label="Format" className="input" value={filters.mode} onChange={(e) => update({ mode: e.target.value })}>
            <option value="">Online or offline</option><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option>
          </select>
          <select aria-label="Sort" className="input" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SlidersHorizontal className="h-4 w-4 text-[var(--muted)]" aria-hidden />
          <input aria-label="Required skill" className="input max-w-[180px]" placeholder="Skill, e.g. python" defaultValue={filters.skill} onBlur={(e) => update({ skill: e.target.value.trim() })} />
          <input aria-label="Organizer" className="input max-w-[220px]" placeholder="Organizer or club" defaultValue={filters.organizer} onBlur={(e) => update({ organizer: e.target.value.trim() })} />
          <Button variant="ghost" onClick={() => setParams(new URLSearchParams())}>Clear filters</Button>
        </div>
      </form>

      {list.isLoading && <Skeleton lines={6} />}
      {list.isError && <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />}
      {list.data && list.data.data.length === 0 && (
        <EmptyState title="No opportunities match these filters" description="Try a wider date range or remove a filter." action={<Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>Clear filters</Button>} />
      )}
      {list.data && list.data.data.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.data.data.map((o) => (
              <OpportunityCard key={o.id} item={o} saved={savedIds.has(o.id)} onToggleSave={() => toggleSave.mutate({ id: o.id, isSaved: savedIds.has(o.id) })} />
            ))}
          </div>
          <Pagination page={page} totalPages={Number(list.data.meta?.totalPages ?? 1)} onChange={(p) => { const n = new URLSearchParams(params); n.set('page', String(p)); setParams(n); }} />
        </>
      )}
    </>
  );
}
