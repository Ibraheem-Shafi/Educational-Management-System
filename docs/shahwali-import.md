# Shahwali fee register import

Imports the Excel fee register into branch **SWC** (Shahwali Campus), creates Program/Batch per class, fee types, monthly **FeeChallan** + lines, and backing **FeeInvoice** / **FeePayment** rows.

## Prerequisites

1. Apply schema (`billingPeriod`, `voucherNo`, `FeeChallan`, `FeeChallanLine`):

```bash
npm run db:push -w @eims/database
```

2. Place the workbook at repo root (default path) or pass `--file`.

## Commands

```bash
# Parse + summary only
npm run db:import:shahwali -w @eims/database -- --dry-run

# Upsert income heads (fee types) only — no student/challan import
npm run db:import:shahwali -w @eims/database -- --catalog-only

# Create branch/catalog + upsert students/challans/invoices
npm run db:import:shahwali -w @eims/database -- --apply

# Spot-check DB vs Excel (after apply)
npm run db:import:shahwali -w @eims/database -- --verify

# Custom path
npm run db:import:shahwali -w @eims/database -- --apply --file "C:/path/to/register.xlsx"
```

## Print

Fees → **Challans** tab → Print opens `/print/challans/[challanId]` (School / Bank / Student copies).

## Notes

- Session label: `2026-2027` (Apr 2026 – Mar 2027)
- `En. No.` → `admissionNumber`
- Income heads (Tuition Fee, Admission Fee, discounts, board/sports/uniform charges, etc.) are upserted as **Fee types** (`--catalog-only` or `--apply`)
- Excel extras kept: Security Fee, Party Charges
- Arrears are challan line snapshots; charge lines map to invoices
- Re-run `--apply` is idempotent on student + billing period / fee type
- **Important:** set `DIRECT_URL` in `apps/api/.env` to the **session** connection (`:5432` pooler or `db.*.supabase.co`). Do **not** run long imports on `DATABASE_URL` transaction pooler (`:6543`) — it drops connections mid-run (`P1017` / `P1001`).
