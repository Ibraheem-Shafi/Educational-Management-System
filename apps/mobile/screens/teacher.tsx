import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
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
import { buildQuery } from '@/lib/config';
import { formatCurrency, formatDate, formatPercent, titleCase, todayIso } from '@/lib/format';
import { colors } from '@/lib/theme';
import type {
  LeaveRequestItem,
  LearningResourceItem,
  LookupStatus,
  PaginatedResponse,
  PortalDocumentItem,
  PortalNoticeItem,
  PortalTimetableResponse,
  TeacherBatch,
  TeacherHomeResponse,
  TeacherStudent,
} from '@/lib/types';
import { MoreMenu } from '@/screens/portal';

function statusTone(status?: string | null) {
  const value = (status ?? '').toLowerCase();
  if (value.includes('present') || value.includes('approved') || value.includes('published')) return 'green' as const;
  if (value.includes('absent') || value.includes('rejected')) return 'coral' as const;
  if (value.includes('late') || value.includes('pending') || value.includes('draft')) return 'yellow' as const;
  return 'navy' as const;
}

export function TeacherHomeScreen() {
  const { accessToken, user } = useAuth();
  const query = useQuery({
    queryKey: ['teacher-home'],
    queryFn: () => apiClient<TeacherHomeResponse>('/portal/teacher/home', { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) return <ErrorView message={query.error instanceof Error ? query.error.message : 'Failed'} />;
  const data = query.data!;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Hi, {user?.fullName?.split(' ')[0] ?? 'Teacher'}</Title>
      <Subtitle>Your classes today</Subtitle>
      <View className="mb-3 flex-row flex-wrap gap-2">
        <StatCard label="Students" value={data.stats.students} accent={colors.orange} />
        <StatCard label="Classes" value={data.stats.classes} accent={colors.teal} />
        <StatCard label="Present today" value={formatPercent(data.stats.todayAttendance.rate)} accent={colors.green} />
        <StatCard label="Unmarked" value={data.stats.todayAttendance.unmarked} accent={colors.coral} />
      </View>
      <PrimaryButton label="Mark attendance" onPress={() => router.push('/teacher/(tabs)/attendance')} />
      <PrimaryButton label="Enter marks" onPress={() => router.push('/teacher/assessments')} color={colors.teal} />
      {data.todaySlots.length ? (
        <Card>
          <Text className="mb-2 font-semibold text-navy">Today’s periods</Text>
          {data.todaySlots.map((slot) => (
            <Text key={slot.id} className="mb-1 text-sm text-ink">
              {slot.startTime}–{slot.endTime} · {slot.subjectName} · {slot.batchName}
            </Text>
          ))}
        </Card>
      ) : (
        <EmptyView message="No periods scheduled today." />
      )}
      {data.unmarkedBatches.map((batch) => (
        <ListRow
          key={batch.id}
          title={batch.name}
          subtitle={`${batch.marked}/${batch.total} marked`}
          onPress={() => router.push({ pathname: '/teacher/(tabs)/attendance', params: { batchId: batch.id } })}
        />
      ))}
    </Screen>
  );
}

export function TeacherAttendanceScreen() {
  const { accessToken } = useAuth();
  const params = useLocalSearchParams<{ batchId?: string | string[] }>();
  const paramBatchId = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId;
  const [date, setDate] = useState(todayIso());
  const [batchId, setBatchId] = useState<string | null>(paramBatchId ?? null);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (paramBatchId) setBatchId(paramBatchId);
  }, [paramBatchId]);
  const batches = useQuery({
    queryKey: ['teacher-batches'],
    queryFn: () => apiClient<{ data: TeacherBatch[] }>('/portal/teacher/batches', { token: accessToken }),
    enabled: !!accessToken,
  });
  const statuses = useQuery({
    queryKey: ['attendance-status'],
    queryFn: () => apiClient<{ statuses: LookupStatus[] }>('/settings/lookups/attendance_status', { token: accessToken }),
    enabled: !!accessToken,
  });
  const selected = batchId ?? batches.data?.data[0]?.id ?? null;
  const sheet = useQuery({
    queryKey: ['attendance-sheet', selected, date],
    queryFn: () =>
      apiClient<{
        batchId: string;
        branchId: string;
        students: Array<{
          studentId: string;
          fullName: string;
          attendance: { statusId: string } | null;
        }>;
      }>(`/attendance/sheet${buildQuery({ batchId: selected, date })}`, { token: accessToken }),
    enabled: !!accessToken && !!selected,
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const marks = statuses.data?.statuses ?? [];
  const save = useMutation({
    mutationFn: async () => {
      if (!selected || !sheet.data) throw new Error('Select a class');
      const fallback = marks.find((item) => item.code === 'present')?.id;
      const records = sheet.data.students.map((student) => ({
        studentId: student.studentId,
        statusId: draft[student.studentId] ?? student.attendance?.statusId ?? fallback,
      })).filter((row) => row.statusId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return apiClient('/attendance/bulk', {
        method: 'POST',
        token: accessToken,
        body: { date, batchId: selected, branchId: sheet.data.branchId, records },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attendance-sheet'] });
      void queryClient.invalidateQueries({ queryKey: ['teacher-home'] });
    },
  });
  if (batches.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void sheet.refetch()} refreshing={sheet.isFetching}>
      <Title>Mark attendance</Title>
      <Field label="Date" value={date} onChangeText={setDate} />
      <ScrollChips
        items={(batches.data?.data ?? []).map((batch) => ({ id: batch.id, label: batch.name }))}
        selectedId={selected}
        onSelect={setBatchId}
      />
      {(sheet.data?.students ?? []).map((student) => {
        const current = draft[student.studentId] ?? student.attendance?.statusId;
        return (
          <Card key={student.studentId}>
            <Text className="mb-2 font-semibold text-ink">{student.fullName}</Text>
            <View className="flex-row flex-wrap gap-2">
              {marks.map((status) => {
                const active = current === status.id;
                return (
                  <Pressable
                    key={status.id}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setDraft((prev) => ({ ...prev, [student.studentId]: status.id }));
                    }}
                    className="rounded-full px-3 py-2"
                    style={{ backgroundColor: active ? colors.navy : colors.canvas, borderWidth: 1, borderColor: active ? colors.navy : colors.line }}
                  >
                    <Text style={{ color: active ? colors.white : colors.ink, fontWeight: '600' }}>{status.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        );
      })}
      <PrimaryButton label={save.isPending ? 'Saving…' : 'Save attendance'} onPress={() => save.mutate()} disabled={save.isPending} />
      {save.error ? <Text className="mt-2 text-coral">{save.error instanceof Error ? save.error.message : 'Save failed'}</Text> : null}
      {save.isSuccess ? <Text className="mt-2 text-green">Attendance saved.</Text> : null}
    </Screen>
  );
}

function ScrollChips({
  items,
  selectedId,
  onSelect,
}: {
  items: Array<{ id: string; label: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View className="mb-3 flex-row flex-wrap gap-2">
      {items.map((item) => {
        const active = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            className="rounded-full px-3 py-2"
            style={{ backgroundColor: active ? colors.navy : colors.white, borderWidth: 1, borderColor: active ? colors.navy : colors.line }}
          >
            <Text style={{ color: active ? colors.white : colors.ink, fontWeight: '600' }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TeacherRosterScreen() {
  const { accessToken } = useAuth();
  const [batchId, setBatchId] = useState<string | undefined>();
  const batches = useQuery({
    queryKey: ['teacher-batches'],
    queryFn: () => apiClient<{ data: TeacherBatch[] }>('/portal/teacher/batches', { token: accessToken }),
    enabled: !!accessToken,
  });
  const query = useQuery({
    queryKey: ['teacher-students', batchId],
    queryFn: () =>
      apiClient<PaginatedResponse<TeacherStudent>>(
        `/portal/teacher/students${buildQuery({ batchId, limit: 50 })}`,
        { token: accessToken },
      ),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>My class</Title>
      <ScrollChips
        items={[{ id: '', label: 'All' }, ...(batches.data?.data ?? []).map((batch) => ({ id: batch.id, label: batch.name }))]}
        selectedId={batchId ?? ''}
        onSelect={(id) => setBatchId(id || undefined)}
      />
      {(query.data?.data ?? []).map((student) => (
        <ListRow
          key={student.id}
          title={student.fullName}
          subtitle={[student.batchName, student.rollNumber].filter(Boolean).join(' · ')}
          onPress={() => router.push(`/teacher/students/${student.id}`)}
        />
      ))}
    </Screen>
  );
}

export function TeacherStudentDetailScreen({ id }: { id: string }) {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['student', id],
    queryFn: () =>
      apiClient<{ id: string; fullName: string; rollNumber?: string; admissionNumber?: string; batch?: { name: string }; program?: { name: string } }>(
        `/students/${id}`,
        { token: accessToken },
      ),
    enabled: !!accessToken && !!id,
  });
  if (query.isLoading) return <LoadingView />;
  if (!query.data) return <ErrorView message="Student not found" />;
  return (
    <Screen>
      <Title>{query.data.fullName}</Title>
      <Card>
        <Text className="text-sm text-muted">Roll {query.data.rollNumber ?? '—'}</Text>
        <Text className="text-sm text-muted">{query.data.batch?.name ?? 'No class'}</Text>
        <Text className="text-sm text-muted">{query.data.program?.name ?? ''}</Text>
      </Card>
    </Screen>
  );
}

export function TeacherAssessmentsScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['assessments-staff'],
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; name: string; status: string; totalMarks: number; conductedAt: string | null; type?: { name: string } | null }>>(
        '/assessments?limit=30',
        { token: accessToken },
      ),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Assessments</Title>
      {(query.data?.data ?? []).map((item) => (
        <ListRow
          key={item.id}
          title={item.name}
          subtitle={[item.type?.name, item.status, item.conductedAt ? formatDate(item.conductedAt) : null].filter(Boolean).join(' · ')}
          onPress={() => router.push(`/teacher/assessments/${item.id}`)}
        />
      ))}
    </Screen>
  );
}

export function TeacherMarksScreen({ id }: { id: string }) {
  const { accessToken } = useAuth();
  const batches = useQuery({
    queryKey: ['teacher-batches'],
    queryFn: () => apiClient<{ data: TeacherBatch[] }>('/portal/teacher/batches', { token: accessToken }),
    enabled: !!accessToken,
  });
  const [batchId, setBatchId] = useState<string | null>(null);
  const selected = batchId ?? batches.data?.data[0]?.id ?? null;
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const sheet = useQuery({
    queryKey: ['marks-sheet', id, selected],
    queryFn: () =>
      apiClient<{
        assessment: { name: string; totalMarks: number; status: string };
        subjects: Array<{ id: string; name: string }>;
        students: Array<{
          studentId: string;
          fullName: string;
          marks: Array<{ subjectId: string; record: { obtainedMarks: number | null } | null }>;
        }>;
      }>(`/assessments/${id}/marks-sheet${buildQuery({ batchId: selected })}`, { token: accessToken }),
    enabled: !!accessToken && !!selected,
  });
  const activeSubject = subjectId ?? sheet.data?.subjects[0]?.id ?? null;
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async () => {
      if (!selected || !activeSubject || !sheet.data) throw new Error('Missing class or subject');
      const records = sheet.data.students
        .map((student) => {
          const existing = student.marks.find((mark) => mark.subjectId === activeSubject)?.record?.obtainedMarks;
          const value = draft[student.studentId] ?? (existing != null ? String(existing) : '');
          if (value === '') return null;
          return { studentId: student.studentId, subjectId: activeSubject, obtainedMarks: Number(value) };
        })
        .filter((row): row is { studentId: string; subjectId: string; obtainedMarks: number } => !!row);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return apiClient(`/assessments/${id}/marks/bulk`, {
        method: 'POST',
        token: accessToken,
        body: { batchId: selected, records },
      });
    },
  });
  const submit = useMutation({
    mutationFn: () => apiClient(`/assessments/${id}/submit-review`, { method: 'POST', token: accessToken, body: {} }),
  });
  if (batches.isLoading || sheet.isLoading) return <LoadingView />;
  return (
    <Screen>
      <Title>{sheet.data?.assessment.name ?? 'Marks'}</Title>
      <Subtitle>Total {sheet.data?.assessment.totalMarks ?? '—'}</Subtitle>
      <ScrollChips
        items={(batches.data?.data ?? []).map((batch) => ({ id: batch.id, label: batch.name }))}
        selectedId={selected}
        onSelect={setBatchId}
      />
      <ScrollChips
        items={(sheet.data?.subjects ?? []).map((subject) => ({ id: subject.id, label: subject.name }))}
        selectedId={activeSubject}
        onSelect={setSubjectId}
      />
      {(sheet.data?.students ?? []).map((student) => {
        const existing = student.marks.find((mark) => mark.subjectId === activeSubject)?.record?.obtainedMarks;
        return (
          <Card key={student.studentId}>
            <Text className="mb-2 font-semibold">{student.fullName}</Text>
            <TextInput
              keyboardType="numeric"
              value={draft[student.studentId] ?? (existing != null ? String(existing) : '')}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, [student.studentId]: value }))}
              className="h-12 rounded-xl border border-line px-3 text-base"
              placeholder="Marks"
            />
          </Card>
        );
      })}
      <PrimaryButton label={save.isPending ? 'Saving…' : 'Save marks'} onPress={() => save.mutate()} disabled={save.isPending} />
      <PrimaryButton label="Submit for review" onPress={() => submit.mutate()} color={colors.teal} />
      {save.error ? <Text className="text-coral">{save.error instanceof Error ? save.error.message : 'Failed'}</Text> : null}
    </Screen>
  );
}

export function TeacherTimetableScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['teacher-timetable'],
    queryFn: () => apiClient<PortalTimetableResponse>('/portal/teacher/timetable', { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>My timetable</Title>
      {(query.data?.slots ?? []).map((slot) => (
        <ListRow
          key={slot.id ?? `${slot.dayOfWeek}-${slot.startTime}`}
          title={slot.subjectName ?? 'Class'}
          subtitle={`${slot.dayName ?? ''} · ${slot.startTime}–${slot.endTime} · ${slot.batchName ?? ''}${slot.room ? ` · ${slot.room}` : ''}`}
        />
      ))}
    </Screen>
  );
}

export function TeacherNoticesScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['teacher-notices'],
    queryFn: () => apiClient<{ data: PortalNoticeItem[] }>('/portal/teacher/notices', { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Notices</Title>
      {(query.data?.data ?? []).map((notice) => (
        <ListRow
          key={notice.id}
          title={notice.title}
          subtitle={formatDate(notice.publishedAt)}
          onPress={() => router.push(`/teacher/notices/${notice.id}`)}
        />
      ))}
    </Screen>
  );
}

export function TeacherLeaveScreen() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const query = useQuery({
    queryKey: ['leave-mine'],
    queryFn: () => apiClient<PaginatedResponse<LeaveRequestItem>>('/leave-requests/mine', { token: accessToken }),
    enabled: !!accessToken,
  });
  const create = useMutation({
    mutationFn: async () => {
      const created = await apiClient<LeaveRequestItem>('/leave-requests', {
        method: 'POST',
        token: accessToken,
        body: { fromDate, toDate, reason },
      });
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!picked.canceled && picked.assets[0]) {
        const file = picked.assets[0];
        const upload = await apiClient<{ signedUrl: string; path: string }>(
          `/leave-requests/${created.id}/attachment/upload-url`,
          { method: 'POST', token: accessToken, body: { fileName: file.name } },
        );
        const blob = await fetch(file.uri).then((res) => res.blob());
        await fetch(upload.signedUrl, { method: 'PUT', body: blob });
        await apiClient(`/leave-requests/${created.id}/attachment`, {
          method: 'POST',
          token: accessToken,
          body: { fileName: file.name, storagePath: upload.path, mimeType: file.mimeType, sizeBytes: file.size },
        });
      }
      return created;
    },
    onSuccess: () => {
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['leave-mine'] });
    },
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>My leave</Title>
      <Card>
        <Field label="From" value={fromDate} onChangeText={setFromDate} />
        <Field label="To" value={toDate} onChangeText={setToDate} />
        <Field label="Reason" value={reason} onChangeText={setReason} multiline />
        <PrimaryButton label={create.isPending ? 'Submitting…' : 'Submit request'} onPress={() => create.mutate()} disabled={create.isPending} />
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

export function TeacherLearningScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['teacher-learning'],
    queryFn: () => apiClient<PaginatedResponse<LearningResourceItem>>('/learning?limit=30', { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Learning</Title>
      <PrimaryButton label="New homework / note" onPress={() => router.push('/teacher/resource-new')} />
      {(query.data?.data ?? []).map((item) => (
        <ListRow
          key={item.id}
          title={item.title}
          subtitle={[titleCase(item.type), item.batch?.name, item.isPublished ? 'Published' : 'Draft'].filter(Boolean).join(' · ')}
          onPress={() => router.push(`/teacher/resource/${item.id}`)}
        />
      ))}
    </Screen>
  );
}

export function TeacherLearningNewScreen() {
  const { accessToken, user } = useAuth();
  const batches = useQuery({
    queryKey: ['teacher-batches'],
    queryFn: () => apiClient<{ data: TeacherBatch[] }>('/portal/teacher/batches', { token: accessToken }),
    enabled: !!accessToken,
  });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'homework' | 'note'>('homework');
  const [batchId, setBatchId] = useState<string | null>(null);
  const selected = batchId ?? batches.data?.data[0]?.id ?? null;
  const selectedBatch = batches.data?.data.find((batch) => batch.id === selected);
  const create = useMutation({
    mutationFn: () =>
      apiClient('/learning', {
        method: 'POST',
        token: accessToken,
        body: {
          branchId: selectedBatch?.branchId ?? user?.branchId,
          type,
          title,
          body,
          batchId: selected,
          visibilityScope: 'batch',
          audience: 'all',
          isPublished: true,
        },
      }),
    onSuccess: () => router.back(),
  });
  return (
    <Screen>
      <Title>Publish learning</Title>
      <ScrollChips
        items={[{ id: 'homework', label: 'Homework' }, { id: 'note', label: 'Note' }]}
        selectedId={type}
        onSelect={(id) => setType(id as 'homework' | 'note')}
      />
      <ScrollChips
        items={(batches.data?.data ?? []).map((batch) => ({ id: batch.id, label: batch.name }))}
        selectedId={selected}
        onSelect={setBatchId}
      />
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Field label="Details" value={body} onChangeText={setBody} multiline />
      <PrimaryButton label={create.isPending ? 'Publishing…' : 'Publish'} onPress={() => create.mutate()} disabled={create.isPending || !title.trim()} />
      {create.error ? <Text className="text-coral">{create.error instanceof Error ? create.error.message : 'Failed'}</Text> : null}
    </Screen>
  );
}

export function TeacherLearningDetailScreen({ id }: { id: string }) {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['learning', id],
    queryFn: () => apiClient<LearningResourceItem>(`/learning/${id}`, { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  if (!query.data) return <ErrorView message="Not found" />;
  return (
    <Screen>
      <Title>{query.data.title}</Title>
      <Badge label={titleCase(query.data.type)} />
      {query.data.body ? <Text className="mt-4 text-[15px] leading-6">{query.data.body}</Text> : null}
    </Screen>
  );
}

export function TeacherDocumentsScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['staff-documents'],
    queryFn: () => apiClient<PaginatedResponse<PortalDocumentItem>>('/documents?limit=30', { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Documents</Title>
      {(query.data?.data ?? []).map((doc) => (
        <ListRow
          key={doc.id}
          title={doc.title}
          subtitle={[doc.student?.fullName, titleCase(doc.category), formatDate(doc.createdAt)].filter(Boolean).join(' · ')}
          onPress={async () => {
            const result = await apiClient<{ signedUrl: string }>(`/documents/${doc.id}/signed-url`, { token: accessToken });
            await WebBrowser.openBrowserAsync(result.signedUrl);
          }}
        />
      ))}
    </Screen>
  );
}

export function TeacherParentsScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['teacher-parents'],
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; fullName: string; phone: string | null; children: Array<{ fullName: string }> }>>(
        '/portal/teacher/parents?limit=50',
        { token: accessToken },
      ),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Parents</Title>
      {(query.data?.data ?? []).map((parent) => (
        <ListRow
          key={parent.id}
          title={parent.fullName}
          subtitle={parent.children.map((child) => child.fullName).join(', ')}
        />
      ))}
    </Screen>
  );
}

export function TeacherReportsScreen() {
  const { accessToken } = useAuth();
  const overview = useQuery({
    queryKey: ['reports-overview'],
    queryFn: () =>
      apiClient<{
        students: { total: number };
        attendanceMarkedToday: { count: number };
        parents: { total: number };
        fees: { pendingAmount: number; collectedLast30Days: number };
      }>('/reports/overview', { token: accessToken }),
    enabled: !!accessToken,
  });
  const cards = useQuery({
    queryKey: ['report-cards'],
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; student?: { fullName: string }; assessment?: { name: string }; percentage?: number }>>(
        '/report-cards?limit=20',
        { token: accessToken },
      ),
    enabled: !!accessToken,
  });
  if (overview.isLoading) return <LoadingView />;
  return (
    <Screen onRefresh={() => void overview.refetch()} refreshing={overview.isFetching}>
      <Title>Reports</Title>
      <View className="mb-3 flex-row flex-wrap gap-2">
        <StatCard label="Students" value={overview.data?.students.total ?? 0} accent={colors.orange} />
        <StatCard label="Marked today" value={overview.data?.attendanceMarkedToday.count ?? 0} accent={colors.teal} />
        <StatCard label="Pending fees" value={formatCurrency(overview.data?.fees.pendingAmount)} accent={colors.coral} />
      </View>
      <Text className="mb-2 font-semibold text-navy">Recent report cards</Text>
      {(cards.data?.data ?? []).map((row) => (
        <ListRow
          key={row.id}
          title={row.student?.fullName ?? 'Student'}
          subtitle={row.assessment?.name}
          right={<Text className="font-bold">{formatPercent(row.percentage ?? null)}</Text>}
        />
      ))}
    </Screen>
  );
}

export function TeacherAnalyticsScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () =>
      apiClient<{
        assessmentsLast30Days: { value: number };
        attendanceRateLast30Days: { value: number };
        averageAssessmentPercentage: { value: number | null };
        attendanceRecordsLast30Days: number;
      }>('/analytics/dashboard', { token: accessToken }),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  const data = query.data;
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>Analytics</Title>
      <View className="flex-row flex-wrap gap-2">
        <StatCard label="Assessments (30d)" value={data?.assessmentsLast30Days.value ?? 0} accent={colors.purple} />
        <StatCard label="Attendance rate" value={formatPercent(data?.attendanceRateLast30Days.value)} accent={colors.teal} />
        <StatCard label="Avg marks" value={formatPercent(data?.averageAssessmentPercentage.value)} accent={colors.orange} />
        <StatCard label="Records (30d)" value={data?.attendanceRecordsLast30Days ?? 0} accent={colors.green} />
      </View>
    </Screen>
  );
}

export function TeacherAiInsightsScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['ai-insights'],
    queryFn: () =>
      apiClient<PaginatedResponse<{ studentId: string; fullName: string; riskLevel: string; reasons: string[] }>>(
        '/ai-insights/at-risk?limit=20',
        { token: accessToken },
      ),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) {
    return (
      <Screen>
        <Title>AI Insights</Title>
        <EmptyView title="Coming soon" message="This preview matches the web AI Insights screen." />
      </Screen>
    );
  }
  return (
    <Screen onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <Title>AI Insights</Title>
      <Subtitle>At-risk students in your branch</Subtitle>
      {(query.data?.data ?? []).length === 0 ? (
        <EmptyView message="No at-risk students detected." />
      ) : (
        (query.data?.data ?? []).map((row) => (
          <ListRow
            key={row.studentId}
            title={row.fullName}
            subtitle={row.reasons.join(' · ')}
            right={<Badge label={row.riskLevel} tone={row.riskLevel === 'high' ? 'coral' : 'yellow'} />}
          />
        ))
      )}
    </Screen>
  );
}

export function TeacherAiAttendanceScreen() {
  const { accessToken } = useAuth();
  const query = useQuery({
    queryKey: ['ai-attendance'],
    queryFn: () =>
      apiClient<PaginatedResponse<{ id: string; status: string; createdAt: string; batch?: { name: string } }>>(
        '/ai-attendance/sessions?limit=20',
        { token: accessToken },
      ),
    enabled: !!accessToken,
  });
  if (query.isLoading) return <LoadingView />;
  if (query.error) {
    return (
      <Screen>
        <Title>AI Attendance</Title>
        <EmptyView title="Coming soon" message="Camera register scanning will use this screen when the web feature is enabled." />
      </Screen>
    );
  }
  return (
    <Screen>
      <Title>AI Attendance</Title>
      <Subtitle>Recent OCR sessions</Subtitle>
      {(query.data?.data ?? []).map((session) => (
        <ListRow key={session.id} title={session.batch?.name ?? 'Register scan'} subtitle={`${session.status} · ${formatDate(session.createdAt)}`} />
      ))}
    </Screen>
  );
}

export function TeacherMoreScreen() {
  return (
    <MoreMenu
      items={[
        { label: 'Assessments', href: '/teacher/assessments' },
        { label: 'Timetable', href: '/teacher/timetable' },
        { label: 'Notices', href: '/teacher/notices' },
        { label: 'Leave', href: '/teacher/leave' },
        { label: 'Parents', href: '/teacher/parents' },
        { label: 'Documents', href: '/teacher/documents' },
        { label: 'Reports', href: '/teacher/reports' },
        { label: 'Analytics', href: '/teacher/analytics' },
        { label: 'AI Insights', href: '/teacher/ai-insights' },
        { label: 'AI Attendance', href: '/teacher/ai-attendance' },
        { label: 'Profile', href: '/teacher/profile' },
      ]}
    />
  );
}
