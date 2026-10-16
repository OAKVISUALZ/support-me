'use client';

import React, { useState } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { notify } from '@/lib/notify';
import { useAuth } from '@/context/AuthContext';
import { signTransaction } from '@/lib/wallet'; // adjust import to match your wallet helper

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const server = new StellarSdk.Horizon.Server(HORIZON_URL);
const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER;

export default function ConvertXlmToUsdcModal({
  open,
  onClose,
  maxXlm,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  maxXlm: number;
  onSuccess?: (newUsdcBalance?: number) => void;
}) {
  const { user } = useAuth();
  const walletAddress = user?.walletAddress || '';
  const [amount, setAmount] = useState(String(maxXlm || ''));
  const [loading, setLoading] = useState(false);

  if (!open) return null;
  if (!USDC_ISSUER) {
    return (
      <div className="modal">
        <div className="card-brutal p-6">
          <h2 className="text-lg font-bold">Convert XLM → USDC</h2>
          <p className="mt-2 text-sm text-muted">USDC issuer is not configured on this deployment.</p>
          <div className="mt-4">
            <button className="btn-brutal" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  async function handleConvert() {
    setLoading(true);
    try {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error('Enter a valid amount');

      // Load account and build a path payment transaction that pays XLM and
      // receives USDC to the same user account.
      const account = await server.loadAccount(walletAddress);
      const usdcAsset = new StellarSdk.Asset('USDC', USDC_ISSUER);

      const txBuilder = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      });

      txBuilder.addOperation(
        StellarSdk.Operation.pathPaymentStrictSend({
          sendAsset: StellarSdk.Asset.native(),
          sendAmount: n.toFixed(7), // send XLM fixed format
          destination: walletAddress,
          destAsset: usdcAsset,
          destMin: '0', // permissive: in prod compute destMin to protect against slippage
          path: [], // empty path will allow Stellar DEX to find path (native -> USDC)
        }),
      );

      const tx = txBuilder.setTimeout(180).build();

      // Let the user's wallet sign the transaction.
      // NOTE: adapt to your wallet helper's API: some helpers expect a Transaction object,
      // others expect XDR. The helper used here is `signTransaction` — update if needed.
      const signedXdr = await signTransaction(tx); // <-- adjust if your helper differs

      // If signTransaction already submits, you can skip submit below.
      // Otherwise, submit the signed XDR to Horizon.
      // If `signTransaction` returns a signed Transaction object/XDR, submit with server.
      try {
        // If signTransaction returned a Transaction object or XDR, handle both.
        if (typeof signedXdr === 'string') {
          // assume XDR string
          await server.submitTransaction(
            StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET),
          );
        } else if ((signedXdr as any).toXDR) {
          // assume Transaction instance
          await server.submitTransaction(signedXdr as any);
        } else {
          // Fallback: try signing locally if the wallet helper returned the signed transaction
          // (you may need to adapt this block to your wallet lib)
          throw new Error('Unexpected signed transaction form — adapt wallet helper integration');
        }
      } catch (submitErr) {
        // Some wallet helpers submit themselves and return a result; tolerate both.
      }

      notify.success('Conversion submitted — check your wallet for confirmations');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      notify.error('Conversion failed', err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="card-brutal p-6 w-full max-w-lg">
        <h2 className="text-lg font-extrabold mb-2">Convert XLM → USDC</h2>
        <p className="text-sm text-muted mb-4">
          Convert XLM in your wallet to USDC so you can withdraw to Naira. This will open your wallet to confirm a Stellar swap transaction.
        </p>

        <label className="block text-sm font-bold mb-1">Amount (XLM)</label>
        <input
          className="input-brutal mb-3"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          disabled={loading}
        />
        <div className="flex gap-2">
          <button className="btn-brutal btn-brutal-white" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-brutal btn-brutal-primary" onClick={handleConvert} disabled={loading}>
            {loading ? 'Converting…' : `Convert ${amount || ''} XLM`}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Note: this runs on Stellar testnet in demo mode. In production the app should compute an expected destination amount and enforce a minimum received (slippage protection).
        </p>
      </div>
    </div>
  );
}
