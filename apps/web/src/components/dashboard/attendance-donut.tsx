import { cn } from '@/lib/utils';

const SIZE = 104;
const STROKE = 9;

export function AttendanceDonut({
  rate,
  color,
  className,
}: {
  rate: number;
  color: string;
  className?: string;
}) {
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.max(0, Math.min(100, rate));
  const progress = (clampedRate / 100) * circumference;

  return (
    <div className={cn('relative mx-auto aspect-square w-full max-w-[104px]', className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke="var(--stroke-soft-200, #E2E4E9)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--text-main-900)] sm:text-lg sm:leading-7">
          {clampedRate}%
        </span>
      </div>
    </div>
  );
}
