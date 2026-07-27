import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, QrCode, RefreshCw, Share2, ShieldCheck, UserPlus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type InviteFeedback = 'shared' | 'link-copied' | 'code-copied' | 'code-refreshed' | null;

export interface InviteShareCardProps {
  groupName: string;
  inviteCode: string;
  inviteUrl: string;
  approvalRequired?: boolean;
  onRegenerateInviteCode?: () => void | Promise<void>;
  className?: string;
  idPrefix?: string;
}

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('The browser did not copy the invitation.');
  } finally {
    document.body.removeChild(textArea);
  }
};

export const InviteShareCard: React.FC<InviteShareCardProps> = ({
  groupName,
  inviteCode,
  inviteUrl,
  approvalRequired = true,
  onRegenerateInviteCode,
  className = '',
  idPrefix = 'member-invite',
}) => {
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [feedback, setFeedback] = useState<InviteFeedback>(null);
  const [error, setError] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const clearFeedbackTimer = () => {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  };

  const showFeedback = (nextFeedback: Exclude<InviteFeedback, null>) => {
    clearFeedbackTimer();
    setFeedback(nextFeedback);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimeoutRef.current = null;
    }, 2200);
  };

  useEffect(() => () => clearFeedbackTimer(), []);

  useEffect(() => {
    setError(null);
  }, [inviteCode, inviteUrl]);

  const handleCopy = async (
    value: string,
    nextFeedback: 'link-copied' | 'code-copied',
  ) => {
    setError(null);
    try {
      await copyText(value);
      showFeedback(nextFeedback);
    } catch (copyError) {
      console.error(copyError);
      setError('Could not copy the invitation. Select the manual code below instead.');
    }
  };

  const handleShare = async () => {
    setError(null);

    if (!canUseNativeShare) {
      await handleCopy(inviteUrl, 'link-copied');
      return;
    }

    try {
      await navigator.share({
        title: `Join ${groupName} on Parité`,
        text: approvalRequired
          ? `You are invited to ${groupName} on Parité. A group admin will approve your request.`
          : `You are invited to ${groupName} on Parité.`,
        url: inviteUrl,
      });
      showFeedback('shared');
    } catch (shareError) {
      if (
        shareError
        && typeof shareError === 'object'
        && 'name' in shareError
        && shareError.name === 'AbortError'
      ) {
        return;
      }

      try {
        await copyText(inviteUrl);
        showFeedback('link-copied');
      } catch (copyError) {
        console.error(shareError, copyError);
        setError('Could not share the invitation. Select the manual code below instead.');
      }
    }
  };

  const handleRegenerate = async () => {
    if (
      !onRegenerateInviteCode
      || !window.confirm(
        'Create a new invite code? Existing invite links, QR codes, and the current manual code will stop working. Pending requests stay unchanged.'
      )
    ) {
      return;
    }

    setIsRegenerating(true);
    setFeedback(null);
    setError(null);

    try {
      await onRegenerateInviteCode();
      showFeedback('code-refreshed');
    } catch (regenerateError) {
      console.error(regenerateError);
      setError(regenerateError instanceof Error ? regenerateError.message : 'Could not create a new invite code.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const feedbackMessage = feedback === 'shared'
    ? 'Invite shared'
    : feedback === 'link-copied'
      ? 'Invite link copied'
      : feedback === 'code-copied'
        ? 'Manual code copied'
        : feedback === 'code-refreshed'
          ? 'New invite code ready'
        : '';

  const qrRegionId = `${idPrefix}-qr`;
  const headingId = `${idPrefix}-heading`;

  return (
    <section
      className={`header-wash rounded-3xl border border-[var(--color-border)] p-4 shadow-[var(--shadow-card)] ${className}`.trim()}
      aria-labelledby={headingId}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-[var(--color-positive)] shadow-sm">
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-sm font-bold text-[var(--color-text)]">
              Invite people
            </h2>
            {approvalRequired && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-positive)]/15 bg-white/70 px-2 py-1 text-[9px] font-bold text-[var(--color-positive)]">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Admin approval
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
            Invite people to <span className="font-semibold text-[var(--color-text)]">{groupName}</span>.
            {approvalRequired
              ? ' Anyone with this link or code can request to join. An admin must still approve them.'
              : ' Anyone with this link or code can join.'}
          </p>
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${canUseNativeShare ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <button
          type="button"
          id={`btn-share-${idPrefix}`}
          onClick={handleShare}
          className="accent-glow flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-positive)] px-4 text-xs font-bold text-[#fff]"
        >
          {feedback === 'shared' || (!canUseNativeShare && feedback === 'link-copied')
            ? <Check className="h-4 w-4" aria-hidden="true" />
            : <Share2 className="h-4 w-4" aria-hidden="true" />}
          {feedback === 'shared'
            ? 'Shared'
            : !canUseNativeShare && feedback === 'link-copied'
              ? 'Link copied'
              : canUseNativeShare
                ? 'Share invite'
                : 'Copy invite link'}
        </button>

        {canUseNativeShare && (
          <button
            type="button"
            id={`btn-copy-${idPrefix}-link`}
            onClick={() => handleCopy(inviteUrl, 'link-copied')}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-xs font-bold text-[var(--color-positive)]"
          >
            {feedback === 'link-copied'
              ? <Check className="h-4 w-4" aria-hidden="true" />
              : <Link2 className="h-4 w-4" aria-hidden="true" />}
            {feedback === 'link-copied' ? 'Link copied' : 'Copy link'}
          </button>
        )}

        <button
          type="button"
          id={`btn-toggle-${idPrefix}-qr`}
          onClick={() => setIsQrOpen(current => !current)}
          aria-expanded={isQrOpen}
          aria-controls={qrRegionId}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-xs font-bold text-[var(--color-positive)]"
        >
          <QrCode className="h-4 w-4" aria-hidden="true" />
          {isQrOpen ? 'Hide QR' : 'Show QR'}
        </button>
      </div>

      {isQrOpen && (
        <div
          id={qrRegionId}
          className="mt-3 grid gap-4 rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:grid-cols-[auto_1fr] sm:items-center"
        >
          <div className="mx-auto w-fit rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-sm sm:mx-0">
            <QRCodeSVG
              value={inviteUrl}
              size={184}
              level="M"
              marginSize={4}
              bgColor="#ffffff"
              fgColor="#17211d"
              title={`QR code to join ${groupName}`}
              className="block h-auto max-w-full"
            />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="text-sm font-bold text-[var(--color-text)]">Scan to request access</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
              The join page opens with the invite code already filled in.
              {approvalRequired ? ' Scanning does not bypass admin approval.' : ''}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-3xl border border-[var(--color-border)] bg-white/80 p-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-muted)]">
          Or join manually
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 select-all rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.18em] text-[var(--color-text)] sm:text-left">
            {inviteCode}
          </code>
          <button
            type="button"
            id={`btn-copy-${idPrefix}`}
            onClick={() => handleCopy(inviteCode, 'code-copied')}
            className="flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-xs font-bold text-[var(--color-positive)]"
          >
            {feedback === 'code-copied'
              ? <Check className="h-4 w-4" aria-hidden="true" />
              : <Copy className="h-4 w-4" aria-hidden="true" />}
            {feedback === 'code-copied' ? 'Code copied' : 'Copy code'}
          </button>
        </div>
      </div>

      {(feedbackMessage || error || onRegenerateInviteCode) && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={`min-h-5 text-xs font-semibold ${error ? 'text-[var(--color-negative)]' : 'text-[var(--color-positive)]'}`}
            role={error ? 'alert' : 'status'}
            aria-live="polite"
          >
            {error || feedbackMessage}
          </p>
          {onRegenerateInviteCode && (
            <button
              type="button"
              id={`btn-regenerate-${idPrefix}`}
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 text-xs font-bold text-[var(--color-negative)] hover:bg-white/60 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isRegenerating ? 'Creating new code' : 'Create new code'}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
