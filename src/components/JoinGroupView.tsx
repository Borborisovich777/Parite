import React from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Compass,
  Link2,
  LoaderCircle,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

export interface JoinGroupViewProps {
  inviteCode: string;
  displayName: string;
  onInviteCodeChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onBack: () => void;
  isInviteLinkPrefilled?: boolean;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  accountContext?: React.ReactNode;
  idPrefix?: string;
}

export const JoinGroupView: React.FC<JoinGroupViewProps> = ({
  inviteCode,
  displayName,
  onInviteCodeChange,
  onDisplayNameChange,
  onSubmit,
  onBack,
  isInviteLinkPrefilled = false,
  isSubmitting = false,
  submitDisabled = false,
  error = null,
  accountContext,
  idPrefix = 'join',
}) => {
  const headingId = `${idPrefix}-heading`;
  const formDescriptionId = `${idPrefix}-approval-description`;
  const inviteCodeHelpId = `${idPrefix}-invite-code-help`;
  const displayNameHelpId = `${idPrefix}-display-name-help`;
  const linkContextId = `${idPrefix}-link-context`;
  const errorId = `${idPrefix}-error`;
  const isSubmitDisabled = isSubmitting || submitDisabled;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-5 px-4 py-6 animate-fade-in sm:px-6 md:py-10">
      <div>
        <button
          type="button"
          id={`btn-${idPrefix}-back`}
          onClick={onBack}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-4 text-xs font-bold text-[var(--color-text)] shadow-sm hover:bg-[var(--color-surface-soft)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
      </div>

      <header className="text-center" aria-labelledby={headingId}>
        <span className="accent-glow mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-positive)] text-[#fff]">
          <Compass className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
          Private group
        </p>
        <h1
          id={headingId}
          className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl"
        >
          Join a group
        </h1>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[var(--color-muted)] sm:text-sm">
          Use the code from your invitation and choose the name your group will see.
        </p>
      </header>

      {accountContext}

      <form
        onSubmit={onSubmit}
        className="parite-card flex flex-col gap-5 p-4 sm:p-6"
        aria-describedby={`${formDescriptionId}${error ? ` ${errorId}` : ''}`}
        aria-busy={isSubmitting}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-positive)]">
              Access request
            </p>
            <h2 className="mt-1 font-display text-lg font-bold text-[var(--color-text)]">
              Your invitation
            </h2>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        {isInviteLinkPrefilled && (
          <div
            id={linkContextId}
            className="header-wash flex items-start gap-3 rounded-2xl border border-[var(--color-border)] p-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[var(--color-positive)]">
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-bold text-[var(--color-text)]">Invite link detected</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                We filled in the code from your link. You can review or edit it before sending your request.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div
            id={errorId}
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-[var(--color-negative)]/20 bg-[var(--color-negative-soft)] p-3 text-xs leading-relaxed text-[var(--color-negative)]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`input-${idPrefix}-invite-code`}
              className="block text-xs font-bold text-[var(--color-text)]"
            >
              Invite code
            </label>
            <p id={inviteCodeHelpId} className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
              Paste a link’s code or enter the manual code.
            </p>
            <input
              type="text"
              id={`input-${idPrefix}-invite-code`}
              required
              maxLength={32}
              value={inviteCode}
              onChange={event => onInviteCodeChange(event.target.value.toUpperCase())}
              placeholder="e.g. GRAD26"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              aria-describedby={`${inviteCodeHelpId}${isInviteLinkPrefilled ? ` ${linkContextId}` : ''}${error ? ` ${errorId}` : ''}`}
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-3 font-mono text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-text)] placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--color-muted)] focus:border-[var(--color-positive)] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`input-${idPrefix}-display-name`}
              className="block text-xs font-bold text-[var(--color-text)]"
            >
              Your display name
            </label>
            <p id={displayNameHelpId} className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
              This is how other members will recognize you.
            </p>
            <input
              type="text"
              id={`input-${idPrefix}-display-name`}
              required
              maxLength={80}
              value={displayName}
              onChange={event => onDisplayNameChange(event.target.value)}
              placeholder="e.g. Noor"
              autoComplete="name"
              aria-invalid={Boolean(error)}
              aria-describedby={`${displayNameHelpId}${error ? ` ${errorId}` : ''}`}
              className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] placeholder:font-normal placeholder:text-[var(--color-muted)] focus:border-[var(--color-positive)] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div
          id={formDescriptionId}
          className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3"
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
            <span className="font-bold text-[var(--color-text)]">Admin approval is required.</span>{' '}
            Your request stays pending until a group admin approves it. Invite links and manual codes follow the same review.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            id={`btn-${idPrefix}-cancel`}
            onClick={onBack}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white px-5 text-xs font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            id={`btn-${idPrefix}-submit`}
            disabled={isSubmitDisabled}
            className="accent-glow inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-positive)] px-5 text-xs font-bold text-[#fff] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <UserPlus className="h-4 w-4" aria-hidden="true" />}
            <span>{isSubmitting ? 'Sending request…' : 'Request group access'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
