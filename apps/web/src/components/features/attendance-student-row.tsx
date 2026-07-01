'use client';

import { memo, useCallback } from 'react';
import { ListRow } from '@/components/layout/list-row';
import { filterSelectClass } from '@/components/layout/filter-bar';

interface LookupStatus {
  id: string;
  label: string;
}

interface AttendanceStudentRowProps {
  studentId: string;
  fullName: string;
  value: string;
  statuses: LookupStatus[];
  onChange: (studentId: string, statusId: string) => void;
}

export const AttendanceStudentRow = memo(function AttendanceStudentRow({
  studentId,
  fullName,
  value,
  statuses,
  onChange,
}: AttendanceStudentRowProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onChange(studentId, e.target.value),
    [onChange, studentId],
  );

  return (
    <ListRow
      actions={
        <select className={filterSelectClass} value={value} onChange={handleChange}>
          <option value="">—</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      }
    >
      <p className="font-medium">{fullName}</p>
    </ListRow>
  );
});
