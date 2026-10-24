import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import { errorMessage, get, post } from '../../lib/api';

interface Club { id: string; name: string; description: string; tags: string[]; followed: boolean }

export default function Clubs() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['clubs'], queryFn: () => get<Club[]>('/clubs') });
  const follow = useMutation({
    mutationFn: ({ id, following }: { id: string; following: boolean }) => post(`/clubs/${id}/${following ? 'unfollow' : 'follow'}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clubs'] }); qc.invalidateQueries({ queryKey: ['dashboard', 'student'] }); },
  });
  const clubs = q.data?.data ?? [];
  return (
    <>
      <PageHeader title="Clubs" subtitle="Follow clubs to get their updates on your dashboard and in notifications." />
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && clubs.length === 0 && <EmptyState title="No clubs listed yet" description="Clubs are added by the college administration." />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clubs.map((c) => (
          <article key={c.id} className="card flex flex-col gap-3">
            <h3 className="font-semibold">{c.name}</h3>
            <p className="flex-1 text-sm text-[var(--muted)]">{c.description || 'No description yet.'}</p>
            <div className="flex flex-wrap gap-1.5">{c.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
            <Button variant={c.followed ? 'secondary' : 'primary'} onClick={() => follow.mutate({ id: c.id, following: c.followed })} disabled={follow.isPending}>
              {c.followed ? <><BellOff className="h-4 w-4" aria-hidden />Unfollow</> : <><Bell className="h-4 w-4" aria-hidden />Follow</>}
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}
