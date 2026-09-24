import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import RouteError from '@/app/error';
import GlobalError from '@/app/global-error';

const scope = {
  setLevel: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
};

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn((cb: (s: typeof scope) => unknown) => cb(scope)),
  captureException: vi.fn(() => 'evt-123'),
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings',
  useRouter: () => ({ refresh }),
}));

vi.mock('@/app/globals.css', () => ({}));

function makeError() {
  return Object.assign(new Error('boom'), { digest: 'abc123' });
}

describe('RouteError (app/error.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a friendly fallback instead of a blank page', async () => {
    render(<RouteError error={makeError()} reset={vi.fn()} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(await screen.findByText(/evt-123/)).toBeInTheDocument();
  });

  it('reports the error to Sentry with route context', () => {
    const error = makeError();
    render(<RouteError error={error} reset={vi.fn()} />);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(scope.setTag).toHaveBeenCalledWith('error_boundary', 'route');
    expect(scope.setTag).toHaveBeenCalledWith('route', '/app/settings');
    expect(scope.setTag).toHaveBeenCalledWith('digest', 'abc123');
    expect(scope.setContext).toHaveBeenCalledWith(
      'error_boundary',
      expect.objectContaining({ route: '/app/settings', digest: 'abc123' }),
    );
  });

  it('retries in place by refreshing server data and resetting the boundary', () => {
    const reset = vi.fn();
    render(<RouteError error={makeError()} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(refresh).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();
  });
});

describe('GlobalError (app/global-error.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the fallback and reports as a fatal global error', () => {
    const error = makeError();
    const reset = vi.fn();
    // global-error renders its own <html>/<body>, which React warns about
    // when mounted inside the test container; that warning is expected here.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<GlobalError error={error} reset={reset} />);
    consoleError.mockRestore();

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(scope.setLevel).toHaveBeenCalledWith('fatal');
    expect(scope.setTag).toHaveBeenCalledWith('error_boundary', 'global');

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalled();
  });
});
