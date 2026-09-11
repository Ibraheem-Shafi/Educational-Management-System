'use client';

import type { AccessCatalogResponse, AccessModuleFlagDto } from '@eims/types';
import { cn } from '@/lib/utils';

function flagMap(flags: AccessModuleFlagDto[]): Map<string, AccessModuleFlagDto> {
  return new Map(flags.map((flag) => [flag.moduleId, flag]));
}

export function AccessMatrix({
  catalog,
  flags,
  overrides,
  disabled = false,
  onChange,
}: {
  catalog: AccessCatalogResponse;
  flags: AccessModuleFlagDto[];
  overrides?: AccessModuleFlagDto[];
  disabled?: boolean;
  onChange?: (next: AccessModuleFlagDto[]) => void;
}) {
  const current = flagMap(flags);
  const overrideMap = overrides ? flagMap(overrides) : null;

  function setFlag(moduleId: string, patch: Partial<AccessModuleFlagDto>) {
    if (!onChange || disabled) return;
    const next = catalog.groups.flatMap((group) =>
      group.modules.map((module) => {
        const existing = current.get(module.id) ?? { moduleId: module.id, view: false, edit: false };
        if (module.id !== moduleId) return existing;
        const merged = { ...existing, ...patch };
        if (merged.edit) merged.view = true;
        if (!merged.view) merged.edit = false;
        if (module.viewOnly) merged.edit = false;
        return merged;
      }),
    );
    onChange(next);
  }

  return (
    <div className="overflow-x-auto rounded-[12px] border border-[var(--stroke-soft-200,#E2E4E9)]">
      <table className="w-full min-w-[420px] border-separate border-spacing-0">
        <thead>
          <tr className="bg-[var(--palette-teal-soft)]">
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
              Module
            </th>
            <th className="w-24 px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
              View
            </th>
            <th className="w-24 px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
              Edit
            </th>
          </tr>
        </thead>
        <tbody>
          {catalog.groups.map((group) => (
            <GroupRows
              key={group.id}
              group={group}
              current={current}
              overrideMap={overrideMap}
              disabled={disabled}
              onToggle={setFlag}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  group,
  current,
  overrideMap,
  disabled,
  onToggle,
}: {
  group: AccessCatalogResponse['groups'][number];
  current: Map<string, AccessModuleFlagDto>;
  overrideMap: Map<string, AccessModuleFlagDto> | null;
  disabled: boolean;
  onToggle: (moduleId: string, patch: Partial<AccessModuleFlagDto>) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={3}
          className="bg-[var(--neutral-50,#F7F8FA)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-sub-500)]"
        >
          {group.label}
        </td>
      </tr>
      {group.modules.map((module) => {
        const flag = current.get(module.id) ?? { moduleId: module.id, view: false, edit: false };
        const override = overrideMap?.get(module.id);
        return (
          <tr key={module.id} className="border-t border-[var(--stroke-soft-200,#E2E4E9)]">
            <td className="px-4 py-2.5 text-sm text-[var(--text-main-900)]">{module.label}</td>
            <td className="px-4 py-2.5 text-center">
              <MatrixCheckbox
                checked={flag.view}
                disabled={disabled}
                differed={Boolean(override?.view)}
                label={`View ${module.label}`}
                onChange={(checked) => onToggle(module.id, { view: checked })}
              />
            </td>
            <td className="px-4 py-2.5 text-center">
              {module.viewOnly ? (
                <span className="text-xs text-[var(--text-sub-500)]">—</span>
              ) : (
                <MatrixCheckbox
                  checked={flag.edit}
                  disabled={disabled}
                  differed={Boolean(override?.edit)}
                  label={`Edit ${module.label}`}
                  onChange={(checked) => onToggle(module.id, { edit: checked })}
                />
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function MatrixCheckbox({
  checked,
  disabled,
  differed,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  differed: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center justify-center">
      <input
        type="checkbox"
        className={cn(
          'h-4 w-4 rounded border-[var(--stroke-soft-200,#E2E4E9)]',
          differed && 'ring-2 ring-[var(--institution-primary)] ring-offset-1',
        )}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
