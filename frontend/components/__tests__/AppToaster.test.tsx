import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { toast } from 'sonner';
import { AppToaster } from '@/components/AppToaster';
import { notify, errorMessage } from '@/lib/notify';

describe('errorMessage', () => {
  it('extracts a message from errors, strings and error-like objects', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain text')).toBe('plain text');
    expect(errorMessage({ message: 'shaped like an error' })).toBe('shaped like an error');
    expect(errorMessage(undefined)).toBeUndefined();
    expect(errorMessage(42)).toBeUndefined();
  });
});

describe('AppToaster + notify', () => {
  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
  });

  it('announces toasts through a labelled live region', async () => {
    render(<AppToaster />);
    act(() => {
      notify.success('Settings saved.');
    });

    const region = await screen.findByRole('region', { name: /notifications/i });
    expect(region).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Settings saved.')).toBeInTheDocument());
    expect(screen.getByText('Settings saved.').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('shows the error message as the description and can be dismissed', async () => {
    render(<AppToaster />);
    act(() => {
      notify.error('Could not save settings', new Error('Network down'));
    });

    await waitFor(() => expect(screen.getByText('Could not save settings')).toBeInTheDocument());
    expect(screen.getByText('Network down')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    await waitFor(() =>
      expect(screen.queryByText('Could not save settings')).not.toBeInTheDocument(),
    );
  });
});
