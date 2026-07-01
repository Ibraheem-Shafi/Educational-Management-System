'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Portal unavailable</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || 'Something went wrong loading the portal.'}
      </p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
