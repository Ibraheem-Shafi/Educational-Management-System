'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function CommunicationsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [recipient, setRecipient] = useState('');
  const [body, setBody] = useState('');
  const [noticeId, setNoticeId] = useState('');
  const [logPage, setLogPage] = useState(1);

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['communication-logs', logPage],
    queryFn: () =>
      apiClient<
        PaginatedResponse<{
          id: string;
          channel: string;
          recipient: string;
          status: string;
          createdAt: string;
        }>
      >(`/communications/logs?page=${logPage}&limit=20`, { token }),
    enabled: !!token,
  });

  const { data: notices } = useQuery({
    queryKey: ['notices-broadcast'],
    queryFn: () =>
      apiClient<{ data: Array<{ id: string; title: string }> }>('/notices?publishedOnly=true', { token }),
    enabled: !!token,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      apiClient('/communications/send', {
        method: 'POST',
        token,
        body: JSON.stringify({ channel, recipient, body }),
      }),
    onSuccess: () => {
      toast.success('Message queued');
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      setBody('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const feeReminderMutation = useMutation({
    mutationFn: () =>
      apiClient<{ sent: number }>('/communications/fee-reminders', {
        method: 'POST',
        token,
        body: JSON.stringify({ channel }),
      }),
    onSuccess: (res) => {
      toast.success(`Sent ${res.sent} fee reminders`);
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const broadcastMutation = useMutation({
    mutationFn: () =>
      apiClient<{ sent: number }>('/communications/notice-broadcast', {
        method: 'POST',
        token,
        body: JSON.stringify({ noticeId, channel, audience: 'parents' }),
      }),
    onSuccess: (res) => {
      toast.success(`Broadcast sent to ${res.sent} recipients`);
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Communications" description="SMS and WhatsApp messaging (Twilio)" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Send message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value as 'sms' | 'whatsapp')}
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <Input
              placeholder="Recipient phone (+92...)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="Message body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
              Send
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={() => feeReminderMutation.mutate()}>
              Send fee reminders to defaulters
            </Button>
            <select
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={noticeId}
              onChange={(e) => setNoticeId(e.target.value)}
            >
              <option value="">Select notice to broadcast</option>
              {notices?.data.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
            <Button
              onClick={() => broadcastMutation.mutate()}
              disabled={!noticeId || broadcastMutation.isPending}
            >
              Broadcast notice to parents
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent messages</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {logs?.data.map((log) => (
              <ListRow
                key={log.id}
                actions={
                  <span className="text-sm text-muted-foreground">
                    {log.status} · {new Date(log.createdAt).toLocaleString()}
                  </span>
                }
              >
                <span>
                  {log.channel} → {log.recipient}
                </span>
              </ListRow>
            ))}
          </div>
          {logs && (
            <PaginationBar page={logPage} totalPages={logs.meta.totalPages} onPageChange={setLogPage} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
