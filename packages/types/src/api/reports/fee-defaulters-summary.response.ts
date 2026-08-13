export type FeeDefaulterAgingBucket = '0-30' | '31-60' | '61+';

export interface FeeDefaultersSummaryResponse {
  aging: Array<{
    bucket: FeeDefaulterAgingBucket;
    count: number;
    remainingAmount: number;
  }>;
  trend: Array<{
    /** YYYY-MM */
    month: string;
    remainingAmount: number;
    count: number;
  }>;
}
