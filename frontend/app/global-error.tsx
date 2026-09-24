'use client';

import { useEffect, useState } from 'react';
import { ErrorFallback } from '@/components/ErrorFallback';
import { reportBoundaryError } from '@/lib/reportError';
import './globals.css';

// Last-resort boundary for errors thrown by the root layout itself (e.g. a
// provider). It replaces the root layout, so it has to render <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [eventId, setEventId] = useState<string>();

  useEffect(() => {
    setEventId(reportBoundaryError(error, 'global'));
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorFallback onRetry={reset} onReload={() => window.location.reload()} eventId={eventId} />
      </body>
    </html>
  );
}
