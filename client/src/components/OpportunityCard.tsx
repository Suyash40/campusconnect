import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { Badge } from './ui';
import { CATEGORY_LABELS, formatDate, STATUS_LABELS } from '../lib/api';

export interface OpportunityItem {
  id: string;
  title: string;
  category: string;
  organizerName: string;
  mode: string;
  eventStart: string | null;
  registrationDeadline: string | null;
  tags: string[];
  status: 'open' | 'upcoming' | 'completed' | 'expired';
  eligibleForYou?: boolean;
  eligibilityReason?: string | null;
  capacity?: number | null;
  registrationCount?: number;
  reasons?: string[];
  score?: number;
}

const statusTone = { open: 'green', upcoming: 'blue', completed: 'neutral', expired: 'red' } as const;

export function OpportunityCard({
  item,
  saved,
  onToggleSave,
  onFeedback,
}: {
  item: OpportunityItem;
  saved?: boolean;
  onToggleSave?: () => void;
  onFeedback?: (value: 'more_like_this' | 'not_relevant') => void;
}) {
  return (
    <article className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{CATEGORY_LABELS[item.category] ?? item.category}</Badge>
        <Badge tone={statusTone[item.status]}>{STATUS_LABELS[item.status]}</Badge>
        {item.eligibleForYou === false && <Badge tone="amber">Not eligible</Badge>}
      </div>
      <div>
        <h3 className="text-base font-semibold leading-snug">
          <Link to={`/opportunities/${item.id}`} className="hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded">{item.title}</Link>
        </h3>
        <p className="text-sm text-[var(--muted)]">{item.organizerName || 'Campus club'}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-xs text-[var(--muted)]">Event</dt><dd>{formatDate(item.eventStart)}</dd></div>
        <div><dt className="text-xs text-[var(--muted)]">Register by</dt><dd>{formatDate(item.registrationDeadline)}</dd></div>
      </dl>
      {item.reasons && item.reasons.length > 0 && (
        <p className="rounded-lg bg-brand-50 p-2 text-xs text-brand-900 dark:bg-brand-900/20 dark:text-brand-100">
          Recommended because: {item.reasons.slice(0, 2).join('; ')}.
        </p>
      )}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">{item.tags.slice(0, 4).map((t) => <Badge key={t}>{t}</Badge>)}</div>
      )}
      {item.capacity ? (
        <p className="flex items-center gap-1 text-xs text-[var(--muted)]"><Users className="h-3.5 w-3.5" aria-hidden />{item.registrationCount ?? 0} / {item.capacity} seats taken</p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <Link to={`/opportunities/${item.id}`} className="btn-secondary">View details</Link>
        {onToggleSave && (
          <button type="button" onClick={onToggleSave} className="btn-ghost" aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save opportunity'}>
            {saved ? <BookmarkCheck className="h-4 w-4 text-brand-600" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
        {onFeedback && (
          <>
            <button type="button" onClick={() => onFeedback('more_like_this')} className="btn-ghost" aria-label="More like this"><ThumbsUp className="h-4 w-4" aria-hidden /></button>
            <button type="button" onClick={() => onFeedback('not_relevant')} className="btn-ghost" aria-label="Not relevant"><ThumbsDown className="h-4 w-4" aria-hidden /></button>
          </>
        )}
      </div>
    </article>
  );
}
