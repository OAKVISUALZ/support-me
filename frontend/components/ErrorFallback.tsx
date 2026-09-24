'use client';

import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';

interface ErrorFallbackProps {
  onRetry: () => void;
  onReload: () => void;
  eventId?: string;
}

// Friendly "something went wrong" screen shared by app/error.tsx and
// app/global-error.tsx. Both recovery actions keep the user on the current
// URL, so they don't lose their place in the app.
export function ErrorFallback({ onRetry, onReload, eventId }: ErrorFallbackProps) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div role="alert" className="card-brutal p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <div className="card-brutal bg-brand-yellow w-16 h-16 flex items-center justify-center">
            <HugeiconsIcon icon={AlertCircleIcon} size={32} strokeWidth={2} className="text-ink" />
          </div>
        </div>
        <h1 className="text-2xl font-extrabold text-ink mb-2">Something went wrong</h1>
        <p className="text-muted mb-6 font-medium">
          An unexpected error occurred on this page. Try again, or reload to start fresh. We&apos;ve
          been notified.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={onRetry} className="btn-brutal btn-brutal-primary whitespace-nowrap">
            Try Again
          </button>
          <button type="button" onClick={onReload} className="btn-brutal btn-brutal-white whitespace-nowrap">
            Reload Page
          </button>
          <Link href="/" className="btn-brutal btn-brutal-white whitespace-nowrap">
            Go Home
          </Link>
        </div>
        {eventId && (
          <p className="mt-6 text-xs text-muted font-mono">Error reference: {eventId}</p>
        )}
      </div>
    </main>
  );
}
