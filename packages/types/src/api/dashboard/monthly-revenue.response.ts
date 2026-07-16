export interface DashboardMonthlyRevenuePoint {
  month: number;
  label: string;
  amount: number;
}

export interface DashboardMonthlyRevenueResponse {
  fiscalYear: number;
  totalAmount: number;
  changePercentVsLastYear: number | null;
  months: DashboardMonthlyRevenuePoint[];
}
