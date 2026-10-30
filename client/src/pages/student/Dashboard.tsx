import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bot, Bookmark, Briefcase, ClipboardList, Ticket } from 'lucide-react';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import { OpportunityCard } from '../../components/OpportunityCard';
import type { OpportunityItem } from '../../components/OpportunityCard';
import { get, errorMessage, formatDate } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Dashboard {
  profile: { name: string; branch: string; year: number | null; college: string; onboarded: boolean };
  placements: OpportunityItem[];
  recommended: OpportunityItem[];
  upcoming: OpportunityItem[];
  deadlines: OpportunityItem[];
  trending: (OpportunityItem & { engagement: number })[];
  followedClubUpdates: OpportunityItem[];
  recent: OpportunityItem[];
}

function Section({ title, items, empty, children }: { title: string; items?: unknown[]; empty: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title} className="mt-8">
      <h2 id={title} className="mb-3 text-lg font-semibold">{title}</h2>
      {items && items.length === 0 ? <p className="card text-sm text-[var(--muted)]">{empty}</p> : children}
    </section>
  );
}

function Mini({ item }: { item: OpportunityItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <Link to={`/opportunities/${item.id}`} className="block truncate font-medium hover:text-brand-600">{item.title}</Link>
        <p className="text-xs text-[var(--muted)]">{item.organizerName || 'Campus club'}</p>
      </div>
      <p className="shrink-0 text-xs text-[var(--muted)]">{formatDate(item.registrationDeadline ?? item.eventStart)}</p>
    </li>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['dashboard', 'student'], queryFn: () => get<Dashboard>('/dashboard/student') });
  const d = q.data?.data;

  return (
    <>
      <PageHeader
        title={`Hi ${user?.name?.split(' ')[0] ?? 'there'}, here is your week`}
        subtitle={d ? `${d.profile.branch || 'Add your branch'}${d.profile.year ? ` · Year ${d.profile.year}` : ''} · ${d.profile.college || ''}` : 'Your personalised campus feed'}
        actions={<>
          <Link to="/registrations" className="btn-secondary"><Ticket className="h-4 w-4" aria-hidden />My registrations</Link>
          <Link to="/saved" className="btn-secondary"><Bookmark className="h-4 w-4" aria-hidden />Saved</Link>
          <Link to="/applications" className="btn-secondary"><ClipboardList className="h-4 w-4" aria-hidden />Applications</Link>
          <Link to="/assistant" className="btn-primary"><Bot className="h-4 w-4" aria-hidden />Ask CampusBot</Link>
        </>}
      />

      {q.isLoading && <Skeleton lines={4} />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}

      {d && (
        <>
          {!user?.interests.length && (
            <div className="card mb-6 flex flex-col gap-2 border-brand-300 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Add interests and skills so recommendations can be personalised.</p>
              <Link to="/profile" className="btn-primary">Update profile</Link>
            </div>
          )}

          <section aria-labelledby="placements" className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="placements" className="flex items-center gap-2 text-lg font-semibold"><Briefcase className="h-5 w-5 text-brand-600" aria-hidden />Placement drives</h2>
              <Link to="/placements" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>
            </div>
            {d.placements.length === 0
              ? <p className="card text-sm text-[var(--muted)]">No open placement drives for your branch and year right now. <Link to="/placements" className="text-brand-600">Check the placements page</Link> for updates.</p>
              : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.placements.map((o) => <OpportunityCard key={o.id} item={o} />)}</div>}
          </section>

          <Section title="Recommended for you" items={d.recommended} empty="No open opportunities match your profile yet. Browse all opportunities to see more.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {d.recommended.map((o) => <OpportunityCard key={o.id} item={o} />)}
            </div>
          </Section>

          <div className="mt-8 grid gap-6 xl:grid-cols-3">
            <section aria-labelledby="upcoming" className="card">
              <h2 id="upcoming" className="mb-2 font-semibold">Upcoming opportunities</h2>
              {d.upcoming.length === 0 ? <p className="text-sm text-[var(--muted)]">Nothing scheduled in the coming days.</p> : <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>{d.upcoming.map((o) => <Mini key={o.id} item={o} />)}</ul>}
            </section>
            <section aria-labelledby="deadlines" className="card">
              <h2 id="deadlines" className="mb-2 font-semibold">Deadlines approaching</h2>
              {d.deadlines.length === 0 ? <p className="text-sm text-[var(--muted)]">No registration deadlines in the next 14 days.</p> : <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>{d.deadlines.map((o) => <Mini key={o.id} item={o} />)}</ul>}
            </section>
            <section aria-labelledby="trending" className="card">
              <h2 id="trending" className="mb-2 font-semibold">Trending on campus</h2>
              {d.trending.length === 0 ? <p className="text-sm text-[var(--muted)]">No activity yet.</p> : <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>{d.trending.map((o) => <li key={o.id} className="flex justify-between gap-2 py-2.5"><Link to={`/opportunities/${o.id}`} className="truncate font-medium hover:text-brand-600">{o.title}</Link><span className="shrink-0 text-xs text-[var(--muted)]">{o.engagement} interested</span></li>)}</ul>}
            </section>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <section aria-labelledby="clubs" className="card">
              <h2 id="clubs" className="mb-2 font-semibold">From clubs you follow</h2>
              {d.followedClubUpdates.length === 0
                ? <p className="text-sm text-[var(--muted)]">Follow clubs to see their updates here. <Link to="/clubs" className="text-brand-600">Browse clubs</Link></p>
                : <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>{d.followedClubUpdates.map((o) => <Mini key={o.id} item={o} />)}</ul>}
            </section>
            <section aria-labelledby="recent" className="card">
              <h2 id="recent" className="mb-2 font-semibold">Recent announcements</h2>
              {d.recent.length === 0 ? <EmptyState title="No announcements yet" description="New published opportunities will appear here." /> : <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>{d.recent.map((o) => <Mini key={o.id} item={o} />)}</ul>}
            </section>
          </div>
        </>
      )}
    </>
  );
}
