'use client';

import { dataTableTdClass } from './data-table-styles';

export function DataTableSkeletonRows({
  columns,
  rows = 8,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className={dataTableTdClass}>
              <div className="h-4 animate-pulse rounded bg-[var(--palette-teal-soft)]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
