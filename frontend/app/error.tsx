'use client';

import { startTransition, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ErrorFallback } from '@/components/ErrorFallback';
import { reportBoundaryError } from '@/lib/reportError';

// Top-level route error boundary: catches render errors in any page below the
// root layout, so the nav/providers stay mounted and only the page is swapped
// for the fallback.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [eventId, setEventId] = useState<string>();

  useEffect(() => {
    setEventId(reportBoundaryError(error, 'route', pathname));
  }, [error, pathname]);

  // Re-fetch server components (in case the error came from the server) and
  // re-render the segment in place, without a full page load.
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <ErrorFallback onRetry={retry} onReload={() => window.location.reload()} eventId={eventId} />
  );
}
