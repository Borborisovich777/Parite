import React from 'react';
import {
  Clock3,
  Gamepad2,
  House,
  LockKeyhole,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { WorkspaceSummary } from '../lib/tripRepository';
import { Member, Trip } from '../types';
import { TabType } from './BottomNav';
import { MemberAvatar } from './MemberAvatar';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

export interface DesktopWorkspaceRailProps {
  trip: Trip;
  currentMember: Member | null;
  workspaces: WorkspaceSummary[];
  currentMemberId: string | null;
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingRequestsCount: number;
  showAdminBadge: boolean;
  onSwitchWorkspace: (memberId: string) => void | Promise<void>;
  onCreateTrip: () => void;
  onJoinTrip: () => void;
  onOpenSettings: () => void;
  onOpenCloseout: () => void;
  onAccountSettings: () => void;
  onReplayGuidedTour: () => void;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: House },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'balances', label: 'Balances', icon: Scale },
  { id: 'members', label: 'Members', icon: Users },
] as const;

const getTripStatusLabel = (trip: Trip) => {
  const status = trip.status ?? 'active';
  if (status === 'closing') return 'Closeout';
  if (status === 'closed') return 'Closed';
  return 'Active';
};

export const DesktopWorkspaceRail: React.FC<DesktopWorkspaceRailProps> = ({
  trip,
  currentMember,
  workspaces,
  currentMemberId,
  activeTab,
  onChangeTab,
  pendingRequestsCount,
  showAdminBadge,
  onSwitchWorkspace,
  onCreateTrip,
  onJoinTrip,
  onOpenSettings,
  onOpenCloseout,
  onAccountSettings,
  onReplayGuidedTour,
}) => {
  const tripStatus = trip.status ?? 'active';
  const safePendingCount = Math.max(0, pendingRequestsCount);
  const closeoutCopy = tripStatus === 'closing'
    ? {
      title: 'Closeout in progress',
      description: 'Review approvals',
      icon: Clock3,
    }
    : tripStatus === 'closed'
      ? {
        title: 'Closeout complete',
        description: 'View final status',
        icon: LockKeyhole,
      }
      : {
        title: 'Group closeout',
        description: 'Review readiness',
        icon: ShieldCheck,
      };
  const CloseoutIcon = closeoutCopy.icon;

  return (
    <aside
      className="hidden h-full w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-white/80 backdrop-blur-xl lg:flex"
      aria-label="Workspace navigation"
    >
      <div className="border-b border-[var(--color-border)] px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
              Current group
            </p>
            <h2 className="mt-1 truncate font-display text-lg font-bold tracking-tight text-[var(--color-text)]">
              {trip.name}
            </h2>
          </div>
          <span
            className={`mt-0.5 inline-flex shrink-0 rounded-full border px-2 py-1 font-mono text-[9px] font-bold uppercase ${
              tripStatus === 'active'
                ? 'border-[var(--color-positive)]/20 bg-[var(--color-positive-soft)] text-[var(--color-positive)]'
                : tripStatus === 'closing'
                  ? 'border-amber-500/20 bg-amber-50 text-amber-700'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-muted)]'
            }`}
          >
            {getTripStatusLabel(trip)}
          </span>
        </div>
        <p className="mt-2 text-[10px] text-[var(--color-muted)]">
          Base currency{' '}
          <span className="font-mono font-bold text-[var(--color-positive)]">
            {trip.base_currency}
          </span>
        </p>
      </div>

      <nav className="space-y-1 px-3 py-3" aria-label="Group sections">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badgeCount = tab.id === 'members' && showAdminBadge ? safePendingCount : 0;

          return (
            <button
              type="button"
              key={tab.id}
              id={`nav-tab-${tab.id}-rail`}
              onClick={() => onChangeTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 text-left text-sm font-bold transition-colors ${
                isActive
                  ? 'border-[var(--color-positive)]/20 bg-[var(--color-positive-soft)] text-[var(--color-positive)]'
                  : 'border-transparent text-[var(--color-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  isActive ? 'bg-white/80 shadow-sm' : 'bg-transparent'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate">{tab.label}</span>
              {badgeCount > 0 && (
                <span
                  className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-negative)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white"
                  aria-label={`${badgeCount} pending ${badgeCount === 1 ? 'request' : 'requests'}`}
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <WorkspaceSwitcher
        variant="rail"
        workspaces={workspaces}
        currentMemberId={currentMemberId}
        onSwitchWorkspace={onSwitchWorkspace}
        onCreateTrip={onCreateTrip}
        onJoinTrip={onJoinTrip}
      />

      <div className="shrink-0 px-3 pb-3">
        <button
          type="button"
          id="btn-desktop-closeout"
          aria-haspopup="dialog"
          onClick={onOpenCloseout}
          className="flex min-h-14 w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 py-2.5 text-left hover:border-[var(--color-negative)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-positive)]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/75 text-[var(--color-negative)]">
            <CloseoutIcon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-[var(--color-text)]">
              {closeoutCopy.title}
            </span>
            <span className="mt-0.5 block truncate text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
              {closeoutCopy.description}
            </span>
          </span>
        </button>
      </div>

      <div className="space-y-1.5 border-t border-[var(--color-border)] p-3">
        <button
          type="button"
          id="btn-desktop-group-settings"
          onClick={onOpenSettings}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-bold text-[var(--color-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
        >
          <Settings className="h-[18px] w-[18px] text-[var(--color-positive)]" aria-hidden="true" />
          Group settings
        </button>

        {(trip.status ?? 'active') === 'active' && (
          <button
            type="button"
            id="btn-desktop-guided-tour"
            onClick={onReplayGuidedTour}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 text-sm font-bold text-[var(--color-muted)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
          >
            <Gamepad2 className="h-[18px] w-[18px] text-[var(--color-positive)]" aria-hidden="true" />
            Guided tour
          </button>
        )}

        <button
          type="button"
          id="btn-desktop-account-settings"
          onClick={onAccountSettings}
          aria-label={`Open account settings${currentMember?.display_name ? ` for ${currentMember.display_name}` : ''}`}
          className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2.5 py-2 text-left hover:border-[var(--color-positive)]/30"
        >
          <MemberAvatar member={currentMember} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-[var(--color-text)]">
              {currentMember?.display_name ?? 'Account settings'}
            </span>
            <span className="mt-0.5 flex items-center gap-1 truncate text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
              {currentMember?.role === 'admin' && (
                <ShieldCheck className="h-3 w-3 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
              )}
              {currentMember?.role ?? 'No active member'}
            </span>
          </span>
          <Settings className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted)]" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
