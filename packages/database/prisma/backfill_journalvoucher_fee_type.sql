UPDATE "JournalVoucher" jv
SET "feeTypeId" = fi."feeTypeId"
FROM "FeePayment" fp
JOIN "FeeInvoice" fi ON fi.id = fp."invoiceId"
WHERE jv."sourceType" = 'fee_payment'
  AND jv."sourceId" = fp.id
  AND jv."feeTypeId" IS NULL;
