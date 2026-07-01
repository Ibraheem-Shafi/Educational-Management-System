'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { formatCurrency } from '@eims/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';

interface Invoice {
  id: string;
  student?: { fullName: string };
  feeType?: { name: string };
  netAmount: number;
  status?: { label: string; code: string };
  paidAt: string | null;
}

interface Student {
  id: string;
  fullName: string;
}

interface FeeType {
  id: string;
  name: string;
}

export default function FeesPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [fine, setFine] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invoicePage, setInvoicePage] = useState(1);
  const branchId = user?.branchId ?? '';

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: { id: string; name: string }[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || user?.branchId || branches?.data[0]?.id || '';

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['fee-invoices', effectiveBranchId, invoicePage],
    queryFn: () =>
      apiClient<PaginatedResponse<Invoice>>(
        `/fee-invoices?branchId=${effectiveBranchId}&page=${invoicePage}&limit=20`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: defaulters } = useQuery({
    queryKey: ['fee-defaulters', effectiveBranchId],
    queryFn: () =>
      apiClient<{
        data: Array<{
          id: string;
          student: { fullName: string };
          netAmount: number;
          dueDate: string | null;
        }>;
        total: number;
      }>(`/reports/fee-defaulters`, { token }),
    enabled: !!token,
  });

  const { data: students } = useQuery({
    queryKey: ['students-fees'],
    queryFn: () => apiClient<PaginatedResponse<Student>>('/students?limit=100', { token }),
    enabled: !!token && showForm,
  });

  const { data: feeTypes } = useQuery({
    queryKey: ['fee-types'],
    queryFn: () => apiClient<{ data: FeeType[] }>('/fee-types', { token }),
    enabled: !!token && showForm,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/fee-invoices', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Invoice created');
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      setShowForm(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const payMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/fee-invoices/${id}/pay`, { method: 'PATCH', token, body: '{}' }),
    onSuccess: () => {
      toast.success('Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees"
        description="Invoices and payment collection"
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'New invoice'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  branchId: effectiveBranchId,
                  studentId,
                  feeTypeId,
                  amount: Number(amount),
                  ...(discount ? { discount: Number(discount) } : {}),
                  ...(fine ? { fine: Number(fine) } : {}),
                  ...(dueDate ? { dueDate: new Date(dueDate).toISOString() } : {}),
                });
              }}
            >
              <select
                className={filterSelectClass}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              >
                <option value="">Student</option>
                {students?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              <select
                className={filterSelectClass}
                value={feeTypeId}
                onChange={(e) => setFeeTypeId(e.target.value)}
                required
              >
                <option value="">Fee type</option>
                {feeTypes?.data.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Amount (PKR)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Input
                type="number"
                placeholder="Discount"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Late fine"
                value={fine}
                onChange={(e) => setFine(e.target.value)}
              />
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <Button type="submit" disabled={createMutation.isPending} className="sm:col-span-2 w-fit">
                Create invoice
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fee defaulters ({defaulters?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {defaulters?.data.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">No overdue invoices</p>
            )}
            {defaulters?.data.map((inv) => (
              <ListRow
                key={inv.id}
                actions={
                  <Button size="sm" onClick={() => payMutation.mutate(inv.id)}>
                    Record payment
                  </Button>
                }
              >
                <p className="font-medium">{inv.student.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  Due {inv.dueDate ?? '—'} · {formatCurrency(inv.netAmount)}
                </p>
              </ListRow>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices ({invoices?.meta.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {invoices?.data.map((inv) => (
              <ListRow
                key={inv.id}
                actions={
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-muted-foreground">{inv.status?.label}</span>
                    {!inv.paidAt && (
                      <Button size="sm" onClick={() => payMutation.mutate(inv.id)}>
                        Record payment
                      </Button>
                    )}
                  </div>
                }
              >
                <p className="font-medium">{inv.student?.fullName ?? '—'}</p>
                <p className="text-sm text-muted-foreground">
                  {inv.feeType?.name} · {formatCurrency(inv.netAmount)}
                </p>
              </ListRow>
            ))}
          </div>
          {invoices && (
            <PaginationBar
              page={invoicePage}
              totalPages={invoices.meta.totalPages}
              onPageChange={setInvoicePage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
