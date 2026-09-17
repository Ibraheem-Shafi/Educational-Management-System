'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { getSingleBranchId } from '@eims/shared';
import {
  createBudgetForecastLineSchema,
  createFixedAssetSchema,
  createOwnerDrawingSchema,
  createPettyCashFundSchema,
  createPettyCashVoucherSchema,
  createPurchaseOrderSchema,
  createVendorBillSchema,
  createVendorSchema,
  drawingMethods,
  fixedAssetCategories,
  fixedAssetScopes,
  fixedAssetStatuses,
  PERMISSIONS,
  purchaseOrderStatuses,
  updateFixedAssetSchema,
  updatePettyCashFundSchema,
  updateVendorBillSchema,
  updateVendorSchema,
  vendorBillCategories,
  vendorPaymentMethods,
} from '@eims/shared';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { OpsRecordsPanel } from '@/components/features/ops/ops-records-panel';
import { ChequeRegisterPanel } from '@/components/features/finance-ops/cheque-register-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { useBatches } from '@/hooks/use-batches';
import { useAuth } from '@/providers/auth-provider';

const TABS = [
  { id: 'petty', label: 'Petty cash' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'bills', label: 'Bills / AP' },
  { id: 'bank', label: 'Cheques' },
  { id: 'drawings', label: 'Drawings' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'assets', label: 'Assets' },
  { id: 'forecast', label: 'Forecast' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const enumOptions = (values?: readonly string[]) =>
  (values ?? []).map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export default function FinanceOpsPage() {
  const [tab, setTab] = useState<TabId>('petty');
  const [assetScope, setAssetScope] = useState('');
  const [assetBatchId, setAssetBatchId] = useState('');
  const { session } = useAuth();
  const token = session?.access_token;
  const { effectiveScope, canSelect, isLocked, singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? getSingleBranchId(effectiveScope);
  const { data: assetBatches } = useBatches(token, branchId ?? '', undefined, tab === 'assets' && !!branchId);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Calculator}
        title="Finance operations"
        description="Petty cash, vendor bills, issued cheques, drawings, procurement, assets, and monthly forecasts — posted through the ledger"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as TabId)}
          aria-label="Finance operations sections"
          accent="coral"
        />
        {(canSelect || isLocked) && <PageBranchScopeControl />}
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch to manage finance operations records.
        </p>
      ) : tab === 'petty' ? (
        <div className="space-y-6">
          <OpsRecordsPanel
            title="Petty cash funds"
            path="/finance-ops/petty-cash/funds"
            queryKeyPrefix="petty-funds"
            branchId={branchId}
            managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
            createSchema={createPettyCashFundSchema}
            updateSchema={updatePettyCashFundSchema}
            createLabel="Add fund"
            columns={[
              { key: 'name', header: 'Fund' },
              { key: 'openingBalance', header: 'Opening balance' },
            ]}
            fields={[
              { name: 'name', label: 'Name', type: 'text', required: true },
              { name: 'openingBalance', label: 'Opening balance', type: 'number' },
            ]}
          />
          <OpsRecordsPanel
            title="Disbursements"
            path="/finance-ops/petty-cash/vouchers"
            queryKeyPrefix="petty-vouchers"
            branchId={branchId}
            managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
            createSchema={createPettyCashVoucherSchema}
            createLabel="Add voucher"
            allowEdit={false}
            columns={[
              { key: 'voucherDate', header: 'Date' },
              { key: 'fund', header: 'Fund', nested: 'fund.name' },
              { key: 'payee', header: 'Payee' },
              { key: 'amount', header: 'Amount' },
              { key: 'description', header: 'Description' },
            ]}
            fields={[
              { name: 'fundId', label: 'Fund', type: 'fund', required: true },
              { name: 'voucherDate', label: 'Date', type: 'date', required: true },
              { name: 'payee', label: 'Payee', type: 'text', required: true },
              { name: 'amount', label: 'Amount', type: 'number', required: true },
              { name: 'description', label: 'Description', type: 'text', required: true },
            ]}
          />
        </div>
      ) : tab === 'vendors' ? (
        <OpsRecordsPanel
          title="Vendors"
          path="/finance-ops/vendors"
          queryKeyPrefix="vendors"
          branchId={branchId}
          managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
          createSchema={createVendorSchema}
          updateSchema={updateVendorSchema}
          createLabel="Add vendor"
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'phone', header: 'Phone' },
            { key: 'email', header: 'Email' },
          ]}
          fields={[
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'phone', label: 'Phone', type: 'text' },
            { name: 'email', label: 'Email', type: 'text' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : tab === 'bills' ? (
        <OpsRecordsPanel
          title="Vendor bills"
          path="/finance-ops/vendor-bills"
          queryKeyPrefix="vendor-bills"
          branchId={branchId}
          managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
          createSchema={createVendorBillSchema}
          updateSchema={updateVendorBillSchema}
          createLabel="Add bill"
          columns={[
            { key: 'billDate', header: 'Date' },
            { key: 'vendor', header: 'Vendor', nested: 'vendor.name' },
            { key: 'category', header: 'Category', badge: true },
            { key: 'amount', header: 'Amount' },
            { key: 'remainingAmount', header: 'Remaining' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[
            { name: 'vendorId', label: 'Vendor', type: 'vendor', required: true, createOnly: true },
            {
              name: 'category',
              label: 'Category',
              type: 'select',
              required: true,
              createOnly: true,
              options: enumOptions(vendorBillCategories),
            },
            { name: 'billNo', label: 'Bill no', type: 'text' },
            { name: 'billDate', label: 'Bill date', type: 'date', required: true },
            { name: 'dueDate', label: 'Due date', type: 'date' },
            { name: 'amount', label: 'Amount', type: 'number', required: true, createOnly: true },
            { name: 'description', label: 'Description', type: 'textarea' },
          ]}
          extraActions={[
            {
              label: 'Record payment',
              path: (row) => `/finance-ops/vendor-bills/${row.id}/pay`,
              successMessage: 'Payment posted',
              showIf: (row) => row.status === 'open' || row.status === 'partial',
              fields: [
                { name: 'amount', label: 'Amount', type: 'number', required: true },
                { name: 'paidAt', label: 'Paid at', type: 'date', required: true },
                {
                  name: 'method',
                  label: 'Method',
                  type: 'select',
                  options: enumOptions(vendorPaymentMethods),
                },
                { name: 'chequeNumber', label: 'Cheque number', type: 'text' },
              ],
            },
          ]}
        />
      ) : tab === 'bank' ? (
        <ChequeRegisterPanel branchId={branchId} />
      ) : tab === 'drawings' ? (
        <OpsRecordsPanel
          title="Owner drawings"
          path="/finance-ops/drawings"
          queryKeyPrefix="owner-drawings"
          branchId={branchId}
          managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
          createSchema={createOwnerDrawingSchema}
          createLabel="Add drawing"
          allowEdit={false}
          columns={[
            { key: 'drawingDate', header: 'Date' },
            { key: 'payee', header: 'Payee' },
            { key: 'amount', header: 'Amount' },
            { key: 'method', header: 'Method', badge: true },
            { key: 'chequeNumber', header: 'Cheque no' },
            { key: 'notes', header: 'Notes' },
          ]}
          fields={[
            { name: 'drawingDate', label: 'Date', type: 'date', required: true },
            { name: 'payee', label: 'Payee', type: 'text', required: true },
            { name: 'amount', label: 'Amount', type: 'number', required: true },
            {
              name: 'method',
              label: 'Method',
              type: 'select',
              required: true,
              options: enumOptions(drawingMethods),
            },
            { name: 'chequeNumber', label: 'Cheque number', type: 'text' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : tab === 'procurement' ? (
        <OpsRecordsPanel
          title="Purchase orders"
          path="/finance-ops/purchase-orders"
          queryKeyPrefix="purchase-orders"
          branchId={branchId}
          managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
          createSchema={createPurchaseOrderSchema}
          createLabel="Add purchase order"
          allowEdit={false}
          columns={[
            { key: 'poNo', header: 'PO no' },
            { key: 'orderDate', header: 'Date' },
            { key: 'vendor', header: 'Vendor', nested: 'vendor.name' },
            { key: 'total', header: 'Total' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[
            { name: 'vendorId', label: 'Vendor', type: 'vendor', required: true },
            { name: 'poNo', label: 'PO number', type: 'text', required: true },
            { name: 'orderDate', label: 'Order date', type: 'date', required: true },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: enumOptions(purchaseOrderStatuses),
            },
            { name: 'lineDescription', label: 'Item', type: 'text', required: true },
            { name: 'lineQuantity', label: 'Quantity', type: 'number', required: true },
            { name: 'lineUnitCost', label: 'Unit cost', type: 'number', required: true },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          packCreate={(form) => ({
            vendorId: form.vendorId,
            poNo: form.poNo,
            orderDate: form.orderDate,
            status: form.status || 'draft',
            notes: form.notes || null,
            lines: [
              {
                description: form.lineDescription,
                quantity: Number(form.lineQuantity),
                unitCost: Number(form.lineUnitCost),
              },
            ],
          })}
          extraActions={[
            {
              label: 'Receive',
              path: (row) => `/finance-ops/purchase-orders/${row.id}/receive`,
              successMessage: 'Goods received',
              showIf: (row) => row.status !== 'received' && row.status !== 'cancelled',
              fields: [
                { name: 'receivedAt', label: 'Received date', type: 'date', required: true },
                { name: 'notes', label: 'Notes', type: 'textarea' },
              ],
            },
          ]}
        />
      ) : tab === 'assets' ? (
        <OpsRecordsPanel
          title="Fixed assets"
          path="/finance-ops/assets"
          queryKeyPrefix="fixed-assets"
          branchId={branchId}
          managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
          createSchema={createFixedAssetSchema}
          updateSchema={updateFixedAssetSchema}
          createLabel="Add asset"
          extraQuery={{
            ...(assetScope ? { scope: assetScope } : {}),
            ...(assetBatchId ? { batchId: assetBatchId } : {}),
          }}
          extraFilters={
            <>
              <SelectDropdown
                aria-label="Filter by scope"
                placeholder="All scopes"
                value={assetScope}
                onValueChange={(value) => {
                  setAssetScope(value);
                  if (value !== 'class') setAssetBatchId('');
                }}
                options={[
                  { value: '', label: 'All scopes' },
                  ...enumOptions(fixedAssetScopes).map((opt) => ({
                    ...opt,
                    label: opt.value === 'school' ? 'School-wise' : 'Class-wise',
                  })),
                ]}
              />
              <SelectDropdown
                aria-label="Filter by class"
                placeholder="All classes"
                value={assetBatchId}
                onValueChange={setAssetBatchId}
                options={[
                  { value: '', label: 'All classes' },
                  ...((assetBatches?.data ?? []).map((b) => ({
                    value: b.id,
                    label: b.name,
                  })) as Array<{ value: string; label: string }>),
                ]}
              />
            </>
          }
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'category', header: 'Category' },
            { key: 'scope', header: 'Scope' },
            { key: 'quantity', header: 'Qty' },
            { key: 'batch', header: 'Class', nested: 'batch.name' },
            { key: 'purchaseDate', header: 'Purchased' },
            { key: 'cost', header: 'Cost' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[
            { name: 'name', label: 'Name', type: 'text', required: true },
            {
              name: 'category',
              label: 'Category',
              type: 'select',
              required: true,
              options: enumOptions(fixedAssetCategories),
            },
            {
              name: 'scope',
              label: 'Scope',
              type: 'select',
              required: true,
              options: [
                { value: 'school', label: 'School-wise' },
                { value: 'class', label: 'Class-wise' },
              ],
            },
            { name: 'quantity', label: 'Quantity', type: 'number', required: true },
            {
              name: 'batchId',
              label: 'Class',
              type: 'batch',
              required: true,
              showWhen: (form) => form.scope === 'class',
            },
            { name: 'purchaseDate', label: 'Purchase date', type: 'date' },
            { name: 'cost', label: 'Cost', type: 'number', required: true },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: enumOptions(fixedAssetStatuses),
            },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : (
        <OpsRecordsPanel
          title="Budget forecast lines"
          path="/finance-ops/forecast-lines"
          queryKeyPrefix="forecast-lines"
          branchId={branchId}
          managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
          createSchema={createBudgetForecastLineSchema}
          createLabel="Add forecast month"
          columns={[
            { key: 'budget', header: 'Budget', nested: 'budget.name' },
            { key: 'year', header: 'Year', nested: 'budget.year' },
            { key: 'month', header: 'Month' },
            { key: 'amount', header: 'Amount' },
          ]}
          fields={[
            { name: 'budgetId', label: 'Budget', type: 'budget', required: true },
            { name: 'month', label: 'Month (1-12)', type: 'number', required: true },
            { name: 'amount', label: 'Amount', type: 'number', required: true },
          ]}
        />
      )}
    </div>
  );
}
