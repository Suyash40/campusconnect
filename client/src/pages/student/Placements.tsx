import { useQuery } from '@tanstack/react-query';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import { OpportunityCard } from '../../components/OpportunityCard';
import type { OpportunityItem } from '../../components/OpportunityCard';
import { get, errorMessage } from '../../lib/api';

export default function Placements() {
  const q = useQuery({ queryKey: ['placements'], queryFn: () => get<OpportunityItem[]>('/placements') });
  const items = q.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Placement drives"
        subtitle="Campus recruitment drives open for your branch and year. Closed drives are hidden."
      />

      {q.isLoading && <Skeleton lines={4} />}
      {q.isError && <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />}
      {q.data && items.length === 0 && (
        <EmptyState
          title="No placement drives open for you"
          description="Drives appear here when the placement cell publishes them for your branch and year."
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((o) => <OpportunityCard key={o.id} item={o} />)}
      </div>
    </>
  );
}
