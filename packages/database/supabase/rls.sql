-- Supabase Row Level Security policies (defense-in-depth branch isolation)
-- Documented in docs/12-security.md — apply after Prisma migrations via Supabase SQL editor or psql.
--
-- JWT app_metadata.role and app_metadata.branch_id are set when invitations are accepted
-- (see AuthService.syncAppMetadata). super_admin bypasses branch filters.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.jwt_branch_id() RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'branch_id';
$$;

CREATE OR REPLACE FUNCTION public.jwt_role() RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean
  LANGUAGE sql STABLE
AS $$
  SELECT public.jwt_role() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.branch_visible(target_branch_id text) RETURNS boolean
  LANGUAGE sql STABLE
AS $$
  SELECT public.is_super_admin()
    OR target_branch_id = coalesce(public.jwt_branch_id(), target_branch_id);
$$;

-- ---------------------------------------------------------------------------
-- Branch-scoped tables (template from docs/12-security.md)
-- ---------------------------------------------------------------------------

-- Student
ALTER TABLE "Student" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "Student"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "Student"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "Student"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "Student"
  FOR DELETE USING (public.branch_visible("branchId"));

-- Program
ALTER TABLE "Program" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "Program"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "Program"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "Program"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "Program"
  FOR DELETE USING (public.branch_visible("branchId"));

-- Batch
ALTER TABLE "Batch" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "Batch"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "Batch"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "Batch"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "Batch"
  FOR DELETE USING (public.branch_visible("branchId"));

-- Assessment
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "Assessment"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "Assessment"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "Assessment"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "Assessment"
  FOR DELETE USING (public.branch_visible("branchId"));

-- AttendanceRecord
ALTER TABLE "AttendanceRecord" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "AttendanceRecord"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "AttendanceRecord"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "AttendanceRecord"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "AttendanceRecord"
  FOR DELETE USING (public.branch_visible("branchId"));

-- FeeStructure
ALTER TABLE "FeeStructure" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "FeeStructure"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "FeeStructure"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "FeeStructure"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "FeeStructure"
  FOR DELETE USING (public.branch_visible("branchId"));

-- FeeInvoice
ALTER TABLE "FeeInvoice" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "FeeInvoice"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "FeeInvoice"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "FeeInvoice"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "FeeInvoice"
  FOR DELETE USING (public.branch_visible("branchId"));

-- Notice
ALTER TABLE "Notice" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "Notice"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "Notice"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "Notice"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "Notice"
  FOR DELETE USING (public.branch_visible("branchId"));

-- TimetableSlot
ALTER TABLE "TimetableSlot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "TimetableSlot"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "TimetableSlot"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "TimetableSlot"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "TimetableSlot"
  FOR DELETE USING (public.branch_visible("branchId"));

-- Document
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "Document"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "Document"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "Document"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "Document"
  FOR DELETE USING (public.branch_visible("branchId"));

-- AttendanceOcrSession
ALTER TABLE "AttendanceOcrSession" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branch_isolation_select" ON "AttendanceOcrSession"
  FOR SELECT USING (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_insert" ON "AttendanceOcrSession"
  FOR INSERT WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_update" ON "AttendanceOcrSession"
  FOR UPDATE USING (public.branch_visible("branchId"))
  WITH CHECK (public.branch_visible("branchId"));

CREATE POLICY "branch_isolation_delete" ON "AttendanceOcrSession"
  FOR DELETE USING (public.branch_visible("branchId"));
