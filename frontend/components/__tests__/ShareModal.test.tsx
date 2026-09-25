import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { forwardRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareModal } from '@/components/ShareModal';
import { notify } from '@/lib/notify';

vi.mock('@/lib/notify', () => ({
  notify: { error: vi.fn(), success: vi.fn() },
}));

const { toBlobMock } = vi.hoisted(() => ({ toBlobMock: vi.fn() }));

vi.mock('qrcode.react', () => {
  const MockQRCodeCanvas = forwardRef<HTMLCanvasElement>((_props, ref) => (
    <canvas
      ref={(el) => {
        if (el) (el as unknown as { toBlob: typeof toBlobMock }).toBlob = toBlobMock;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      data-testid="qr-canvas"
    />
  ));
  MockQRCodeCanvas.displayName = 'MockQRCodeCanvas';

  return {
    QRCodeCanvas: MockQRCodeCanvas,
    QRCodeSVG: ({ id, value }: { id: string; value: string }) => (
      <svg id={id} data-testid="qr-svg" data-value={value} />
    ),
  };
});

describe('ShareModal', () => {
  const creator = {
    username: 'alice',
    displayName: 'Alice Wonderland',
  };
  const onClose = vi.fn();
  const onOpenShareCard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with both Link and QR code options visible by default', () => {
    render(<ShareModal creator={creator} onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Share Profile')).toBeInTheDocument();
    expect(screen.getByTestId('share-link-section')).toBeInTheDocument();
    expect(screen.getByTestId('share-qr-section')).toBeInTheDocument();

    // Reused QrCodeCard content is present
    expect(screen.getByTestId('qr-svg')).toBeInTheDocument();
  });

  it('allows user to choose between Copy Link, QR Code, and Both views', () => {
    render(<ShareModal creator={creator} onClose={onClose} />);

    // Switch to Copy Link only
    const linkTab = screen.getByRole('tab', { name: /copy link/i });
    fireEvent.click(linkTab);

    expect(screen.getByTestId('share-link-section')).toBeInTheDocument();
    expect(screen.queryByTestId('share-qr-section')).not.toBeInTheDocument();

    // Switch to QR Code only
    const qrTab = screen.getByRole('tab', { name: /qr code/i });
    fireEvent.click(qrTab);

    expect(screen.queryByTestId('share-link-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('share-qr-section')).toBeInTheDocument();

    // Switch back to Both
    const bothTab = screen.getByRole('tab', { name: /both/i });
    fireEvent.click(bothTab);

    expect(screen.getByTestId('share-link-section')).toBeInTheDocument();
    expect(screen.getByTestId('share-qr-section')).toBeInTheDocument();
  });

  it('copies the profile link to clipboard and notifies success', async () => {
    render(<ShareModal creator={creator} onClose={onClose} />);

    const copyBtn = screen.getByRole('button', { name: /copy profile link/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(/\/alice$/)
      );
      expect(notify.success).toHaveBeenCalledWith('Profile link copied to clipboard');
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('handles clipboard failure gracefully', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Permission denied'));

    render(<ShareModal creator={creator} onClose={onClose} />);

    const copyBtn = screen.getByRole('button', { name: /copy profile link/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith('Could not copy link', expect.any(Error));
    });
  });

  it('triggers navigator.share when available and "Share via device" is clicked', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: mockShare });

    render(<ShareModal creator={creator} onClose={onClose} />);

    const shareBtn = screen.getByRole('button', { name: /share via device/i });
    fireEvent.click(shareBtn);

    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Alice Wonderland',
        text: 'Support Alice Wonderland on SupportMe',
        url: expect.stringMatching(/\/alice$/),
      })
    );
  });

  it('falls back to copy link when navigator.share is unavailable', async () => {
    // Delete navigator.share to simulate desktop or unsupported browser
    // @ts-expect-error test override
    delete navigator.share;

    render(<ShareModal creator={creator} onClose={onClose} />);

    const shareBtn = screen.getByRole('button', { name: /share via device/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringMatching(/\/alice$/)
      );
      expect(notify.success).toHaveBeenCalledWith('Profile link copied to clipboard');
    });
  });

  it('closes on Close button click and Escape key press', () => {
    const { unmount } = render(<ShareModal creator={creator} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();

    // Test Escape key
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();
  });

  it('triggers onOpenShareCard when social graphic card button is clicked', () => {
    render(
      <ShareModal
        creator={creator}
        onClose={onClose}
        onOpenShareCard={onOpenShareCard}
      />
    );

    const socialCardBtn = screen.getByRole('button', { name: /social graphic card/i });
    fireEvent.click(socialCardBtn);

    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenShareCard).toHaveBeenCalledOnce();
  });
});
