import React, { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { ChildSwitcher } from '@/components/ChildSwitcher';
import {
  Badge,
  Card,
  EmptyView,
  ErrorView,
  Field,
  ListRow,
  LoadingView,
  PrimaryButton,
  Screen,
  StatCard,
  Subtitle,
  Title,
} from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useChildContext } from '@/lib/child-context';
import { buildQuery } from '@/lib/config';
import { currentMonth, formatCurrency, formatDate, formatPercent, titleCase, todayIso } from '@/lib/format';
import { colors, paletteAccents } from '@/lib/theme';
import type {
  LeaveRequestItem,
  LearningResourceItem,
  PaginatedResponse,
  ParentPortalData,
  PortalAssessmentsResponse,
  PortalAttendanceResponse,
  PortalCalendarEvent,
  PortalDocumentItem,
  PortalFeeInvoice,
  PortalFeesResponse,
  PortalNoticeItem,
  PortalParentStatsResponse,
  PortalProfileResponse,
  PortalStudentInsightsResponse,
  PortalStudentStatsResponse,
  PortalTimetableResponse,
  StudentPortalData,
} from '@/lib/types';

function statusTone(status?: string | null): 'teal' | 'coral' | 'yellow' | 'green' | 'navy' {
  const value = (status ?? '').toLowerCase();
  if (value.includes('present') || value.includes('paid') || value.includes('approved')) return 'green';
  if (value.includes('absent') || value.includes('overdue') || value.includes('rejected')) return 'coral';
  if (value.includes('late') || value.includes('pending') || value.includes('partial')) return 'yellow';
  return 'navy';
}

export function PortalHomeScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken, user } = useAuth();
  const { selectedStudentId, setSelectedStudentId } = useChildContext();
  const parentPortal = useQuery({
    queryKey: ['portal-parent'],
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token: accessToken }),
    enabled: role === 'parent' && !!accessToken,
  });
  const studentPortal = useQuery({
    queryKey: ['portal-student'],
    queryFn: () => apiClient<StudentPortalData>('/portal/student', { token: accessToken }),
    enabled: role === 'student' && !!accessToken,
  });
  const stats = useQuery({
    queryKey: ['portal-stats', role],
    queryFn: () =>
      apiClient<PortalParentStatsResponse | PortalStudentStatsResponse>(`/portal/${role}/stats`, {
        token: accessToken,
      }),
    enabled: !!accessToken,
  });
  const dueSoon = useQuery({
    queryKey: ['learning-due', role, selectedStudentId],
    queryFn: () =>
      apiClient<{ data: LearningResourceItem[] }>(
        `/portal/${role}/learning/due-soon${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (role === 'student' || !!selectedStudentId),
  });
  const notices = useQuery({
    queryKey: ['notices-home', role],
    queryFn: () =>
      apiClient<PaginatedResponse<PortalNoticeItem>>(`/portal/${role}/notices?limit=3`, { token: accessToken }),
    enabled: !!accessToken,
  });

  useEffect(() => {
    if (role !== 'parent' || !parentPortal.data?.children.length) return;
    if (!selectedStudentId) void setSelectedStudentId(parentPortal.data.children[0].student.id);
  }, [parentPortal.data, role, selectedStudentId, setSelectedStudentId]);

  const refetch = () => {
    void stats.refetch();
    void dueSoon.refetch();
    void notices.refetch();
    if (role === 'parent') void parentPortal.refetch();
    else void studentPortal.refetch();
  };

  if (stats.isLoading) return <LoadingView />;
  if (stats.error) {
    return <ErrorView message={stats.error instanceof Error ? stats.error.message : 'Failed to load'} onRetry={refetch} />;
  }

  const parentStats = role === 'parent' ? (stats.data as PortalParentStatsResponse) : null;
  const studentStats = role === 'student' ? (stats.data as PortalStudentStatsResponse) : null;

  return (
    <Screen onRefresh={refetch} refreshing={stats.isFetching}>
      <Title>Hi, {user?.fullName?.split(' ')[0] ?? 'there'}</Title>
      <Subtitle>{role === 'parent' ? 'Your family overview' : 'Your day at a glance'}</Subtitle>
      {role === 'parent' ? <ChildSwitcher /> : null}

      <View className="mb-3 flex-row flex-wrap gap-2">
        {parentStats ? (
          <>
            <StatCard label="Children" value={parentStats.childrenCount.value} accent={colors.orange} />
            <StatCard label="Attendance" value={formatPercent(parentStats.aggregateAttendance.value)} accent={colors.teal} />
            <StatCard label="Outstanding" value={formatCurrency(parentStats.totalOutstanding.value)} accent={colors.coral} />
            <StatCard label="Notices" value={parentStats.recentNotices.value} accent={colors.purple} />
          </>
        ) : null}
        {studentStats ? (
          <>
            <StatCard label="Attendance" value={formatPercent(studentStats.attendanceRate.value)} accent={colors.teal} />
            <StatCard label="Fees due" value={formatCurrency(studentStats.outstandingFees.value)} accent={colors.coral} />
            <StatCard label="Avg grade" value={formatPercent(studentStats.averageGrade.value)} accent={colors.orange} />
            <StatCard label="Classes" value={studentStats.upcomingClasses.value} accent={colors.green} />
          </>
        ) : null}
      </View>

      {dueSoon.data?.data?.length ? (
        <Card>
          <Text className="mb-2 text-base font-semibold text-navy">Due soon</Text>
          {dueSoon.data.data.map((item) => (
            <ListRow
              key={item.id}
              title={item.title}
              subtitle={[titleCase(item.type), item.dueAt ? formatDate(item.dueAt) : null].filter(Boolean).join(' · ')}
              onPress={() => router.push(`/${role}/learning/${item.id}` as never)}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <Text className="mb-2 text-base font-semibold text-navy">Notices</Text>
        {(notices.data?.data ?? []).length === 0 ? (
          <EmptyView message="No notices yet." />
        ) : (
          (notices.data?.data ?? []).map((notice) => (
            <ListRow
              key={notice.id}
              title={notice.title}
              subtitle={formatDate(notice.publishedAt)}
              onPress={() => router.push(`/${role}/notices/${notice.id}` as never)}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

export function PortalAttendanceScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const query = useQuery({
    queryKey: ['attendance', role, selectedStudentId],
    queryFn: () =>
      apiClient<PortalAttendanceResponse>(
        `/portal/${role}/attendance${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (role === 'student' || !!selectedStudentId),
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const data = query.data!;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Attendance</Title>
      {role === 'parent' ? <ChildSwitcher /> : null}
      <View className="mb-3 flex-row flex-wrap gap-2">
        <StatCard label="Present" value={formatPercent(data.summary.presentRate)} accent={colors.green} />
        <StatCard label="Absent" value={data.summary.absent} accent={colors.coral} />
        <StatCard label="Late" value={data.summary.late} accent={colors.yellow} />
      </View>
      {data.records.data.length === 0 ? (
        <EmptyView message="No attendance records yet." />
      ) : (
        data.records.data.map((record) => (
          <ListRow
            key={record.id}
            title={formatDate(record.date)}
            subtitle={record.remarks ?? undefined}
            right={<Badge label={record.status?.label ?? '—'} tone={statusTone(record.status?.label)} />}
          />
        ))
      )}
    </Screen>
  );
}

export function PortalAssessmentsScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const query = useQuery({
    queryKey: ['assessments', role, selectedStudentId],
    queryFn: () =>
      apiClient<PortalAssessmentsResponse>(
        `/portal/${role}/assessments${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (role === 'student' || !!selectedStudentId),
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const data = query.data!;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Assessments</Title>
      {role === 'parent' ? <ChildSwitcher /> : null}
      <StatCard label="Average" value={formatPercent(data.averagePercentage)} accent={colors.orange} />
      <View className="h-3" />
      {data.bySubject.map((subject, index) => (
        <ListRow
          key={subject.subjectName}
          title={subject.subjectName}
          right={<Text style={{ color: paletteAccents[index % paletteAccents.length], fontWeight: '700' }}>{formatPercent(subject.averagePercentage)}</Text>}
        />
      ))}
      {data.records.data.map((record) => (
        <ListRow
          key={record.id}
          title={record.assessmentName ?? 'Assessment'}
          subtitle={[record.subjectName, record.grade].filter(Boolean).join(' · ')}
          right={<Text className="font-bold text-navy">{formatPercent(record.percentage)}</Text>}
        />
      ))}
    </Screen>
  );
}

export function PortalFeesScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['fees', role, selectedStudentId],
    queryFn: () =>
      apiClient<PortalFeesResponse>(
        `/portal/${role}/fees${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (role === 'student' || !!selectedStudentId),
  });
  const pay = useMutation({
    mutationFn: (invoiceId: string) =>
      apiClient<{ paymentId: string; checkoutUrl: string; provider: string }>('/payments/checkout', {
        method: 'POST',
        token: accessToken,
        body: { invoiceId },
      }),
    onSuccess: async (data) => {
      if (data.provider === 'mock') {
        router.push(`/${role}/pay/${data.paymentId}` as never);
        return;
      }
      if (data.checkoutUrl) await WebBrowser.openBrowserAsync(data.checkoutUrl);
      void queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const payable = new Set(['pending', 'partial', 'overdue']);
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Fees</Title>
      {role === 'parent' ? <ChildSwitcher /> : null}
      <StatCard label="Outstanding" value={formatCurrency(query.data?.outstanding)} accent={colors.coral} />
      <View className="h-3" />
      {(query.data?.invoices.data ?? []).length === 0 ? (
        <EmptyView message="No invoices found." />
      ) : (
        (query.data?.invoices.data ?? []).map((invoice: PortalFeeInvoice) => (
          <Card key={invoice.id}>
            <Text className="text-base font-semibold text-ink">{invoice.feeType?.name ?? 'Fee'}</Text>
            <Text className="mt-1 text-sm text-muted">{formatCurrency(invoice.netAmount)}</Text>
            <View className="mt-2">
              <Badge label={invoice.status?.label ?? 'Unknown'} tone={statusTone(invoice.status?.code ?? invoice.status?.label)} />
            </View>
            {payable.has((invoice.status?.code ?? '').toLowerCase()) ? (
              <PrimaryButton
                label={pay.isPending ? 'Opening…' : 'Pay now'}
                onPress={() => pay.mutate(invoice.id)}
                disabled={pay.isPending}
              />
            ) : null}
          </Card>
        ))
      )}
      {pay.error ? <Text className="text-coral">{pay.error instanceof Error ? pay.error.message : 'Payment failed'}</Text> : null}
    </Screen>
  );
}

export function PortalPayScreen({ role, paymentId }: { role: 'parent' | 'student'; paymentId: string }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const payment = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () =>
      apiClient<{
        id: string;
        amount: number;
        provider: string;
        status: string;
        invoice: { feeType?: { name: string } | null };
      }>(`/payments/${paymentId}`, { token: accessToken }),
    enabled: !!accessToken && !!paymentId,
  });
  const confirm = useMutation({
    mutationFn: () =>
      apiClient('/payments/webhooks/mock', { method: 'POST', token: accessToken, body: { paymentId } }),
    onSuccess: () => {
      void payment.refetch();
      void queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });
  if (payment.isLoading) return <LoadingView />;
  if (payment.error || !payment.data) return <ErrorView message="Unable to load payment" />;
  const paid = payment.data.status === 'succeeded';
  return (
    <Screen>
      <Title>Payment</Title>
      <Card>
        <Text className="text-base font-semibold">{payment.data.invoice.feeType?.name ?? 'Fee payment'}</Text>
        <Text className="mt-2 text-2xl font-bold text-navy">{formatCurrency(payment.data.amount)}</Text>
        <View className="mt-2">
          <Badge label={paid ? 'Paid' : payment.data.status} tone={paid ? 'green' : 'yellow'} />
        </View>
      </Card>
      {!paid && payment.data.provider === 'mock' ? (
        <PrimaryButton label={confirm.isPending ? 'Confirming…' : 'Confirm payment'} onPress={() => confirm.mutate()} disabled={confirm.isPending} />
      ) : null}
      <PrimaryButton label="Back to fees" onPress={() => router.replace(`/${role}/(tabs)/fees` as never)} color={colors.teal} />
    </Screen>
  );
}

export function PortalLearningScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const query = useQuery({
    queryKey: ['learning', role, selectedStudentId],
    queryFn: () =>
      apiClient<PaginatedResponse<LearningResourceItem>>(
        `/portal/${role}/learning${buildQuery({ studentId: role === 'parent' ? selectedStudentId : undefined, limit: 30 })}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (role === 'student' || !!selectedStudentId),
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const items = query.data?.data ?? [];
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Learning</Title>
      {role === 'parent' ? <ChildSwitcher /> : null}
      {items.length === 0 ? (
        <EmptyView message="No homework or resources right now." />
      ) : (
        items.map((item) => (
          <ListRow
            key={item.id}
            title={item.title}
            subtitle={[titleCase(item.type), item.subject?.name ?? item.subjectName, item.dueAt ? `Due ${formatDate(item.dueAt)}` : null]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => router.push(`/${role}/learning/${item.id}` as never)}
          />
        ))
      )}
    </Screen>
  );
}

export function PortalLearningDetailScreen({ role, id }: { role: 'parent' | 'student'; id: string }) {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const query = useQuery({
    queryKey: ['learning-detail', role, id, selectedStudentId],
    queryFn: () =>
      apiClient<LearningResourceItem>(
        `/portal/${role}/learning/${id}${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && !!id && (role === 'student' || !!selectedStudentId),
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error || !query.data) return <ErrorView message="Unable to load resource" />;
  const item = query.data;
  return (
    <Screen>
      <Title>{item.title}</Title>
      <Badge label={titleCase(item.type)} />
      {item.body ? <Text className="mt-4 text-[15px] leading-6 text-ink">{item.body}</Text> : null}
      {item.meetingUrl ? (
        <PrimaryButton label="Open class link" onPress={() => Linking.openURL(item.meetingUrl!)} />
      ) : null}
      {(item.attachments ?? []).map((attachment) => (
        <PrimaryButton
          key={attachment.id}
          label={`Download ${attachment.fileName}`}
          color={colors.teal}
          onPress={async () => {
            const result = await apiClient<{ signedUrl: string }>(
              `/portal/${role}/learning/${id}/attachments/${attachment.id}/signed-url${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
              { token: accessToken },
            );
            await WebBrowser.openBrowserAsync(result.signedUrl);
          }}
        />
      ))}
    </Screen>
  );
}

export function PortalNoticesScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['notices', role],
    queryFn: () => apiClient<PaginatedResponse<PortalNoticeItem>>(`/portal/${role}/notices?limit=50`, { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const items = query.data?.data ?? [];
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Notices</Title>
      {items.length === 0 ? (
        <EmptyView message="No announcements." />
      ) : (
        items.map((notice) => (
          <ListRow
            key={notice.id}
            title={notice.title}
            subtitle={formatDate(notice.publishedAt)}
            onPress={() => router.push(`/${role}/notices/${notice.id}` as never)}
          />
        ))
      )}
    </Screen>
  );
}

export function PortalNoticeDetailScreen({ role, id }: { role: 'parent' | 'student' | 'teacher'; id: string }) {
  const { accessToken } = useAuth();
  const path = role === 'teacher' ? '/portal/teacher/notices' : `/portal/${role}/notices?limit=50`;
  const query = useQuery({
    queryKey: ['notices', role],
    queryFn: () =>
      apiClient<{ data: PortalNoticeItem[] } | PaginatedResponse<PortalNoticeItem>>(path, { token: accessToken }),
    enabled: !!accessToken,
  });
  const notice = (query.data?.data ?? []).find((item) => item.id === id);
  if (query.isLoading) return <LoadingView />;
  if (!notice) return <ErrorView message="Notice not found" />;
  return (
    <Screen>
      <Title>{notice.title}</Title>
      <Subtitle>{formatDate(notice.publishedAt)} · {titleCase(notice.audience)}</Subtitle>
      <Text className="text-[15px] leading-6 text-ink">{notice.body}</Text>
    </Screen>
  );
}

export function PortalTimetableScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const query = useQuery({
    queryKey: ['timetable', role, selectedStudentId],
    queryFn: () =>
      apiClient<PortalTimetableResponse>(
        `/portal/${role}/timetable${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (role === 'student' || !!selectedStudentId),
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const slots = query.data?.slots ?? [];
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Timetable</Title>
      {role === 'parent' ? <ChildSwitcher /> : null}
      {query.data?.todaySlots?.length ? (
        <Card>
          <Text className="mb-2 font-semibold text-navy">Today</Text>
          {query.data.todaySlots.map((slot, index) => (
            <Text key={`${slot.startTime}-${index}`} className="mb-1 text-sm text-ink">
              {slot.startTime}–{slot.endTime} · {slot.subjectName ?? 'Class'} {slot.teacherName ? `· ${slot.teacherName}` : ''}
            </Text>
          ))}
        </Card>
      ) : null}
      {slots.length === 0 ? (
        <EmptyView message="No timetable published yet." />
      ) : (
        slots.map((slot, index) => (
          <ListRow
            key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
            title={slot.subjectName ?? 'Class'}
            subtitle={`${['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][slot.dayOfWeek] ?? ''} · ${slot.startTime}–${slot.endTime}${slot.room ? ` · ${slot.room}` : ''}${slot.teacherName ? ` · ${slot.teacherName}` : ''}`}
          />
        ))
      )}
    </Screen>
  );
}

export function PortalDocumentsScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const query = useQuery({
    queryKey: ['documents', role, selectedStudentId],
    queryFn: () =>
      apiClient<PaginatedResponse<PortalDocumentItem>>(
        `/portal/${role}/documents${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (role === 'student' || !!selectedStudentId),
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const items = query.data?.data ?? [];
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Documents</Title>
      {role === 'parent' ? <ChildSwitcher /> : null}
      {items.length === 0 ? (
        <EmptyView message="No documents available." />
      ) : (
        items.map((doc) => (
          <ListRow
            key={doc.id}
            title={doc.title}
            subtitle={`${titleCase(doc.category)} · ${formatDate(doc.createdAt)}`}
            onPress={async () => {
              const result = await apiClient<{ signedUrl: string }>(
                `/portal/${role}/documents/${doc.id}/signed-url${role === 'parent' ? buildQuery({ studentId: selectedStudentId }) : ''}`,
                { token: accessToken },
              );
              await WebBrowser.openBrowserAsync(result.signedUrl);
            }}
          />
        ))
      )}
    </Screen>
  );
}

export function PortalCalendarScreen({ role }: { role: 'parent' | 'student' }) {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const [month, setMonth] = useState(currentMonth());
  const query = useQuery({
    queryKey: ['calendar', role, selectedStudentId, month],
    queryFn: () =>
      apiClient<{ month: string; events: PortalCalendarEvent[] }>(
        `/portal/${role}/calendar${buildQuery({ month, studentId: role === 'parent' ? selectedStudentId : undefined })}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && (role === 'student' || !!selectedStudentId),
  });
  const shiftMonth = (delta: number) => {
    const [year, mon] = month.split('-').map(Number);
    const date = new Date(year, mon - 1 + delta, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Calendar</Title>
      {role === 'parent' ? <ChildSwitcher /> : null}
      <View className="mb-3 flex-row items-center justify-between">
        <Pressable onPress={() => shiftMonth(-1)}><Text className="font-semibold text-teal">Prev</Text></Pressable>
        <Text className="font-bold text-navy">{month}</Text>
        <Pressable onPress={() => shiftMonth(1)}><Text className="font-semibold text-teal">Next</Text></Pressable>
      </View>
      {(query.data?.events ?? []).length === 0 ? (
        <EmptyView message="No events this month." />
      ) : (
        (query.data?.events ?? []).map((event, index) => (
          <ListRow key={`${event.date}-${index}`} title={event.title} subtitle={`${formatDate(event.date)} · ${titleCase(event.type)}`} />
        ))
      )}
    </Screen>
  );
}

export function PortalLeaveScreen() {
  const { accessToken } = useAuth();
  const { selectedStudentId } = useChildContext();
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['leave', selectedStudentId],
    queryFn: () =>
      apiClient<PaginatedResponse<LeaveRequestItem>>(
        `/portal/parent/leave${buildQuery({ studentId: selectedStudentId })}`,
        { token: accessToken },
      ),
    enabled: !!accessToken,
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId) throw new Error('Select a child first');
      const created = await apiClient<LeaveRequestItem>('/portal/parent/leave', {
        method: 'POST',
        token: accessToken,
        body: { studentId: selectedStudentId, fromDate, toDate, reason },
      });
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!picked.canceled && picked.assets[0]) {
        const file = picked.assets[0];
        const upload = await apiClient<{ signedUrl: string; path: string }>(
          `/portal/parent/leave/${created.id}/attachment/upload-url`,
          { method: 'POST', token: accessToken, body: { fileName: file.name } },
        );
        const blob = await fetch(file.uri).then((res) => res.blob());
        await fetch(upload.signedUrl, { method: 'PUT', body: blob });
        await apiClient(`/portal/parent/leave/${created.id}/attachment`, {
          method: 'POST',
          token: accessToken,
          body: { fileName: file.name, storagePath: upload.path, mimeType: file.mimeType, sizeBytes: file.size },
        });
      }
      return created;
    },
    onSuccess: () => {
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['leave'] });
    },
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Leave requests</Title>
      <ChildSwitcher />
      <Card>
        <Field label="From (YYYY-MM-DD)" value={fromDate} onChangeText={setFromDate} />
        <Field label="To (YYYY-MM-DD)" value={toDate} onChangeText={setToDate} />
        <Field label="Reason" value={reason} onChangeText={setReason} multiline />
        <PrimaryButton
          label={create.isPending ? 'Submitting…' : 'Submit leave'}
          onPress={() => create.mutate()}
          disabled={create.isPending || reason.trim().length < 3}
        />
        {create.error ? <Text className="mt-2 text-coral">{create.error instanceof Error ? create.error.message : 'Failed'}</Text> : null}
      </Card>
      {(query.data?.data ?? []).map((item) => (
        <ListRow
          key={item.id}
          title={`${formatDate(item.fromDate)} – ${formatDate(item.toDate)}`}
          subtitle={item.reason}
          right={<Badge label={item.status} tone={statusTone(item.status)} />}
        />
      ))}
    </Screen>
  );
}

export function PortalInsightsScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['insights'],
    queryFn: () => apiClient<PortalStudentInsightsResponse>('/portal/student/insights', { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const data = query.data!;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Insights</Title>
      <Subtitle>Preview of your academic summary</Subtitle>
      <StatCard label="Overall" value={formatPercent(data.overallPercentage)} accent={colors.purple} />
      <Card>
        <Text className="text-[15px] leading-6 text-ink">{data.narrative}</Text>
      </Card>
      {data.recommendations.map((tip) => (
        <ListRow key={tip.subject} title={tip.subject} subtitle={tip.tip} />
      ))}
    </Screen>
  );
}

export function PortalProfileScreen({ role }: { role: 'parent' | 'student' | 'teacher' }) {
  const { accessToken, signOut, user } = useAuth();
  const [phone, setPhone] = useState('');
  const query = useQuery<PortalProfileResponse>({
    queryKey: ['profile', role],
    queryFn: async () => {
      if (role === 'teacher') {
        return {
          user: {
            id: user?.id ?? '',
            email: user?.email ?? '',
            fullName: user?.fullName ?? '',
            phone: null,
            gender: null,
            roles: user?.roles ?? [],
          },
        };
      }
      return apiClient<PortalProfileResponse>(`/portal/${role}/profile`, { token: accessToken });
    },
    enabled: !!accessToken,
  });
  const update = useMutation({
    mutationFn: () => apiClient('/auth/me', { method: 'PATCH', token: accessToken, body: { phone } }),
  });
  useEffect(() => {
    if (query.data?.user.phone) setPhone(query.data.user.phone);
  }, [query.data?.user.phone]);
  if (query.isLoading) return <LoadingView />;
  const profile = query.data;
  return (
    <Screen>
      <Title>Profile</Title>
      <Card>
        <Text className="text-lg font-semibold text-ink">{profile?.user.fullName}</Text>
        <Text className="text-sm text-muted">{profile?.user.email}</Text>
        <Text className="mt-1 text-sm text-muted">{profile?.user.roles.join(', ')}</Text>
      </Card>
      {role !== 'teacher' ? (
        <Card>
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <PrimaryButton label={update.isPending ? 'Saving…' : 'Save'} onPress={() => update.mutate()} disabled={update.isPending} />
        </Card>
      ) : null}
      <PrimaryButton
        label="Sign out"
        color={colors.coral}
        onPress={async () => {
          await signOut();
          router.replace('/(auth)/login');
        }}
      />
    </Screen>
  );
}

export function ParentChildrenScreen() {
  const { accessToken } = useAuth();
  const { setSelectedStudentId } = useChildContext();
  const query = useQuery({
    queryKey: ['portal-parent'],
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  const children = query.data?.children ?? [];
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>My children</Title>
      {children.length === 0 ? (
        <EmptyView message={query.data?.message ?? 'No children linked yet.'} />
      ) : (
        children.map((child) => (
          <ListRow
            key={child.student.id}
            title={child.student.fullName}
            subtitle={titleCase(child.relationshipCode)}
            onPress={() => {
              void setSelectedStudentId(child.student.id);
              router.push(`/parent/child/${child.student.id}`);
            }}
          />
        ))
      )}
    </Screen>
  );
}

export function ParentChildDetailScreen({ id }: { id: string }) {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['portal-parent'],
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token: accessToken }),
    enabled: !!accessToken,
  });
  const child = query.data?.children.find((item) => item.student.id === id);
  if (query.isLoading) return <LoadingView />;
  if (!child) return <ErrorView message="Child not found" />;
  return (
    <Screen>
      <Title>{child.student.fullName}</Title>
      <Subtitle>{titleCase(child.relationshipCode)}</Subtitle>
      <View className="flex-row flex-wrap gap-2">
        <StatCard label="Fees due" value={formatCurrency(child.fees?.outstanding)} accent={colors.coral} />
      </View>
      <PrimaryButton label="Attendance" onPress={() => router.push('/parent/attendance')} />
      <PrimaryButton label="Assessments" onPress={() => router.push('/parent/assessments')} color={colors.teal} />
      <PrimaryButton label="Timetable" onPress={() => router.push('/parent/timetable')} color={colors.orange} />
    </Screen>
  );
}

export function MoreMenu({
  items,
}: {
  items: Array<{ label: string; href: string }>;
}) {
  return (
    <Screen>
      <Title>More</Title>
      {items.map((item) => (
        <ListRow key={item.href} title={item.label} onPress={() => router.push(item.href as never)} />
      ))}
    </Screen>
  );
}
