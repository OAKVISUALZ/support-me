'use client';

import { useState, useEffect } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppNav } from '@/components/AppNav';
import { Skeleton } from '@/components/Skeleton';
import { notify } from '@/lib/notify';
import { useNgnRate } from '@/lib/useNgnRate';
import { usePrices } from '@/lib/usePrices';
import ConvertXlmToUsdcModal from '@/components/ConvertXlmToUsdcModal';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

const NIGERIAN_BANKS = [
  'Access Bank', 'GTBank', 'Kuda', 'Opay', 'UBA', 'Zenith Bank',
  'First Bank', 'Stanbic IBTC', 'Wema Bank',
];

type Stage = 'form' | 'processing' | 'done';
export type WithdrawAsset = 'XLM' | 'USDC';

export default function WithdrawPage() {
  const { user } = useAuth();
  const walletAddress = user?.walletAddress || '';
  const ngnRate = useNgnRate();
  const prices = usePrices() as Record<string, number> | null;

  const [selectedAsset, setSelectedAsset] = useState<WithdrawAsset>('XLM');
  const [xlmBalance, setXlmBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);

  // Check URL query parameters for pre-selected asset
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const assetParam = params.get('asset')?.toUpperCase();
      if (assetParam === 'XLM' || assetParam === 'USDC') {
        setSelectedAsset(assetParam as WithdrawAsset);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  const refreshBalances = () => {
    if (!walletAddress) { setBalancesLoading(false); return; }
    setBalancesLoading(true);
    server.loadAccount(walletAddress)
      .then((account) => {
        const native = account.balances.find((b) => b.asset_type === 'native');
        const nativeBalStr = native ? Math.round(parseFloat((native as any).balance)).toString() : '0';
        setXlmBalance(nativeBalStr);

        let usdcBalStr: string | null = null;
        const currentIssuer = process.env.NEXT_PUBLIC_USDC_ISSUER;
        if (currentIssuer) {
          const usdc = account.balances.find(
            (b) => (b as any).asset_code === 'USDC' && (b as any).asset_issuer === currentIssuer
          );
          usdcBalStr = usdc ? Math.round(parseFloat((usdc as any).balance)).toString() : null;
          setUsdcBalance(usdcBalStr);
        }

        // If user holds only USDC and no XLM, default to USDC.
        // Otherwise default to XLM since creator balances default to XLM.
        const numNative = parseFloat(nativeBalStr);
        const numUsdc = usdcBalStr ? parseFloat(usdcBalStr) : 0;
        if (numUsdc > 0 && numNative === 0) {
          setSelectedAsset((prev) => {
            const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
            return params?.get('asset')?.toUpperCase() === 'XLM' ? 'XLM' : 'USDC';
          });
        }
      })
      .catch(() =>
        notify.error(
          'Could not load your balances',
          'Make sure your wallet is funded on testnet, then refresh the page.',
        ),
      )
      .finally(() => setBalancesLoading(false));
  };

  useEffect(() => {
    refreshBalances();
  }, [walletAddress]);

  const NGN_PER_USDC = ngnRate?.rate || 1380;
  const NGN_PER_XLM = ngnRate?.xlmRate || (prices?.XLM ? Math.round(prices.XLM * NGN_PER_USDC) : 165);
  const currentRate = selectedAsset === 'XLM' ? NGN_PER_XLM : NGN_PER_USDC;

  const naira = amount ? Number(amount) * currentRate : 0;
  const availableXlm = xlmBalance != null ? parseFloat(xlmBalance) : 0;
  const availableUsdc = usdcBalance != null ? parseFloat(usdcBalance) : 0;
  const availableBalance = selectedAsset === 'XLM' ? availableXlm : availableUsdc;

  const verifyAccount = async (acctNo: string, selectedBank: string) => {
    if (!/^\d{10}$/.test(acctNo) || !selectedBank) return;
    setVerifying(true);
    setVerifyError(null);
    setAccountName(null);
    try {
      const res = await fetch(`/api/verify-account?accountNo=${acctNo}&bank=${encodeURIComponent(selectedBank)}`);
      if (res.ok) {
        const data = await res.json();
        setAccountName(data.accountName);
      } else {
        const data = await res.json().catch(() => ({}));
        setVerifyError(data.error || 'Could not verify account');
      }
    } catch {
      setVerifyError('Could not reach verification service');
    } finally {
      setVerifying(false);
    }
  };

  const handleAccountChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
    setAccountNo(digitsOnly);
    setAccountName(null);
    setVerifyError(null);
    if (digitsOnly.length === 10 && bank) {
      verifyAccount(digitsOnly, bank);
    }
  };

  const handleBankChange = (value: string) => {
    setBank(value);
    setAccountName(null);
    setVerifyError(null);
    if (accountNo.length === 10 && value) {
      verifyAccount(accountNo, value);
    }
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { setError('Enter an amount greater than zero.'); return; }
    if (selectedAsset === 'XLM' && xlmBalance !== null && n > availableXlm) {
      setError('Amount exceeds your available XLM balance.');
      return;
    }
    if (selectedAsset === 'USDC' && usdcBalance !== null && n > availableUsdc) {
      setError('Amount exceeds your available USDC balance.');
      return;
    }
    if (!/^\d{10}$/.test(accountNo)) { setError('Enter a valid 10-digit account number.'); return; }
    if (!bank) { setError('Select your bank.'); return; }
    if (!accountName && !verifying) { setError('Please verify your account number first.'); return; }
    setStage('processing');
    setTimeout(() => {
      setRef(`PL-${Date.now().toString(36).toUpperCase()}`);
      setStage('done');
      notify.success('Withdrawal initiated');
    }, 2200);
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppNav />
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">Withdraw to Naira</h1>
            <p className="mt-1 text-sm text-muted font-medium">
              Convert your XLM or USDC directly to NGN and send it to your bank account.
            </p>
          </div>

          <div className="card-brutal bg-brand-cyan p-4 sm:p-5">
            <p className="text-xs font-bold text-ink/70 uppercase tracking-wide mb-2">Your balances</p>
            {balancesLoading ? (
              <Skeleton className="h-10 w-48" />
            ) : (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <button
                  type="button"
                  onClick={() => { setSelectedAsset('XLM'); setAmount(''); setError(null); }}
                  className={`text-xl font-extrabold tabular-nums cursor-pointer hover:opacity-80 transition-opacity ${
                    selectedAsset === 'XLM' ? 'text-ink underline decoration-2 underline-offset-4' : 'text-ink/80'
                  }`}
                  title="Click to withdraw XLM"
                >
                  {xlmBalance != null ? Number(xlmBalance).toLocaleString() : '—'} <span className="text-base font-bold text-ink/70">XLM</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedAsset('USDC'); setAmount(''); setError(null); }}
                  className={`text-xl font-extrabold tabular-nums cursor-pointer hover:opacity-80 transition-opacity ${
                    selectedAsset === 'USDC' ? 'text-ink underline decoration-2 underline-offset-4' : 'text-ink/80'
                  }`}
                  title="Click to withdraw USDC"
                >
                  {usdcBalance != null ? Number(usdcBalance).toLocaleString() : '—'} <span className="text-base font-bold text-ink/70">USDC</span>
                </button>
              </div>
            )}
          </div>

          <div className="card-brutal bg-brand-lime/30 p-4 text-sm font-medium text-ink">
            Demo mode, this simulates a licensed off-ramp. No real bank transfer occurs and no on-chain funds move.
          </div>

          {stage === 'done' ? (
            <div className="card-brutal p-6 sm:p-8 text-center space-y-4">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-3xl">✓</div>
              <div>
                <p className="text-xl font-extrabold text-ink">Withdrawal initiated</p>
                <p className="mt-1 text-sm text-muted font-medium">
                  ₦{naira.toLocaleString()} is on its way to your {bank} account ending {accountNo.slice(-4)}.
                </p>
              </div>
              <div className="rounded-xl bg-background border-2 border-ink/10 p-3 text-sm space-y-1">
                <div>
                  <span className="text-muted font-medium">Withdrawn</span>{' '}
                  <span className="font-bold text-ink">{amount} {selectedAsset}</span>
                </div>
                <div>
                  <span className="text-muted font-medium">Reference</span>{' '}
                  <span className="font-mono font-bold">{ref}</span>
                </div>
              </div>
              <button
                className="btn-brutal btn-brutal-white w-full"
                onClick={() => { setStage('form'); setAmount(''); setAccountNo(''); setBank(''); }}
              >
                Make another withdrawal
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="card-brutal p-6 space-y-4">
              {/* Asset Selector */}
              <div>
                <label className="block text-sm font-bold text-ink mb-1.5">
                  Asset to cash out
                </label>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select asset to withdraw">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedAsset === 'XLM'}
                    onClick={() => { setSelectedAsset('XLM'); setAmount(''); setError(null); }}
                    className={`p-3 rounded-xl border-2 font-bold text-left transition-all cursor-pointer ${
                      selectedAsset === 'XLM'
                        ? 'bg-brand-lime border-ink shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-ink'
                        : 'bg-card border-ink/20 hover:border-ink/50 text-ink/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold">XLM</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/70 border border-ink/20 text-ink">
                        Native
                      </span>
                    </div>
                    <p className="text-xs text-ink/70 mt-1 font-medium">
                      Bal: {xlmBalance != null ? Number(xlmBalance).toLocaleString() : '—'} XLM
                    </p>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedAsset === 'USDC'}
                    onClick={() => { setSelectedAsset('USDC'); setAmount(''); setError(null); }}
                    className={`p-3 rounded-xl border-2 font-bold text-left transition-all cursor-pointer ${
                      selectedAsset === 'USDC'
                        ? 'bg-brand-cyan border-ink shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-ink'
                        : 'bg-card border-ink/20 hover:border-ink/50 text-ink/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-extrabold">USDC</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/70 border border-ink/20 text-ink">
                        Stablecoin
                      </span>
                    </div>
                    <p className="text-xs text-ink/70 mt-1 font-medium">
                      Bal: {usdcBalance != null ? Number(usdcBalance).toLocaleString() : '—'} USDC
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-bold text-ink" htmlFor="amt">
                    Amount ({selectedAsset})
                  </label>
                  {availableBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(availableBalance.toString())}
                      className="text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      Max ({availableBalance.toLocaleString()} {selectedAsset})
                    </button>
                  )}
                </div>
                <input
                  id="amt"
                  className="input-brutal"
                  inputMode="decimal"
                  placeholder={selectedAsset === 'XLM' ? '100' : '50.00'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={stage === 'processing'}
                />
                {naira > 0 && (
                  <div className="mt-1.5 text-sm text-muted font-medium">
                    <p>
                      You&apos;ll receive ≈{' '}
                      <span className="font-bold text-ink">₦{naira.toLocaleString()}</span>{' '}
                      <span className="text-muted">(₦{currentRate.toLocaleString()}/{selectedAsset})</span>
                    </p>
                    {ngnRate?.ageMinutes != null && (
                      <p className="text-xs mt-0.5">
                        Rate as of {ngnRate.ageMinutes === 0 ? 'just now' : `${ngnRate.ageMinutes}m ago`}
                        {ngnRate.isStale && (
                          <span className="text-amber-600 font-bold ml-1">· rate may be stale</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-ink/15 bg-background p-3 text-xs text-muted font-medium space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-ink font-bold">
                    ✓ Direct {selectedAsset} cash-out enabled
                  </p>
                  {selectedAsset === 'XLM' && (
                    <button
                      type="button"
                      onClick={() => setShowConvertModal(true)}
                      className="text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      Swap XLM to USDC
                    </button>
                  )}
                </div>
                <p>
                  Your {selectedAsset} will be converted directly to Naira at the market rate (no prior swap to USDC required).
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-ink mb-1.5" htmlFor="bank">
                  Bank
                </label>
                <select
                  id="bank"
                  className="input-brutal"
                  value={bank}
                  onChange={(e) => handleBankChange(e.target.value)}
                  disabled={stage === 'processing'}
                >
                  <option value="">Select bank…</option>
                  {NIGERIAN_BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-ink mb-1.5" htmlFor="acct">
                  Account number
                </label>
                <input
                  id="acct"
                  className="input-brutal"
                  inputMode="numeric"
                  placeholder="0123456789"
                  value={accountNo}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  maxLength={10}
                  disabled={stage === 'processing'}
                />
                {verifying && (
                  <p className="mt-1.5 text-xs text-muted font-medium">Verifying account…</p>
                )}
                {accountName && (
                  <p className="mt-1.5 text-sm font-bold text-emerald-700">
                    Account holder: {accountName}
                  </p>
                )}
                {verifyError && (
                  <p className="mt-1.5 text-sm font-bold text-red-600">{verifyError}</p>
                )}
              </div>

              {error && (
                <div className="card-brutal bg-brand-pink p-3 text-sm font-bold text-ink">{error}</div>
              )}

              <button
                type="submit"
                disabled={stage === 'processing'}
                className="btn-brutal btn-brutal-primary w-full"
              >
                {stage === 'processing' ? 'Processing…' : 'Withdraw to bank'}
              </button>
            </form>
          )}
        </div>
      </div>

      {showConvertModal && (
        <ConvertXlmToUsdcModal
          open={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          maxXlm={xlmBalance ? Number(xlmBalance) : 0}
          onSuccess={refreshBalances}
        />
      )}
    </ProtectedRoute>
  );
}
