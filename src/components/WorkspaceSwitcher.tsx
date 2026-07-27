import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Plus,
  UserPlus,
} from 'lucide-react';
import { WorkspaceSummary } from '../lib/tripRepository';

export interface WorkspaceSwitcherProps {
  workspaces: WorkspaceSummary[];
  currentMemberId: string | null;
  onSwitchWorkspace: (memberId: string) => void | Promise<void>;
  onCreateTrip: () => void;
  onJoinTrip: () => void;
  variant: 'drawer' | 'rail';
}

const getWorkspaceStatus = (workspace: WorkspaceSummary) => {
  if (workspace.trip_status && workspace.trip_status !== 'active') {
    return workspace.trip_status;
  }

  return workspace.status;
};

const getStatusLabel = (status: string) => {
  if (status === 'approved') return 'Active';
  if (status === 'closing') return 'Closing';
  if (status === 'closed') return 'Closed';
  if (status === 'pending') return 'Pending';
  if (status === 'rejected') return 'Rejected';
  if (status === 'removed') return 'Removed';
  return status;
};

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  currentMemberId,
  onSwitchWorkspace,
  onCreateTrip,
  onJoinTrip,
  variant,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [switchingMemberId, setSwitchingMemberId] = useState<string | null>(null);

  useEffect(() => {
    setIsExpanded(false);
    setSwitchingMemberId(null);
  }, [currentMemberId]);

  const orderedWorkspaces = useMemo(
    () => [
      ...workspaces.filter(workspace => workspace.member_id === currentMemberId),
      ...workspaces.filter(workspace => workspace.member_id !== currentMemberId),
    ],
    [currentMemberId, workspaces],
  );

  const isDrawer = variant === 'drawer';
  const hiddenWorkspaceCount = Math.max(orderedWorkspaces.length - 3, 0);
  const visibleWorkspaces = isDrawer && !isExpanded
    ? orderedWorkspaces.slice(0, 3)
    : orderedWorkspaces;
  const listId = isDrawer ? 'side-menu-group-list' : 'desktop-workspace-list';

  const handleSwitch = async (memberId: string) => {
    if (memberId === currentMemberId || switchingMemberId) return;

    setSwitchingMemberId(memberId);
    try {
      await onSwitchWorkspace(memberId);
    } finally {
      setSwitchingMemberId(null);
    }
  };

  if (isDrawer) {
    return (
      <section className="parite-card p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          Groups
        </p>

        <div id={listId} className="flex flex-col gap-2">
          {visibleWorkspaces.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-muted)]">
              Your groups will appear here.
            </p>
          ) : (
            visibleWorkspaces.map(workspace => {
              const isCurrent = workspace.member_id === currentMemberId;
              const isSwitching = switchingMemberId === workspace.member_id;
              const status = getWorkspaceStatus(workspace);

              return (
                <button
                  type="button"
                  key={workspace.member_id}
                  onClick={() => handleSwitch(workspace.member_id)}
                  disabled={isCurrent || switchingMemberId !== null}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                    isCurrent
                      ? 'border-[var(--color-positive)]/25 bg-[var(--color-positive-soft)]'
                      : 'cursor-pointer border-[var(--color-border)] bg-[var(--color-surface-soft)] hover:border-[var(--color-positive)]/25'
                  } disabled:cursor-default disabled:opacity-70`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="block truncate text-sm font-bold text-[var(--color-text)]">
                          {workspace.trip_name}
                        </span>
                        {isCurrent && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
                        )}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-[var(--color-muted)]">
                        {workspace.display_name} · {workspace.role}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[10px] font-bold text-[var(--color-positive)]">
                        {workspace.base_currency}
                      </span>
                      <span className="mt-1 flex items-center justify-end gap-1 text-[9px] uppercase text-[var(--color-muted)]">
                        {isSwitching && <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />}
                        {isSwitching ? 'Opening' : getStatusLabel(status)}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {hiddenWorkspaceCount > 0 && (
          <button
            type="button"
            id="btn-menu-toggle-groups"
            aria-expanded={isExpanded}
            aria-controls={listId}
            onClick={() => setIsExpanded(current => !current)}
            className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl text-xs font-bold text-[var(--color-positive)] hover:bg-[var(--color-positive-soft)]"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                Show fewer groups
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                Show {hiddenWorkspaceCount} more {hiddenWorkspaceCount === 1 ? 'group' : 'groups'}
              </>
            )}
          </button>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3">
          <button
            type="button"
            id="btn-menu-create-trip"
            onClick={onCreateTrip}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
          >
            <Plus className="h-4 w-4 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
            Create group
          </button>

          <button
            type="button"
            id="btn-menu-join-trip"
            onClick={onJoinTrip}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 py-2.5 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30"
          >
            <UserPlus className="h-4 w-4 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
            Join group
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-[var(--color-border)] px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-muted)]">
          Your groups
        </p>
        <span className="font-mono text-[10px] font-bold text-[var(--color-muted)]">
          {orderedWorkspaces.length}
        </span>
      </div>

      <div
        id={listId}
        className="no-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto"
        aria-label="Available groups"
      >
        {visibleWorkspaces.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
            Create or join a group to get started.
          </p>
        ) : (
          visibleWorkspaces.map(workspace => {
            const isCurrent = workspace.member_id === currentMemberId;
            const isSwitching = switchingMemberId === workspace.member_id;
            const status = getWorkspaceStatus(workspace);

            return (
              <button
                type="button"
                key={workspace.member_id}
                onClick={() => handleSwitch(workspace.member_id)}
                disabled={isCurrent || switchingMemberId !== null}
                aria-current={isCurrent ? 'true' : undefined}
                title={`${workspace.trip_name} · ${getStatusLabel(status)}`}
                className={`group flex min-h-11 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                  isCurrent
                    ? 'border-[var(--color-positive)]/20 bg-[var(--color-positive-soft)]'
                    : 'cursor-pointer border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]'
                } disabled:cursor-default`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold ${
                    isCurrent
                      ? 'bg-[var(--color-positive)] text-white'
                      : 'bg-[var(--color-surface-soft)] text-[var(--color-muted)] group-hover:text-[var(--color-text)]'
                  }`}
                  aria-hidden="true"
                >
                  {workspace.trip_name.trim().charAt(0).toUpperCase() || 'G'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-[var(--color-text)]">
                    {workspace.trip_name}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] uppercase tracking-wide text-[var(--color-muted)]">
                    {workspace.base_currency} · {getStatusLabel(status)}
                  </span>
                </span>
                {isSwitching ? (
                  <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-positive)]" aria-label="Opening group" />
                ) : isCurrent ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-positive)]" aria-label="Current group" />
                ) : null}
              </button>
            );
          })
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-[var(--color-border)] pt-2">
        <button
          type="button"
          id="btn-desktop-create-trip"
          onClick={onCreateTrip}
          className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] bg-white/70 px-2 text-[11px] font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30 hover:bg-[var(--color-positive-soft)]"
        >
          <Plus className="h-3.5 w-3.5 text-[var(--color-positive)]" aria-hidden="true" />
          Create
        </button>
        <button
          type="button"
          id="btn-desktop-join-trip"
          onClick={onJoinTrip}
          className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[var(--color-border)] bg-white/70 px-2 text-[11px] font-bold text-[var(--color-text)] hover:border-[var(--color-positive)]/30 hover:bg-[var(--color-positive-soft)]"
        >
          <UserPlus className="h-3.5 w-3.5 text-[var(--color-positive)]" aria-hidden="true" />
          Join
        </button>
      </div>
    </section>
  );
};
