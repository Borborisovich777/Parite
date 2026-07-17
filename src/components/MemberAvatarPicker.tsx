import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, RotateCcw, Smartphone, X } from 'lucide-react';
import { Member } from '../types';
import {
  AVATAR_COLOR_OPTIONS,
  AVATAR_ICON_OPTIONS,
  AvatarPreference,
  getAvatarColorOption,
  useMemberAvatarPreference,
} from '../lib/avatarPreferences';
import { MemberAvatar } from './MemberAvatar';

interface MemberAvatarPickerProps {
  isOpen: boolean;
  member: Member;
  onClose: () => void;
}

export const MemberAvatarPicker: React.FC<MemberAvatarPickerProps> = ({
  isOpen,
  member,
  onClose,
}) => {
  const {
    preference,
    defaultPreference,
    isCustomized,
    savePreference,
    resetPreference,
  } = useMemberAvatarPreference(member);
  const [draftPreference, setDraftPreference] = useState<AvatarPreference>(preference);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraftPreference(preference);
    setSaveError(null);
  }, [isOpen, preference]);

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
      const initialFocus = dialogRef.current?.querySelector<HTMLElement>('[data-avatar-autofocus]');
      (initialFocus ?? dialogRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const draftColor = getAvatarColorOption(draftPreference.color);
  const isDraftDefault = draftPreference.icon === defaultPreference.icon
    && draftPreference.color === defaultPreference.color;

  const handleSave = () => {
    const didSave = isDraftDefault
      ? resetPreference()
      : savePreference(draftPreference);
    if (!didSave) {
      setSaveError('This browser could not save the avatar. Check private browsing or storage settings.');
      return;
    }
    onClose();
  };

  const handleReset = () => {
    setDraftPreference(defaultPreference);
    setSaveError(null);
  };

  const picker = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/70 backdrop-blur-[3px]"
        onClick={onClose}
        aria-label="Close avatar picker"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
        tabIndex={-1}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[30px] border border-slate-800 bg-[#121418] shadow-2xl animate-slide-up md:rounded-[30px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar member={member} size="lg" preferenceOverride={draftPreference} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-300">
                Your look
              </p>
              <h2 id="avatar-picker-title" className="mt-1 truncate font-display text-lg font-bold text-white">
                Choose an avatar
              </h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">{member.display_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-avatar-autofocus
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-slate-800 bg-[#1a1d23] text-slate-400 hover:text-white"
            aria-label="Close avatar picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 no-scrollbar">
          <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
            <p className="text-[11px] leading-relaxed text-slate-300">
              Saved on this device only. Your group data and shared member profile stay unchanged.
            </p>
          </div>

          <fieldset className="mt-5">
            <legend className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Pick an icon
            </legend>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {AVATAR_ICON_OPTIONS.map(option => {
                const Icon = option.Icon;
                const isSelected = draftPreference.icon === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDraftPreference(current => ({ ...current, icon: option.id }))}
                    className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-2xl border transition-all ${
                      isSelected
                        ? 'scale-[1.03] border-white/50 shadow-lg'
                        : 'border-slate-800 bg-[#1a1d23] text-slate-400 hover:border-slate-700'
                    }`}
                    style={isSelected ? {
                      backgroundColor: draftColor.background,
                      color: draftColor.foreground,
                      borderColor: draftColor.ring,
                    } : undefined}
                    aria-label={option.label}
                    aria-pressed={isSelected}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.1} />
                    {isSelected && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-sm">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Pick a color
            </legend>
            <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8 sm:gap-2">
              {AVATAR_COLOR_OPTIONS.map(option => {
                const isSelected = draftPreference.color === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDraftPreference(current => ({ ...current, color: option.id }))}
                    className={`relative aspect-square cursor-pointer rounded-full border-2 transition-transform ${
                      isSelected ? 'scale-110' : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: option.background,
                      borderColor: isSelected ? option.foreground : option.ring,
                      boxShadow: isSelected ? `0 0 0 3px ${option.ring}55` : undefined,
                    }}
                    aria-label={option.label}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <Check
                        className="absolute inset-0 m-auto h-3.5 w-3.5"
                        style={{ color: option.foreground }}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {saveError && (
            <p className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-rose-300">
              {saveError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-3 border-t border-slate-800 bg-[#1a1d23] p-4">
          <button
            type="button"
            onClick={handleReset}
            className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-[#121418] px-4 text-xs font-bold text-slate-300 hover:border-slate-600"
          >
            <RotateCcw className="h-4 w-4" />
            {isCustomized ? 'Reset' : 'Suggested'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-12 cursor-pointer rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-slate-950 shadow-lg accent-glow"
          >
            Save on this device
          </button>
        </div>
      </section>
    </div>
  );

  return createPortal(picker, document.body);
};
