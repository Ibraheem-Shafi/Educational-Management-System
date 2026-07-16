import { cn } from '@/lib/utils';

export function AttendanceDonut({
  rate,
  color,
  className,
}: {
  rate: number;
  color: string;
  className?: string;
}) {
  const size = 104;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.max(0, Math.min(100, rate));
  const progress = (clampedRate / 100) * circumference;

  return (
    <div className={cn('relative mx-auto', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--stroke-soft-200, #E2E4E9)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-semibold leading-7 tracking-[-0.02em] text-[var(--text-main-900)]">
          {clampedRate}%
        </span>
      </div>
    </div>
  );
}
