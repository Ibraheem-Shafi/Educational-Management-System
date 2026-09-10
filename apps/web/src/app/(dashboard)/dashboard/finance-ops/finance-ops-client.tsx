'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { getSingleBranchId } from '@eims/shared';
import {
  bankStatementStatuses,
  createBankStatementSchema,
  createBudgetForecastLineSchema,
  createFixedAssetSchema,
  createPettyCashFundSchema,
  createPettyCashVoucherSchema,
  createPurchaseOrderSchema,
  createVendorBillSchema,
  createVendorSchema,
  fixedAssetStatuses,
  PERMISSIONS,
  purchaseOrderStatuses,
  updateBankStatementSchema,
  updateFixedAssetSchema,
  updatePettyCashFundSchema,
  updateVendorBillSchema,
  updateVendorSchema,
  vendorBillCategories,
} from '@eims/shared';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { OpsRecordsPanel } from '@/components/features/ops/ops-records-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'petty', label: 'Petty cash' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'bills', label: 'Bills / AP' },
  { id: 'bank', label: 'Bank rec' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'assets', label: 'Assets' },
  { id: 'forecast', label: 'Forecast' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const enumOptions = (values?: readonly string[]) =>
  (values ?? []).map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export default function FinanceOpsPage() {
  const [tab, setTab] = useState<TabId>('petty');
  const { effectiveScope, canSelect, isLocked, singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? getSingleBranchId(effectiveScope);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Calculator}
        title="Finance operations"
        description="Petty cash, vendor bills, bank rec, procurement, assets, and monthly forecasts — posted through the ledger"
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
                { name: 'method', label: 'Method', type: 'text' },
              ],
            },
          ]}
        />
      ) : tab === 'bank' ? (
        <OpsRecordsPanel
          title="Bank statements"
          path="/finance-ops/bank-statements"
          queryKeyPrefix="bank-statements"
          branchId={branchId}
          managePermission={PERMISSIONS.ACCOUNTING_MANAGE}
          createSchema={createBankStatementSchema}
          updateSchema={updateBankStatementSchema}
          createLabel="Add statement"
          columns={[
            { key: 'periodFrom', header: 'From' },
            { key: 'periodTo', header: 'To' },
            { key: 'account', header: 'Account', nested: 'account.name' },
            { key: 'lineCount', header: 'Lines' },
            { key: 'matchedCount', header: 'Matched' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[
            { name: 'periodFrom', label: 'Period from', type: 'date', required: true },
            { name: 'periodTo', label: 'Period to', type: 'date', required: true },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: enumOptions(bankStatementStatuses),
            },
          ]}
          extraActions={[
            {
              label: 'Add line',
              path: (row) => `/finance-ops/bank-statements/${row.id}/lines`,
              successMessage: 'Line added',
              fields: [
                { name: 'lineDate', label: 'Date', type: 'date', required: true },
                { name: 'amount', label: 'Amount', type: 'number', required: true },
                { name: 'description', label: 'Description', type: 'text', required: true },
              ],
            },
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
          columns={[
            { key: 'name', header: 'Name' },
            { key: 'category', header: 'Category' },
            { key: 'purchaseDate', header: 'Purchased' },
            { key: 'cost', header: 'Cost' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'category', label: 'Category', type: 'text', required: true },
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
