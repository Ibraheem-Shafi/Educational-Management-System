export interface BranchListRow {
  id: string;
  code: string;
  name: string;
  addressLabel: string;
  email: string | null;
  phone: string | null;
  principalName: string | null;
  studentCount: number;
  staffCount: number;
  /** Paid fee invoice net amount for the current calendar month (UTC). */
  monthlyRevenue: number;
  isActive: boolean;
}
