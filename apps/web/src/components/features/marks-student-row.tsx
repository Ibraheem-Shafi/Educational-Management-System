'use client';

import { memo, useCallback } from 'react';
import { ListRow } from '@/components/layout/list-row';
import { Input } from '@/components/ui/input';

interface MarksStudentRowProps {
  studentId: string;
  fullName: string;
  marks: string;
  remarks: string;
  onMarksChange: (studentId: string, value: string) => void;
  onRemarksChange: (studentId: string, value: string) => void;
}

export const MarksStudentRow = memo(function MarksStudentRow({
  studentId,
  fullName,
  marks,
  remarks,
  onMarksChange,
  onRemarksChange,
}: MarksStudentRowProps) {
  const handleMarks = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onMarksChange(studentId, e.target.value),
    [onMarksChange, studentId],
  );
  const handleRemarks = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onRemarksChange(studentId, e.target.value),
    [onRemarksChange, studentId],
  );

  return (
    <ListRow
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            type="number"
            min={0}
            className="w-full sm:w-24"
            placeholder="0"
            value={marks}
            onChange={handleMarks}
          />
          <Input
            className="w-full sm:w-40"
            placeholder="Remarks"
            value={remarks}
            onChange={handleRemarks}
          />
        </div>
      }
    >
      <p className="font-medium">{fullName}</p>
    </ListRow>
  );
});
