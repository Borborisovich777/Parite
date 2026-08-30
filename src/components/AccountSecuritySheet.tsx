import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';

export interface AccountEmailChangeResult {
  currentEmail: string;
  pendingEmail: string | null;
}

interface AccountSecuritySheetProps {
  isOpen: boolean;
  currentEmail: string;
  pendingEmail?: string | null;
  onClose: () => void;
  onChangeEmail: (
    currentPassword: string,
    nextEmail: string,
  ) => Promise<AccountEmailChangeResult>;
  onChangePassword: (nextPassword: string) => Promise<void>;
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  autoComplete: 'current-password' | 'new-password';
  onChange: (value: string) => void;
  disabled?: boolean;
  minLength?: number;
  inputRef?: React.Ref<HTMLInputElement>;
}

const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  autoComplete,
  onChange,
  disabled = false,
  minLength,
  inputRef,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!value) setIsVisible(false);
  }, [value]);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"
      >
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={event => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          minLength={minLength}
          required
          className="min-h-12 w-full rounded-2xl border border-slate-700 bg-[#121418] px-3 py-2 pr-12 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setIsVisible(current => !current)}
          disabled={disabled}
          aria-label={isVisible ? `Hide ${label.toLocaleLowerCase()}` : `Show ${label.toLocaleLowerCase()}`}
          aria-pressed={isVisible}
          className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-2xl text-slate-500 hover:text-slate-200 disabled:cursor-default"
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

const getAuthErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
};

const getAccountErrorMessage = (error: unknown, fallback: string) => {
  const code = getAuthErrorCode(error);

  if (code === 'invalid_credentials') return 'The current password is incorrect.';
  if (code === 'email_exists' || code === 'user_already_exists') {
    return 'That email is already connected to another account.';
  }
  if (code === 'email_address_invalid') return 'Enter a valid email address.';
  if (code === 'same_password') return 'Choose a password you have not used for this account.';
  if (code === 'weak_password') {
    return 'This password does not meet the account security requirements. Try a longer, unique password.';
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Too many attempts. Wait a few minutes, then try again.';
  }
  if (code === 'session_not_found' || code === 'bad_jwt') {
    return 'Your session has expired. Log in again before changing account details.';
  }
  if (code.startsWith('reauth')) {
    return 'This account requires an additional verification code before the change can be completed.';
  }

  if (error instanceof Error && error.message.trim()) {
    const message = error.message.trim();
    if (!/(PGRST|SQLSTATE|constraint|relation .* does not exist)/i.test(message)) return message;
  }

  return fallback;
};

export const AccountSecuritySheet: React.FC<AccountSecuritySheetProps> = ({
  isOpen,
  currentEmail,
  pendingEmail = null,
  onClose,
  onChangeEmail,
  onChangePassword,
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busyForm, setBusyForm] = useState<'email' | 'password' | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const newEmailRef = useRef<HTMLInputElement>(null);
  const emailPasswordRef = useRef<HTMLInputElement>(null);
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setNewEmail('');
    setEmailPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setBusyForm(null);
    busyRef.current = false;
    setEmailError(null);
    setEmailStatus(null);
    setPasswordError(null);
    setPasswordStatus(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const appRoot = document.getElementById('root');
    const previousRootInert = appRoot?.inert ?? false;
    const previousRootAriaHidden = appRoot?.getAttribute('aria-hidden') ?? null;
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocus = dialogRef.current?.querySelector<HTMLElement>('[data-account-autofocus]');
      (initialFocus ?? dialogRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (busyRef.current) return;
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ) as HTMLElement[];
      const visibleFocusableElements = focusableElements.filter(
        element => !element.hidden && element.getClientRects().length > 0,
      );

      if (visibleFocusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstFocusable = visibleFocusableElements[0];
      const lastFocusable = visibleFocusableElements[visibleFocusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstFocusable || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && (activeElement === lastFocusable || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (appRoot) {
        appRoot.inert = previousRootInert;
        if (previousRootAriaHidden === null) appRoot.removeAttribute('aria-hidden');
        else appRoot.setAttribute('aria-hidden', previousRootAriaHidden);
      }
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isBusy = busyForm !== null;

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedEmail = newEmail.trim();
    setEmailError(null);
    setEmailStatus(null);

    if (requestedEmail.toLocaleLowerCase() === currentEmail.toLocaleLowerCase()) {
      setEmailError('Enter an email different from your current one.');
      newEmailRef.current?.focus();
      return;
    }

    busyRef.current = true;
    setBusyForm('email');
    try {
      const result = await onChangeEmail(emailPassword, requestedEmail);
      const waitingForConfirmation = result.pendingEmail ?? (
        result.currentEmail.toLocaleLowerCase() === requestedEmail.toLocaleLowerCase()
          ? null
          : requestedEmail
      );

      setEmailStatus(waitingForConfirmation
        ? `Confirmation is pending for ${waitingForConfirmation}. Keep using ${result.currentEmail} until the change is confirmed.`
        : `Your sign-in email is now ${result.currentEmail}.`);
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      setEmailError(getAccountErrorMessage(error, 'Could not start the email change. Try again.'));
      if (getAuthErrorCode(error) === 'invalid_credentials') emailPasswordRef.current?.focus();
      else newEmailRef.current?.focus();
    } finally {
      busyRef.current = false;
      setBusyForm(null);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordStatus(null);

    if (newPassword.length < 8) {
      setPasswordError('Use at least 8 characters for the new password.');
      newPasswordRef.current?.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new password confirmation does not match.');
      confirmPasswordRef.current?.focus();
      return;
    }

    busyRef.current = true;
    setBusyForm('password');
    try {
      await onChangePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordStatus('Password updated. Use the new password the next time you sign in.');
    } catch (error) {
      setPasswordError(getAccountErrorMessage(error, 'Could not update the password. Try again.'));
      newPasswordRef.current?.focus();
    } finally {
      busyRef.current = false;
      setBusyForm(null);
    }
  };

  const sheet = (
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/75 backdrop-blur-[3px]"
        onClick={onClose}
        disabled={isBusy}
        aria-label="Close account security"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-security-title"
        tabIndex={-1}
        className="relative z-10 flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[30px] border border-slate-800 bg-[#121418] shadow-2xl animate-slide-up md:rounded-[30px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-300">
              Your account
            </p>
            <h2 id="account-security-title" className="mt-1 font-display text-lg font-bold text-white">
              Email & password
            </h2>
            <p className="mt-1 break-all text-xs text-slate-500">{currentEmail}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            data-account-autofocus
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-slate-800 bg-[#1a1d23] text-slate-400 hover:text-white disabled:cursor-default disabled:opacity-60"
            aria-label="Close account security"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 no-scrollbar sm:px-5 sm:py-5">
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
            <p className="text-[11px] leading-relaxed text-slate-300">
              Changes apply only to your signed-in account. Your groups, expenses, roles, and member history stay linked to the same account ID.
            </p>
          </div>

          {pendingEmail && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
                Email confirmation pending
              </p>
              <p className="mt-1 break-all text-xs text-amber-100">{pendingEmail}</p>
            </div>
          )}

          <form
            onSubmit={handleEmailSubmit}
            className="rounded-3xl border border-slate-800 bg-[#1a1d23] p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
                <AtSign className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Change email</h3>
                <p className="text-[10px] text-slate-500">Confirmation may be required before it becomes active.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="input-account-new-email"
                  className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500"
                >
                  New email
                </label>
                <input
                  ref={newEmailRef}
                  id="input-account-new-email"
                  type="email"
                  value={newEmail}
                  onChange={event => setNewEmail(event.target.value)}
                  autoComplete="email"
                  disabled={isBusy}
                  required
                  className="min-h-12 w-full rounded-2xl border border-slate-700 bg-[#121418] px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                  placeholder="name@example.com"
                />
              </div>
              <PasswordField
                id="input-account-email-password"
                label="Current password"
                value={emailPassword}
                onChange={setEmailPassword}
                autoComplete="current-password"
                disabled={isBusy}
                inputRef={emailPasswordRef}
              />
            </div>

            {emailError && (
              <p role="alert" className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-rose-300">
                {emailError}
              </p>
            )}
            {emailStatus && (
              <p role="status" aria-live="polite" className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {emailStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white disabled:cursor-default disabled:opacity-60"
            >
              {busyForm === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <AtSign className="h-4 w-4" />}
              {busyForm === 'email' ? 'Verifying account...' : 'Send email confirmation'}
            </button>
          </form>

          <form
            onSubmit={handlePasswordSubmit}
            className="rounded-3xl border border-slate-800 bg-[#1a1d23] p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">Change password</h3>
                <p className="text-[10px] text-slate-500">Use at least 8 characters and keep it unique.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <PasswordField
                id="input-account-new-password"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                disabled={isBusy}
                minLength={8}
                inputRef={newPasswordRef}
              />
              <PasswordField
                id="input-account-confirm-password"
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                disabled={isBusy}
                minLength={8}
                inputRef={confirmPasswordRef}
              />
            </div>

            {passwordError && (
              <p role="alert" className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-rose-300">
                {passwordError}
              </p>
            )}
            {passwordStatus && (
              <p role="status" aria-live="polite" className="mt-3 flex items-start gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {passwordStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:cursor-default disabled:opacity-60"
            >
              {busyForm === 'password' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {busyForm === 'password' ? 'Updating password...' : 'Update password'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );

  return createPortal(sheet, document.body);
};
