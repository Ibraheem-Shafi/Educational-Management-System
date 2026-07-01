import type { Prisma } from '@prisma/client';
import { gradeFromPct, hashSeed, pct } from '../utils';

export function buildAssessmentRecords(
  assessmentDemoKey: string,
  assessmentId: string,
  students: Array<{ id: string; demoKey: string }>,
  subjectIds: string[],
  marksPerSubject: number,
  createdById: string | null,
): Prisma.AssessmentRecordCreateManyInput[] {
  const records: Prisma.AssessmentRecordCreateManyInput[] = [];

  students.forEach((student, idx) => {
    subjectIds.forEach((subjectId, subIdx) => {
      const seed = hashSeed(assessmentDemoKey, student.demoKey, String(subIdx));
      const base = 0.55 + (seed % 40) / 100;
      const obtained = Math.min(marksPerSubject, Math.round(marksPerSubject * base));
      const percentage = pct(obtained, marksPerSubject);

      records.push({
        assessmentId,
        studentId: student.id,
        subjectId,
        obtainedMarks: obtained,
        percentage,
        grade: gradeFromPct(percentage),
        rank: idx + 1,
        remarks: percentage < 60 ? 'Needs improvement — recommend extra session' : null,
        createdById,
      });
    });
  });

  return records;
}
