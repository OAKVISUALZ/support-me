import * as Sentry from '@sentry/nextjs';

export type ErrorBoundaryName = 'route' | 'global';

// Reports an error caught by one of the app's error boundaries to Sentry,
// tagged with the boundary and the route the user was on so issues can be
// grouped/filtered by page. The Error object carries the stack trace; the
// digest links client reports to the server-side error for the same render.
export function reportBoundaryError(
  error: Error & { digest?: string },
  boundary: ErrorBoundaryName,
  pathname?: string | null,
) {
  const route =
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
  const search = typeof window !== 'undefined' ? window.location.search : undefined;

  return Sentry.withScope((scope) => {
    scope.setLevel(boundary === 'global' ? 'fatal' : 'error');
    scope.setTag('error_boundary', boundary);
    if (route) scope.setTag('route', route);
    if (error.digest) scope.setTag('digest', error.digest);
    scope.setContext('error_boundary', {
      boundary,
      route,
      search: search || undefined,
      digest: error.digest,
    });
    return Sentry.captureException(error);
  });
}
