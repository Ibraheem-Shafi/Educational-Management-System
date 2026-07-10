import { computeChangePercent } from './metrics.util';

export interface CountWithTrend {
  total: number;
  changePercent: number | null;
}

export function countWithTrend(current: number, previous: number): CountWithTrend {
  return {
    total: current,
    changePercent: computeChangePercent(current, previous),
  };
}

export function thirtyDaysAgo(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - 30);
  return date;
}

export function todayStart(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function daysAgo(n: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - n);
  return date;
}
