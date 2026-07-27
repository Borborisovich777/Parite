import React, { useEffect, useRef } from 'react';
import {
  Clock3,
  Gamepad2,
  KeyRound,
  LockKeyhole,
  LogOut,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Member, Trip } from '../types';
import type { WorkspaceSummary } from '../lib/tripRepository';
import { MemberAvatar } from './MemberAvatar';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface SideMenuProps {
  isOpen: boolean;
  trip: Trip;
  currentMember: Member | null;
  accountEmail: string | null;
  workspaces: WorkspaceSummary[];
  currentMemberId: string | null;
  onClose: () => void;
  onAccountSettings: () => void;
  onOpenWorkspaceSettings: () => void;
  onOpenCloseout: () => void;
  onReplayGuidedTour: () => void;
  onSwitchWorkspace: (memberId: string) => void | Promise<void>;
  onCreateTrip: () => void;
  onJoinTrip: () => void;
  onLogout: () => void | Promise<void>;
}

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  trip,
  currentMember,
  accountEmail,
  workspaces,
  currentMemberId,
  onClose,
  onAccountSettings,
  onOpenWorkspaceSettings,
  onOpenCloseout,
  onReplayGuidedTour,
  onSwitchWorkspace,
  onCreateTrip,
  onJoinTrip,
  onLogout,
}) => {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const tripStatus = trip.status ?? 'active';
  const isApprovedMember = currentMember?.status === 'approved';
  const closeoutCopy = tripStatus === 'closing'
    ? {
      title: 'Closeout in progress',
      description: 'Review final balances and member approvals.',
      action: 'Review',
      icon: Clock3,
    }
    : tripStatus === 'closed'
      ? {
        title: 'Closeout complete',
        description: 'View the final locked group status.',
        action: 'View',
        icon: LockKeyhole,
      }
      : {
        title: 'Group closeout',
        description: 'Review readiness before closing this group.',
        action: 'Open',
        icon: ShieldCheck,
      };
  const CloseoutIcon = closeoutCopy.icon;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll(focusableSelector),
      ) as HTMLElement[];
      const visibleFocusableElements = focusableElements.filter(element => (
        element.getClientRects().length > 0
        && window.getComputedStyle(element).visibility !== 'hidden'
      ));
      if (visibleFocusableElements.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = visibleFocusableElements[0];
      const last = visibleFocusableElements[visibleFocusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => restoreFocusRef.current?.focus());
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const runAndClose = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-start md:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-[#17211d]/45 backdrop-blur-[2px] cursor-default"
        aria-label="Close menu"
        onClick={onClose}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-menu-title"
        tabIndex={-1}
        className="relative z-10 flex h-full w-[90%] max-w-[380px] flex-col overflow-hidden rounded-r-[28px] border-r border-[var(--color-border)] bg-[var(--color-app-background)] shadow-[var(--shadow-sheet)] animate-slide-up md:w-[420px] md:max-w-[420px] md:rounded-[28px] md:border"
      >
        <div className="app-header-safe header-wash flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 pb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              Current group
            </p>
            <h2
              id="side-menu-title"
              className="mt-1 truncate font-display text-xl font-bold text-[var(--color-text)]"
            >
              {trip.name}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              <span className="font-mono font-bold text-[var(--color-positive)]">{trip.base_currency}</span>
              <span aria-hidden="true"> · </span>
              <span className="capitalize">{tripStatus}</span>
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-[var(--color-text)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-positive)]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4">
          <section className="parite-card shrink-0 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Signed in as
            </p>
            <div className="flex items-center gap-3">
              <MemberAvatar member={currentMember} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--color-text)]">
                  {currentMember?.display_name ?? 'No group member'}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase text-[var(--color-muted)]">
                  <span>{currentMember?.status ?? 'not joined'}</span>
                  {currentMember?.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 text-[var(--color-positive)]">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Admin
                    </span>
                  )}
                </div>
                {accountEmail && (
                  <p className="mt-1 truncate text-[10px] text-[var(--color-muted)]">{accountEmail}</p>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                id="btn-menu-account-security"
                onClick={() => runAndClose(onAccountSettings)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
              >
                <span className="inline-flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
                  Account & security
                </span>
                <span className="text-[10px] font-bold text-[var(--color-positive)]">Manage</span>
              </button>

              {isApprovedMember && (
                <button
                  type="button"
                  id="btn-menu-workspace-settings"
                  onClick={() => runAndClose(onOpenWorkspaceSettings)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
                >
                  <span className="inline-flex items-center gap-2">
                    <Settings className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
                    Group settings
                  </span>
                  <span className="text-[10px] font-bold text-[var(--color-positive)]">Open</span>
                </button>
              )}

              {isApprovedMember && tripStatus === 'active' && (
                <button
                  type="button"
                  id="btn-menu-guided-tour"
                  onClick={() => runAndClose(onReplayGuidedTour)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-left text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
                >
                  <span className="inline-flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-[var(--color-positive)]" aria-hidden="true" />
                    Guided tour
                  </span>
                  <span className="text-[10px] font-bold text-[var(--color-positive)]">Replay</span>
                </button>
              )}
            </div>
          </section>

          <WorkspaceSwitcher
            variant="drawer"
            workspaces={workspaces}
            currentMemberId={currentMemberId}
            onSwitchWorkspace={onSwitchWorkspace}
            onCreateTrip={onCreateTrip}
            onJoinTrip={onJoinTrip}
          />

          {isApprovedMember && (
            <button
              type="button"
              id="btn-menu-closeout"
              aria-haspopup="dialog"
              onClick={() => runAndClose(onOpenCloseout)}
              className="parite-card group flex min-h-20 w-full shrink-0 cursor-pointer items-center gap-3 border-[var(--color-negative)]/15 px-4 py-3.5 text-left hover:border-[var(--color-negative)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-positive)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-negative-soft)] text-[var(--color-negative)]">
                <CloseoutIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[var(--color-text)]">
                  {closeoutCopy.title}
                </span>
                <span className="mt-1 block text-[10px] leading-relaxed text-[var(--color-muted)]">
                  {closeoutCopy.description}
                </span>
              </span>
              <span className="shrink-0 text-[10px] font-bold text-[var(--color-negative)]">
                {closeoutCopy.action}
              </span>
            </button>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--color-border)] bg-white/80 p-3 backdrop-blur-xl">
          <button
            type="button"
            id="btn-menu-logout"
            onClick={() => void onLogout()}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold text-[var(--color-negative)] hover:bg-[var(--color-negative-soft)]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>
    </div>
  );
};
