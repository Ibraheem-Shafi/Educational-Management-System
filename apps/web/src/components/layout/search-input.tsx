'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_DEBOUNCE_MS = 300;

export function SearchInput({
  value,
  onValueChange,
  placeholder = 'Search by name, ID,',
  debounceMs = DEFAULT_DEBOUNCE_MS,
  trimValue = true,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  /** When false, keeps spaces in the input; callers can trim only for API/query use. */
  trimValue?: boolean;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = trimValue ? localValue.trim() : localValue;
      if (next !== value) onValueChangeRef.current(next);
    }, debounceMs);
    return () => window.clearTimeout(handle);
  }, [localValue, debounceMs, trimValue, value]);

  return (
    <div
      className={cn(
        'flex h-10 w-full max-w-[322px] items-center gap-1 rounded-[10px] border border-[var(--base-input,#E4E4E7)] bg-white px-3 py-2',
        'focus-within:border-[var(--palette-teal)] focus-within:ring-2 focus-within:ring-[var(--palette-teal)]/30 focus-within:ring-offset-1',
        className,
      )}
    >
      <Search
        className="h-3 w-3 shrink-0 text-[var(--palette-teal)]"
        strokeWidth={1.33}
        aria-hidden
      />
      <input
        type="search"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-sm font-normal leading-5 text-[var(--base-foreground,#18181B)]',
          'placeholder:text-[var(--base-muted-foreground,#71717A)]',
          'outline-none focus:outline-none',
          '[&::-webkit-search-cancel-button]:appearance-none',
        )}
        aria-label={placeholder}
      />
    </div>
  );
}
