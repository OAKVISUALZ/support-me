import { toast, type ExternalToast } from 'sonner';

// Errors stay up longer than the 5s default so there's time to read (or have
// a screen reader announce) what went wrong before it auto-dismisses.
const ERROR_DURATION = 8000;

export function errorMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || undefined;
  if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return undefined;
}

// Thin wrapper over sonner so every user action reports its outcome the same
// way: a short title plus an optional description.
export const notify = {
  success(title: string, options?: ExternalToast) {
    return toast.success(title, options);
  },
  info(title: string, options?: ExternalToast) {
    return toast.info(title, options);
  },
  warning(title: string, options?: ExternalToast) {
    return toast.warning(title, { duration: ERROR_DURATION, ...options });
  },
  // `cause` may be an Error, a message string, or anything thrown — its
  // message becomes the description.
  error(title: string, cause?: unknown, options?: ExternalToast) {
    return toast.error(title, {
      description: errorMessage(cause),
      duration: ERROR_DURATION,
      ...options,
    });
  },
};
