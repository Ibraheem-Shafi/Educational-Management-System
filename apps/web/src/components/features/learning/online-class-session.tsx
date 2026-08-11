import { formatLearningDueAt } from '@/lib/portal-learning';

interface OnlineClassSessionProps {
  startsAt: string | null;
  endsAt: string | null;
  meetingUrl: string | null;
  /** When false, treat meetingUrl as a recording / video link (Watch) instead of Join. */
  isLiveClass?: boolean;
  variant?: 'detail' | 'inline';
}

export function OnlineClassSessionMeta({
  startsAt,
  endsAt,
  meetingUrl,
  isLiveClass = true,
  variant = 'detail',
}: OnlineClassSessionProps) {
  const linkLabel = isLiveClass ? 'Join meeting' : 'Watch video';

  if (variant === 'inline') {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-sub-500)]">
        {startsAt && <span>Starts {formatLearningDueAt(startsAt)}</span>}
        {endsAt && <span>Ends {formatLearningDueAt(endsAt)}</span>}
        {meetingUrl && (
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--institution-primary)] hover:underline"
          >
            {linkLabel}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {startsAt && (
        <span className="text-sm text-[var(--text-sub-500)]">
          Starts {formatLearningDueAt(startsAt)}
        </span>
      )}
      {endsAt && (
        <span className="text-sm text-[var(--text-sub-500)]">
          Ends {formatLearningDueAt(endsAt)}
        </span>
      )}
      {meetingUrl && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-[var(--institution-primary)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {linkLabel}
        </a>
      )}
    </div>
  );
}
