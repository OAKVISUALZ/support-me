'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://support-mee.vercel.app';

interface ShareCardCreator {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  donationGoal: number | null;
  acceptsXlm: boolean;
}

interface ShareCardDonation {
  amount: number;
  currency: string;
}

interface ShareCardProps {
  creator: ShareCardCreator;
  donations: ShareCardDonation[];
  onClose: () => void;
}

type CardSize = 'landscape' | 'square';

// width/height in px, rendered at 2x for a crisp download.
const SIZES: Record<CardSize, { width: number; height: number; label: string }> = {
  landscape: { width: 1200, height: 630, label: 'Landscape (1200×630)' },
  square: { width: 1080, height: 1080, label: 'Square (1080×1080, IG)' },
};

const EXPORT_SCALE = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Downloadable social share card for a creator: name, avatar, goal progress,
 * and a QR code linking to their profile. Drawn on a plain <canvas> — no
 * html2canvas/DOM-to-image dependency — using the QRCodeCanvas below as an
 * offscreen source bitmap for the QR code.
 */
export function ShareCard({ creator, donations, onClose }: ShareCardProps) {
  const [size, setSize] = useState<CardSize>('landscape');
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const profileUrl = `${SITE_URL}/${creator.username}`;
  const name = creator.displayName || creator.username;

  // Same "assume the goal is in whichever asset the creator accepts, XLM
  // taking priority" convention used on the public profile page.
  const goalCurrency = creator.acceptsXlm ? 'XLM' : 'USDC';
  const goalReceived = donations
    .filter((d) => d.currency === goalCurrency)
    .reduce((sum, d) => sum + d.amount, 0);
  const goal = creator.donationGoal;
  const goalPct = goal ? Math.min(100, (goalReceived / goal) * 100) : 0;

  useEffect(() => {
    if (!modalRef.current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      const canvas = canvasRef.current;
      const qrCanvas = qrRef.current;
      if (!canvas || !qrCanvas) return;

      setRendering(true);
      const { width, height } = SIZES[size];
      canvas.width = width * EXPORT_SCALE;
      canvas.height = height * EXPORT_SCALE;
      // No inline CSS size here: the canvas's width/height attributes give it
      // an intrinsic aspect ratio, and the "max-w-full h-auto" classes below
      // scale it down to fit the modal while preserving that ratio.

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

      const pad = width * 0.06;
      const inkColor = '#0a0a0a';

      // Background + thick "brutal" border, matching the app's card style.
      ctx.fillStyle = '#ffd84d';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, width - 10, height - 10);

      ctx.fillStyle = '#ffffff';
      roundRectPath(ctx, pad, pad, width - pad * 2, height - pad * 2, 0);
      ctx.fill();
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 6;
      roundRectPath(ctx, pad, pad, width - pad * 2, height - pad * 2, 0);
      ctx.stroke();

      const innerPad = pad * 1.6;
      const avatarSize = width * 0.16;
      const avatarX = innerPad;

      // QR block sits top-right, in its own column, so nothing else needs to
      // reason about avoiding it — every other element is laid out within
      // the remaining left column (0 to qrX - columnGap).
      const qrSize = width * 0.16;
      const columnGap = innerPad * 0.5;
      const qrX = width - innerPad - qrSize;
      const leftColumnWidth = qrX - columnGap - innerPad;

      // The whole content block (header + goal bar + wordmark) is a fixed
      // height derived from `width` alone, so on a much taller canvas (the
      // square variant) it would otherwise sit pinned to the top with a
      // large empty gap below. Center it vertically within the box instead.
      const barGap = innerPad * 0.9;
      const barTrackGap = width * 0.018;
      const barHeight = width * 0.03;
      const wordmarkGap = innerPad * 0.6;
      const wordmarkHeight = width * 0.026;
      const blockHeight = avatarSize + barGap + barTrackGap + barHeight + wordmarkGap + wordmarkHeight;
      const boxInteriorHeight = height - pad * 2;
      const avatarY = pad + Math.max(innerPad - pad, (boxInteriorHeight - blockHeight) / 2);
      const qrY = avatarY;

      // Avatar (circle-clipped), falling back to an initials badge.
      let avatarImg: HTMLImageElement | null = null;
      if (creator.avatarUrl) {
        try {
          avatarImg = await loadImage(creator.avatarUrl);
        } catch {
          avatarImg = null;
        }
      }
      if (cancelled) return;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      if (avatarImg) {
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      } else {
        ctx.fillStyle = '#7c3aed';
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${avatarSize * 0.4}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + avatarSize * 0.02);
      }
      ctx.restore();
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Name + handle, to the right of the avatar.
      const textX = avatarX + avatarSize + innerPad * 0.6;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = inkColor;
      ctx.font = `800 ${width * 0.045}px system-ui, sans-serif`;
      ctx.fillText(name, textX, avatarY + avatarSize * 0.45);
      ctx.fillStyle = 'rgba(10,10,10,0.6)';
      ctx.font = `600 ${width * 0.026}px system-ui, sans-serif`;
      ctx.fillText(`@${creator.username}`, textX, avatarY + avatarSize * 0.75);

      // Goal progress bar, or a plain tagline when no goal is set. Confined
      // to the left column's width so it never runs under the QR block.
      const barY = avatarY + avatarSize + barGap;
      const barX = innerPad;
      const barWidth = leftColumnWidth;
      if (goal) {
        ctx.fillStyle = inkColor;
        ctx.font = `700 ${width * 0.024}px system-ui, sans-serif`;
        ctx.fillText(
          `${goalReceived.toFixed(0)} / ${goal} ${goalCurrency} · ${goalPct.toFixed(0)}%`,
          barX,
          barY
        );
        const barTrackY = barY + barTrackGap;
        ctx.fillStyle = 'rgba(10,10,10,0.1)';
        roundRectPath(ctx, barX, barTrackY, barWidth, barHeight, barHeight / 2);
        ctx.fill();
        ctx.fillStyle = '#b4f461';
        roundRectPath(ctx, barX, barTrackY, Math.max(barHeight, (barWidth * goalPct) / 100), barHeight, barHeight / 2);
        ctx.fill();
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 3;
        roundRectPath(ctx, barX, barTrackY, barWidth, barHeight, barHeight / 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(10,10,10,0.7)';
        ctx.font = `600 ${width * 0.028}px system-ui, sans-serif`;
        ctx.fillText('Support me with a tip on SupportMe', barX, barY);
      }

      // QR code, top-right, with its link caption directly below it —
      // entirely inside the right column, clear of the left column's text.
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(qrX, qrY, qrSize, qrSize);

      ctx.textAlign = 'center';
      ctx.fillStyle = inkColor;
      ctx.font = `700 ${width * 0.018}px system-ui, sans-serif`;
      ctx.fillText('Scan or visit', qrX + qrSize / 2, qrY + qrSize + width * 0.022);
      ctx.font = `800 ${width * 0.017}px system-ui, sans-serif`;
      ctx.fillText(
        profileUrl.replace(/^https?:\/\//, ''),
        qrX + qrSize / 2,
        qrY + qrSize + width * 0.022 + width * 0.026
      );

      // Wordmark, directly below the goal bar (not pinned to the box's
      // bottom edge, so it stays close to the rest of the content).
      const barTrackYFinal = barY + barTrackGap;
      ctx.textAlign = 'left';
      ctx.fillStyle = inkColor;
      ctx.font = `800 ${wordmarkHeight}px system-ui, sans-serif`;
      ctx.fillText('SupportMe', innerPad, barTrackYFinal + barHeight + wordmarkGap + wordmarkHeight);

      if (!cancelled) setRendering(false);
    };

    draw();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, creator, goal, goalCurrency, goalPct, goalReceived, name, profileUrl]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${creator.username}-supportme-share-${size}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!navigator.clipboard || !('write' in navigator.clipboard)) {
      toast.error('Clipboard image copy is not supported in this browser.');
      return;
    }
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast.success('Share card copied to clipboard!');
      } catch {
        toast.error('Could not copy the share card.');
      }
    }, 'image/png');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Profile link copied to clipboard!');
    } catch {
      toast.error('Could not copy the profile link.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
      <div ref={modalRef} className="card-brutal bg-background max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-ink">Share Card</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn-brutal btn-brutal-white px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {(Object.keys(SIZES) as CardSize[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSize(key)}
              className={`btn-brutal text-sm px-3 py-1.5 ${size === key ? 'btn-brutal-primary' : 'btn-brutal-white'}`}
            >
              {SIZES[key].label}
            </button>
          ))}
        </div>

        <div className="border-2 border-ink/10 rounded overflow-auto flex justify-center bg-card p-4">
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        </div>

        {/* Offscreen QR source bitmap; drawn onto the canvas above, never shown itself. */}
        <div className="hidden">
          <QRCodeCanvas ref={qrRef} value={profileUrl} size={512} level="M" includeMargin={false} />
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <button
            type="button"
            onClick={handleDownload}
            disabled={rendering}
            className="btn-brutal btn-brutal-primary"
          >
            Download PNG
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={rendering}
            className="btn-brutal btn-brutal-white"
          >
            Copy to Clipboard
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="btn-brutal btn-brutal-white"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
