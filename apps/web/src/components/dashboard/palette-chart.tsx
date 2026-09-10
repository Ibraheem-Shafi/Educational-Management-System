import type { ReactElement } from 'react';
import { CHART_STOPS, paletteCssAt } from '@/lib/ui-palette';

export function PaletteChartGradients({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
        {CHART_STOPS.map((stop) => (
          <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
        ))}
      </linearGradient>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="0">
        {CHART_STOPS.map((stop) => (
          <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={0.28} />
        ))}
      </linearGradient>
    </>
  );
}

export function paletteChartDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
}): ReactElement<SVGElement> {
  const { cx, cy, index = 0 } = props;
  if (cx == null || cy == null) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={paletteCssAt(index)}
      stroke="#ffffff"
      strokeWidth={1.5}
    />
  );
}

export function paletteChartActiveDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
}): ReactElement<SVGElement> {
  const { cx, cy, index = 0 } = props;
  if (cx == null || cy == null) return <g />;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5.5}
      fill={paletteCssAt(index)}
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}
