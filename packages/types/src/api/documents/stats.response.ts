import type { CountWithTrend } from '../common/stats-metric';

export interface DocumentsStatsResponse {
  totalFiles: CountWithTrend;
  recentUploads: CountWithTrend;
  studentDocuments: CountWithTrend;
  otherDocuments: CountWithTrend;
}
