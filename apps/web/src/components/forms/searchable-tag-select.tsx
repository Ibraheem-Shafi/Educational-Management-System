'use client';

import { useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TagSelectOption {
  id: string;
  label: string;
  hint?: string | null;
  disabled?: boolean;
  disabledReason?: string | null;
}

export function SearchableTagSelect({
  options,
  selectedIds,
  onChange,
  placeholder = 'Search and add',
  emptyText = 'No matches',
  disabled,
  selectAllLabel,
  onSelectAll,
}: {
  options: TagSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  selectAllLabel?: string;
  onSelectAll?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => {
    const byId = new Map(options.map((option) => [option.id, option]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((option): option is TagSelectOption => !!option);
  }, [options, selectedIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => {
      if (selectedSet.has(option.id)) return false;
      if (!needle) return true;
      return (
        option.label.toLowerCase().includes(needle) ||
        (option.hint ?? '').toLowerCase().includes(needle)
      );
    });
  }, [options, query, selectedSet]);

  function add(id: string) {
    const option = options.find((row) => row.id === id);
    if (!option || option.disabled || selectedSet.has(id)) return;
    onChange([...selectedIds, id]);
    setQuery('');
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(selectedIds.filter((value) => value !== id));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && query === '' && selectedIds.length > 0) {
      event.preventDefault();
      remove(selectedIds[selectedIds.length - 1]);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = matches.find((option) => !option.disabled);
      if (first) add(first.id);
    }
    if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      className={cn(
        'rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white',
        disabled && 'opacity-60',
      )}
    >
      <div
        className="flex min-h-10 flex-wrap items-center gap-1.5 px-2.5 py-1.5"
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selected.map((option) => (
          <span
            key={option.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--palette-teal)]/25 bg-[var(--palette-teal-soft,#E8F4F1)] px-2 py-0.5 text-xs font-medium text-[var(--palette-navy,#01366C)]"
          >
            <span className="truncate">{option.label}</span>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${option.label}`}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-white/80"
              onClick={(event) => {
                event.stopPropagation();
                remove(option.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex min-w-[8rem] flex-1 items-center gap-1">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--palette-teal)]" />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={query}
            placeholder={selected.length === 0 ? placeholder : 'Add more…'}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150);
            }}
            onKeyDown={handleKeyDown}
            className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-soft-400,#868C98)]"
          />
        </div>
      </div>

      {open && !disabled && (
        <div className="border-t border-[var(--stroke-soft-200,#E2E4E9)]">
          {onSelectAll && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-xs font-medium text-[var(--midnight-blue-950,#01366C)] hover:bg-[var(--palette-teal-soft)]/60"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelectAll();
                setQuery('');
              }}
            >
              {selectAllLabel ?? 'Select all'}
            </button>
          )}
          <ul className="max-h-52 overflow-y-auto py-1" role="listbox">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[var(--text-sub-500)]">{emptyText}</li>
            ) : (
              matches.slice(0, 80).map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    disabled={option.disabled}
                    className={cn(
                      'flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-[var(--palette-teal-soft)]/70',
                      option.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add(option.id)}
                  >
                    <span className="text-[var(--text-main-900)]">{option.label}</span>
                    {(option.hint || option.disabledReason) && (
                      <span className="text-xs text-[var(--text-sub-500)]">
                        {option.disabled ? option.disabledReason ?? option.hint : option.hint}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
