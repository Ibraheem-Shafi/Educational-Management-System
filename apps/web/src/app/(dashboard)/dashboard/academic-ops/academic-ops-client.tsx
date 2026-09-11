'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getSingleBranchId } from '@eims/shared';
import {
  academicActionKinds,
  academicActionStatuses,
  createAcademicActionSchema,
  createClassroomObservationSchema,
  createDisciplineIncidentSchema,
  createLessonPlanSchema,
  createSchoolEventSchema,
  createStaffTrainingSchema,
  createSyllabusUnitSchema,
  lessonPlanStatuses,
  PERMISSIONS,
  schoolEventKinds,
  syllabusUnitStatuses,
  updateAcademicActionSchema,
  updateClassroomObservationSchema,
  updateDisciplineIncidentSchema,
  updateLessonPlanSchema,
  updateSchoolEventSchema,
  updateStaffTrainingSchema,
  updateSyllabusUnitSchema,
} from '@eims/shared';
import { PageHeader } from '@/components/layout/page-header';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { Tabs } from '@/components/ui/tabs';
import { OpsRecordsPanel } from '@/components/features/ops/ops-records-panel';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';

const TABS = [
  { id: 'syllabus', label: 'Syllabus' },
  { id: 'lessons', label: 'Lesson plans' },
  { id: 'observations', label: 'Observations' },
  { id: 'events', label: 'School life' },
  { id: 'discipline', label: 'Discipline' },
  { id: 'actions', label: 'Academic actions' },
  { id: 'training', label: 'Training' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const enumOptions = (values?: readonly string[]) =>
  (values ?? []).map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export default function AcademicOpsPage() {
  const [tab, setTab] = useState<TabId>('syllabus');
  const { effectiveScope, canSelect, isLocked, singleBranchId } = useEffectiveBranchScope();
  const branchId = singleBranchId ?? getSingleBranchId(effectiveScope);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={BookOpen}
        title="Academic operations"
        description="Syllabus coverage, lesson plans, observations, school events, discipline, and action plans"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[...TABS]}
          value={tab}
          onValueChange={(id) => setTab(id as TabId)}
          aria-label="Academic operations sections"
          accent="green"
        />
        {(canSelect || isLocked) && <PageBranchScopeControl />}
      </div>

      {!branchId ? (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch to manage academic operations records.
        </p>
      ) : tab === 'syllabus' ? (
        <OpsRecordsPanel
          title="Syllabus units"
          path="/academic-ops/syllabus-units"
          queryKeyPrefix="academic-syllabus"
          branchId={branchId}
          managePermission={PERMISSIONS.ACADEMIC_MANAGE}
          createSchema={createSyllabusUnitSchema}
          updateSchema={updateSyllabusUnitSchema}
          createLabel="Add unit"
          columns={[
            { key: 'title', header: 'Unit' },
            { key: 'subject', header: 'Subject', nested: 'subject.name' },
            { key: 'batch', header: 'Batch', nested: 'batch.name' },
            { key: 'coveragePercent', header: 'Coverage %' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'subjectId', label: 'Subject', type: 'subject', required: true },
            { name: 'batchId', label: 'Batch', type: 'batch' },
            { name: 'plannedTopics', label: 'Planned topics', type: 'number', required: true },
            { name: 'completedTopics', label: 'Completed topics', type: 'number' },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: enumOptions(syllabusUnitStatuses),
            },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : tab === 'lessons' ? (
        <OpsRecordsPanel
          title="Lesson plans"
          path="/academic-ops/lesson-plans"
          queryKeyPrefix="academic-lessons"
          branchId={branchId}
          managePermission={PERMISSIONS.ACADEMIC_MANAGE}
          createSchema={createLessonPlanSchema}
          updateSchema={updateLessonPlanSchema}
          createLabel="Add lesson plan"
          columns={[
            { key: 'date', header: 'Date' },
            { key: 'title', header: 'Title' },
            { key: 'teacher', header: 'Teacher', nested: 'teacher.fullName' },
            { key: 'subject', header: 'Subject', nested: 'subject.name' },
            { key: 'batch', header: 'Batch', nested: 'batch.name' },
            { key: 'status', header: 'Status', badge: true },
          ]}
          fields={[
            { name: 'date', label: 'Date', type: 'date', required: true },
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'teacherId', label: 'Teacher', type: 'user', required: true },
            { name: 'subjectId', label: 'Subject', type: 'subject', required: true },
            { name: 'batchId', label: 'Batch', type: 'batch', required: true },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: enumOptions(lessonPlanStatuses),
            },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : tab === 'observations' ? (
        <OpsRecordsPanel
          title="Classroom observations"
          path="/academic-ops/observations"
          queryKeyPrefix="academic-observations"
          branchId={branchId}
          managePermission={PERMISSIONS.ACADEMIC_MANAGE}
          createSchema={createClassroomObservationSchema}
          updateSchema={updateClassroomObservationSchema}
          createLabel="Add observation"
          columns={[
            { key: 'observedAt', header: 'Date' },
            { key: 'teacher', header: 'Teacher', nested: 'teacher.fullName' },
            { key: 'observer', header: 'Observer', nested: 'observer.fullName' },
            { key: 'score', header: 'Score' },
            { key: 'summary', header: 'Summary' },
          ]}
          fields={[
            { name: 'observedAt', label: 'Date', type: 'date', required: true },
            { name: 'teacherId', label: 'Teacher', type: 'user', required: true },
            { name: 'observerId', label: 'Observer', type: 'user' },
            { name: 'score', label: 'Score', type: 'number' },
            { name: 'summary', label: 'Summary', type: 'textarea', required: true },
          ]}
        />
      ) : tab === 'events' ? (
        <OpsRecordsPanel
          title="Co-curricular and PTM"
          path="/academic-ops/events"
          queryKeyPrefix="academic-events"
          branchId={branchId}
          managePermission={PERMISSIONS.ACADEMIC_MANAGE}
          createSchema={createSchoolEventSchema}
          updateSchema={updateSchoolEventSchema}
          createLabel="Add event"
          columns={[
            { key: 'eventDate', header: 'Date' },
            { key: 'kind', header: 'Kind', badge: true },
            { key: 'title', header: 'Title' },
            { key: 'attendeeCount', header: 'Attendees' },
          ]}
          fields={[
            {
              name: 'kind',
              label: 'Kind',
              type: 'select',
              required: true,
              options: enumOptions(schoolEventKinds),
            },
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'eventDate', label: 'Date', type: 'date', required: true },
            { name: 'attendeeCount', label: 'Attendees', type: 'number' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : tab === 'discipline' ? (
        <OpsRecordsPanel
          title="Discipline incidents"
          path="/academic-ops/discipline"
          queryKeyPrefix="academic-discipline"
          branchId={branchId}
          managePermission={PERMISSIONS.ACADEMIC_MANAGE}
          createSchema={createDisciplineIncidentSchema}
          updateSchema={updateDisciplineIncidentSchema}
          createLabel="Add incident"
          columns={[
            { key: 'incidentDate', header: 'Date' },
            { key: 'student', header: 'Student', nested: 'student.fullName' },
            { key: 'type', header: 'Type' },
            { key: 'action', header: 'Action' },
          ]}
          fields={[
            { name: 'incidentDate', label: 'Date', type: 'date', required: true },
            { name: 'studentId', label: 'Student', type: 'student', required: true },
            { name: 'type', label: 'Type', type: 'text', required: true },
            { name: 'action', label: 'Action', type: 'text', required: true },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : tab === 'actions' ? (
        <OpsRecordsPanel
          title="Improvement plans and challenges"
          path="/academic-ops/actions"
          queryKeyPrefix="academic-actions"
          branchId={branchId}
          managePermission={PERMISSIONS.ACADEMIC_MANAGE}
          createSchema={createAcademicActionSchema}
          updateSchema={updateAcademicActionSchema}
          createLabel="Add action"
          columns={[
            { key: 'title', header: 'Title' },
            { key: 'kind', header: 'Kind', badge: true },
            { key: 'status', header: 'Status', badge: true },
            { key: 'owner', header: 'Owner', nested: 'owner.fullName' },
            { key: 'dueDate', header: 'Due' },
          ]}
          fields={[
            {
              name: 'kind',
              label: 'Kind',
              type: 'select',
              required: true,
              options: enumOptions(academicActionKinds),
            },
            { name: 'title', label: 'Title', type: 'text', required: true },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: enumOptions(academicActionStatuses),
            },
            { name: 'ownerUserId', label: 'Owner', type: 'user' },
            { name: 'dueDate', label: 'Due date', type: 'date' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      ) : (
        <OpsRecordsPanel
          title="Teacher training and PD"
          path="/academic-ops/trainings"
          queryKeyPrefix="academic-trainings"
          branchId={branchId}
          managePermission={PERMISSIONS.ACADEMIC_MANAGE}
          createSchema={createStaffTrainingSchema}
          updateSchema={updateStaffTrainingSchema}
          createLabel="Add training"
          columns={[
            { key: 'trainedAt', header: 'Date' },
            { key: 'user', header: 'Staff', nested: 'user.fullName' },
            { key: 'title', header: 'Title' },
            { key: 'hours', header: 'Hours' },
          ]}
          fields={[
            { name: 'userId', label: 'Staff member', type: 'user', required: true },
            { name: 'title', label: 'Title', type: 'text', required: true },
            { name: 'trainedAt', label: 'Date', type: 'date', required: true },
            { name: 'hours', label: 'Hours', type: 'number', required: true },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      )}
    </div>
  );
}
