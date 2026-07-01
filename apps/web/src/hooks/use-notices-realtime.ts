import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export const NOTICES_QUERY_KEYS = ['notices', 'portal-parent', 'portal-student'] as const;

export function useNoticesRealtime(
  queryKeys: readonly string[] = NOTICES_QUERY_KEYS,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel('notices-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Notice' },
        () => {
          for (const key of queryKeys) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, queryKeys]);
}
