import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WithdrawPage from '../page';
import { useAuth } from '@/context/AuthContext';
import { useNgnRate } from '@/lib/useNgnRate';
import { usePrices } from '@/lib/usePrices';
import { notify } from '@/lib/notify';

const { mockLoadAccount, mockNotifySuccess, mockNotifyError } = vi.hoisted(() => ({
  mockLoadAccount: vi.fn(),
  mockNotifySuccess: vi.fn(),
  mockNotifyError: vi.fn(),
}));

vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual<any>('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: class MockServer {
        loadAccount = mockLoadAccount;
      },
    },
  };
});

vi.mock('@/lib/notify', () => ({
  notify: {
    success: mockNotifySuccess,
    error: mockNotifyError,
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/useNgnRate', () => ({
  useNgnRate: vi.fn(),
}));

vi.mock('@/lib/usePrices', () => ({
  usePrices: vi.fn(),
}));

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/AppNav', () => ({
  AppNav: () => <nav data-testid="app-nav" />,
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseNgnRate = vi.mocked(useNgnRate);
const mockUsePrices = vi.mocked(usePrices);

describe('WithdrawPage - XLM and USDC Cash Out (#154)', () => {
  const MOCK_USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_USDC_ISSUER', MOCK_USDC_ISSUER);

    mockUseAuth.mockReturnValue({
      user: { id: 1, walletAddress: 'GUSER123' },
      token: 'mock-jwt',
      loading: false,
      loginWithWallet: vi.fn(),
      getTwitterRedirectUrl: vi.fn(),
      completeTwitterLogin: vi.fn(),
      requestMagicLink: vi.fn(),
      verifyMagicLink: vi.fn(),
      logout: vi.fn(),
    });

    mockUseNgnRate.mockReturnValue({
      rate: 1380,
      xlmRate: 165,
      source: 'coingecko',
      timestamp: Date.now(),
      loading: false,
      isStale: false,
      ageMinutes: 0,
    });

    (mockUsePrices as any).mockReturnValue({
      XLM: 0.12,
      USDC: 1.0,
    });

    mockLoadAccount.mockResolvedValue({
      balances: [
        { asset_type: 'native', balance: '500.0000000' },
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: MOCK_USDC_ISSUER, balance: '25.0000000' },
      ],
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/verify-account')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ accountName: 'Jane Doe' }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('defaults to XLM cash-out for a creator holding XLM, displaying balance and direct cash-out notice', async () => {
    render(<WithdrawPage />);

    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    expect(screen.getByText(/Direct XLM cash-out enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Your XLM will be converted directly to Naira/i)).toBeInTheDocument();
    expect(screen.getByText('Swap XLM to USDC')).toBeInTheDocument();

    const xlmRadio = screen.getByRole('radio', { name: /xlm/i });
    expect(xlmRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('allows switching between XLM and USDC cash-out', async () => {
    render(<WithdrawPage />);

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /xlm/i })).toBeInTheDocument();
    });

    const usdcRadio = screen.getByRole('radio', { name: /usdc/i });
    fireEvent.click(usdcRadio);

    expect(usdcRadio).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Direct USDC cash-out enabled/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount \(USDC\)/i)).toBeInTheDocument();
  });

  it('updates estimated Naira amount based on entered XLM amount and XLM rate', async () => {
    render(<WithdrawPage />);

    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    const amtInput = screen.getByLabelText(/Amount \(XLM\)/i);
    fireEvent.change(amtInput, { target: { value: '100' } });

    // 100 * 165 = 16,500
    await waitFor(() => {
      expect(screen.getByText(/₦16,500/)).toBeInTheDocument();
      expect(screen.getByText(/₦165\/XLM/)).toBeInTheDocument();
    });
  });

  it('supports Max button to fill full available balance for selected asset', async () => {
    render(<WithdrawPage />);

    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    const maxButton = screen.getByRole('button', { name: /Max \(500 XLM\)/i });
    fireEvent.click(maxButton);

    const amtInput = screen.getByLabelText(/Amount \(XLM\)/i) as HTMLInputElement;
    expect(amtInput.value).toBe('500');

    // 500 * 165 = 82,500
    expect(screen.getByText(/₦82,500/)).toBeInTheDocument();
  });

  it('validates insufficient balance and displays clear error', async () => {
    render(<WithdrawPage />);

    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    const amtInput = screen.getByLabelText(/Amount \(XLM\)/i);
    fireEvent.change(amtInput, { target: { value: '600' } });

    const submitBtn = screen.getByRole('button', { name: /Withdraw to bank/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Amount exceeds your available XLM balance.')).toBeInTheDocument();
    });
  });

  it('validates bank selection and 10-digit account number verification before submitting', async () => {
    vi.useFakeTimers();
    render(<WithdrawPage />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const amtInput = screen.getByLabelText(/Amount \(XLM\)/i);
    fireEvent.change(amtInput, { target: { value: '50' } });

    const bankSelect = screen.getByLabelText(/Bank/i);
    fireEvent.change(bankSelect, { target: { value: 'Access Bank' } });

    const acctInput = screen.getByLabelText(/Account number/i);
    fireEvent.change(acctInput, { target: { value: '0123456789' } });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/Account holder: Jane Doe/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Withdraw to bank/i });
    fireEvent.click(submitBtn);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.getByText('Withdrawal initiated')).toBeInTheDocument();
    expect(screen.getByText(/₦8,250 is on its way to your Access Bank account/i)).toBeInTheDocument();
    expect(screen.getByText(/50 XLM/i)).toBeInTheDocument();
  });

  it('opens in-app swap modal when clicking Swap XLM to USDC', async () => {
    render(<WithdrawPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Swap XLM to USDC' })).toBeInTheDocument();
    });

    const swapBtn = screen.getByRole('button', { name: 'Swap XLM to USDC' });
    fireEvent.click(swapBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Convert XLM → USDC' })).toBeInTheDocument();
    });
  });
});
