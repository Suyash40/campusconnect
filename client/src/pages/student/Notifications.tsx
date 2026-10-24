import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, Badge } from '../../components/ui';
import { errorMessage, formatDate, get, post } from '../../lib/api';

interface Note { id: string; type: string; title: string; body: string; link: string; read: boolean; createdAt: string }

const TONE: Record<string, 'brand' | 'green' | 'amber' | 'red' | 'blue' | 'neutral'> = {
  deadline_reminder: 'amber', registration_confirmed: 'green', event_cancelled: 'red', event_updated: 'blue', club_update: 'brand', new_announcement: 'brand',
};

export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => get<Note[]>('/notifications?limit=30') });
  const readAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readOne = useMutation({ mutationFn: (id: string) => post(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const unread = (q.data?.meta?.unread as number | undefined) ?? 0;

  return (
    <>
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : 'You are all caught up'} actions={unread > 0 && <Button variant="secondary" onClick={() => readAll.mutate()}>Mark all as read</Button>} />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && q.data.data.length === 0 && <EmptyState title="No notifications" description="New opportunities, reminders and updates from clubs you follow appear here." />}
      <ul className="space-y-3">
        {q.data?.data.map((n) => (
          <li key={n.id} className={`card flex gap-3 ${n.read ? 'opacity-75' : 'border-brand-300'}`}>
            <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.read ? 'text-[var(--muted)]' : 'text-brand-600'}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[n.type] ?? 'neutral'}>{n.type.replace(/_/g, ' ')}</Badge><span className="text-xs text-[var(--muted)]">{formatDate(n.createdAt, true)}</span></div>
              <p className="mt-1 font-medium">{n.title}</p>
              {n.body && <p className="text-sm text-[var(--muted)]">{n.body}</p>}
              <div className="mt-2 flex gap-3 text-sm">
                {n.link && <Link className="text-brand-600 hover:underline" to={n.link} onClick={() => !n.read && readOne.mutate(n.id)}>View</Link>}
                {!n.read && <button type="button" className="text-[var(--muted)] hover:underline" onClick={() => readOne.mutate(n.id)}>Mark read</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
