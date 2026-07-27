import React, { useId, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  RotateCcw,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Member, Trip, TripClosureVote } from '../types';
import { MemberAvatar } from './MemberAvatar';

export type CloseoutBusyAction = 'start' | 'approve' | 'cancel' | 'review';

export interface CloseoutProgressCardProps {
  trip: Trip;
  members: Member[];
  closureVotes: TripClosureVote[];
  currentMember: Member | null;
  blockers?: readonly string[];
  busyAction?: CloseoutBusyAction | null;
  isReadOnly?: boolean;
  className?: string;
  idPrefix?: string;
  onStartTripClosure?: () => void | Promise<void>;
  onApproveTripClosure?: () => void | Promise<void>;
  onCancelTripClosure?: () => void | Promise<void>;
  onReviewBalances?: () => void | Promise<void>;
}

const statusCopy = {
  active: {
    eyebrow: 'Group closeout',
    title: 'Ready to wrap up?',
    description: 'Settle every balance, then collect approval from every active member.',
    badge: 'Not started',
  },
  closing: {
    eyebrow: 'Closeout in progress',
    title: 'Waiting for everyone',
    description: 'Review the final balances, then approve closing the group when you are ready.',
    badge: 'Closing',
  },
  closed: {
    eyebrow: 'Closeout complete',
    title: 'Group records are locked',
    description: 'Everyone approved closing the group. This group is now read-only.',
    badge: 'Closed',
  },
} as const;

const formatClosedDate = (value?: string) => {
  if (!value) return null;

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const CloseoutProgressCard: React.FC<CloseoutProgressCardProps> = ({
  trip,
  members,
  closureVotes,
  currentMember,
  blockers = [],
  busyAction = null,
  isReadOnly = false,
  className = '',
  idPrefix = 'btn-closeout',
  onStartTripClosure,
  onApproveTripClosure,
  onCancelTripClosure,
  onReviewBalances,
}) => {
  const headingId = useId();
  const progressDescriptionId = useId();
  const tripStatus = trip.status ?? 'active';
  const copy = statusCopy[tripStatus];

  const approvedMembers = useMemo(
    () => members.filter(member => (
      member.trip_id === trip.id
      && member.status === 'approved'
    )),
    [members, trip.id],
  );
  const approvedMemberIds = useMemo(
    () => new Set(approvedMembers.map(member => member.id)),
    [approvedMembers],
  );
  const approvingMemberIds = useMemo(
    () => new Set(
      closureVotes
        .filter(vote => vote.trip_id === trip.id && approvedMemberIds.has(vote.member_id))
        .map(vote => vote.member_id),
    ),
    [approvedMemberIds, closureVotes, trip.id],
  );
  const outstandingMembers = useMemo(
    () => approvedMembers.filter(member => !approvingMemberIds.has(member.id)),
    [approvedMembers, approvingMemberIds],
  );
  const visibleBlockers = useMemo(
    () => blockers.map(blocker => blocker.trim()).filter(Boolean),
    [blockers],
  );

  const approvalCount = approvingMemberIds.size;
  const memberCount = approvedMembers.length;
  const progressMaximum = Math.max(memberCount, 1);
  const progressPercent = memberCount > 0
    ? Math.min(100, Math.round((approvalCount / memberCount) * 100))
    : 0;
  const currentMemberIsApproved = Boolean(
    currentMember
    && currentMember.trip_id === trip.id
    && currentMember.status === 'approved',
  );
  const currentMemberHasApproved = Boolean(
    currentMemberIsApproved
    && currentMember
    && approvingMemberIds.has(currentMember.id),
  );
  const isAdmin = currentMemberIsApproved && currentMember?.role === 'admin';
  const isFinalApprover = Boolean(
    tripStatus === 'closing'
    && currentMember
    && !currentMemberHasApproved
    && outstandingMembers.length === 1
    && outstandingMembers[0]?.id === currentMember.id,
  );
  const hasExplicitBlockers = visibleBlockers.length > 0;
  const isBusy = busyAction !== null;
  const lifecycleActionsDisabled = isReadOnly || isBusy;
  const closedDate = formatClosedDate(trip.closed_at);

  const statusTone = tripStatus === 'closed'
    ? 'border-[var(--color-negative)]/20 bg-[var(--color-negative-soft)] text-[var(--color-negative)]'
    : tripStatus === 'closing'
      ? 'border-[var(--color-positive)]/20 bg-[var(--color-blue-wash)] text-[var(--color-positive)]'
      : 'border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-muted)]';

  const handleAction = (action?: () => void | Promise<void>) => {
    if (!action) return;
    void action();
  };

  return (
    <section
      className={`parite-card shrink-0 overflow-hidden ${className}`}
      aria-labelledby={headingId}
      aria-busy={isBusy}
    >
      <div className="header-wash border-b border-[var(--color-border)] px-4 py-4 md:px-5 md:py-5">
        <div className="flex flex-col items-start gap-3 min-[380px]:flex-row min-[380px]:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-positive)]">
              {copy.eyebrow}
            </p>
            <h3
              id={headingId}
              className="mt-1 font-display text-lg font-bold text-[var(--color-text)]"
            >
              {copy.title}
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--color-muted)]">
              {copy.description}
            </p>
          </div>
          <span
            className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${statusTone}`}
          >
            {tripStatus === 'closed' ? (
              <LockKeyhole className="h-3.5 w-3.5" />
            ) : tripStatus === 'closing' ? (
              <Clock3 className="h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {copy.badge}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div aria-describedby={progressDescriptionId}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                Approvals received
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--color-text)]">
                {approvalCount}
                <span className="text-sm text-[var(--color-muted)]"> / {memberCount}</span>
              </p>
            </div>
            <p className="text-right text-[10px] font-semibold text-[var(--color-muted)]">
              {tripStatus === 'active'
                ? `${memberCount} approved ${memberCount === 1 ? 'member' : 'members'}`
                : tripStatus === 'closed'
                  ? closedDate
                    ? `Closed ${closedDate}`
                    : 'All records finalized'
                  : `${outstandingMembers.length} still needed`}
            </p>
          </div>

          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-soft)]"
            role="progressbar"
            aria-label="Group closeout approvals"
            aria-valuemin={0}
            aria-valuemax={progressMaximum}
            aria-valuenow={Math.min(approvalCount, progressMaximum)}
            aria-valuetext={`${approvalCount} of ${memberCount} member approvals received`}
          >
            <div
              className="h-full rounded-full bg-[var(--color-positive)] transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p id={progressDescriptionId} className="sr-only">
            Every approved member must approve before the group can close.
          </p>
        </div>

        {tripStatus === 'closing' && currentMemberIsApproved && (
          <div
            className={`flex items-start gap-3 rounded-2xl border px-3 py-3 ${
              currentMemberHasApproved
                ? 'border-[var(--color-positive)]/15 bg-[var(--color-positive-soft)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-soft)]'
            }`}
            role="status"
            aria-live="polite"
          >
            {currentMemberHasApproved ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-positive)]" />
            ) : (
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-positive)]" />
            )}
            <div>
              <p className="text-xs font-bold text-[var(--color-text)]">
                {currentMemberHasApproved ? 'You approved this closeout' : 'Your approval is needed'}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                {currentMemberHasApproved
                  ? 'We will keep this group open for review until every remaining member approves.'
                  : isFinalApprover
                    ? 'You are the final approver. Approving now will immediately lock the group.'
                    : 'Review the final balances before approving closing the group.'}
              </p>
            </div>
          </div>
        )}

        {tripStatus === 'closing' && outstandingMembers.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">
                Waiting for approval
              </p>
              <span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-[var(--color-surface-soft)] px-2 font-mono text-[10px] font-bold text-[var(--color-text)]">
                {outstandingMembers.length}
              </span>
            </div>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {outstandingMembers.map(member => (
                <li
                  key={member.id}
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2"
                >
                  <MemberAvatar member={member} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[var(--color-text)]">
                      {member.id === currentMember?.id ? 'You' : member.display_name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-[var(--color-muted)]">
                      Approval pending
                    </span>
                  </span>
                  <Clock3 className="h-4 w-4 shrink-0 text-[var(--color-muted)]" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasExplicitBlockers && (
          <div
            className="rounded-2xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 py-3"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-negative)]" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--color-negative)]">
                  Resolve before closing
                </p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[var(--color-muted)]">
                  {visibleBlockers.map((blocker, index) => (
                    <li key={`${blocker}-${index}`}>{blocker}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {tripStatus !== 'closed' && (
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-3">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-negative)]" />
            <div>
              <p className="text-xs font-bold text-[var(--color-text)]">
                Final approval completes closeout
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                Once the final member approves, the group closes and any remaining settlement actions stop.
              </p>
            </div>
          </div>
        )}

        {tripStatus === 'closed' && (
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-positive)]/15 bg-[var(--color-positive-soft)] px-3 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-positive)]" />
            <div>
              <p className="text-xs font-bold text-[var(--color-text)]">Closeout complete</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">
                The final balances and activity stay available to view, but the group can no longer be changed.
              </p>
            </div>
          </div>
        )}

        {isReadOnly && tripStatus !== 'closed' && (
          <p className="text-xs font-semibold text-[var(--color-muted)]" role="status">
            Closeout actions are unavailable in read-only mode.
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {tripStatus === 'active' && hasExplicitBlockers && onReviewBalances && (
            <button
              type="button"
              id={`${idPrefix}-review-blockers`}
              onClick={() => handleAction(onReviewBalances)}
              disabled={isBusy}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-positive)] px-4 text-xs font-bold text-[#fff] disabled:cursor-not-allowed sm:col-span-2"
            >
              <Scale className="h-4 w-4" />
              {busyAction === 'review' ? 'Opening balances...' : 'Review balances'}
            </button>
          )}

          {tripStatus === 'active' && isAdmin && !hasExplicitBlockers && onStartTripClosure && (
            <button
              type="button"
              id={`${idPrefix}-start`}
              onClick={() => handleAction(onStartTripClosure)}
              disabled={lifecycleActionsDisabled}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-positive)] px-4 text-xs font-bold text-[#fff] disabled:cursor-not-allowed sm:col-span-2"
            >
              <ShieldCheck className="h-4 w-4" />
              {busyAction === 'start' ? 'Starting closeout...' : 'Start closeout'}
            </button>
          )}

          {tripStatus === 'active' && !isAdmin && (
            <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 text-xs text-[var(--color-muted)] sm:col-span-2">
              <Users className="h-4 w-4 shrink-0 text-[var(--color-positive)]" />
              A group admin can start closeout once every balance is settled.
            </div>
          )}

          {tripStatus === 'closing'
            && currentMemberIsApproved
            && !currentMemberHasApproved
            && !hasExplicitBlockers
            && onApproveTripClosure && (
              <button
                type="button"
                id={`${idPrefix}-approve`}
                onClick={() => handleAction(onApproveTripClosure)}
                disabled={lifecycleActionsDisabled}
                className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-positive)] px-4 text-xs font-bold text-[#fff] disabled:cursor-not-allowed"
              >
                {isFinalApprover ? <LockKeyhole className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {busyAction === 'approve'
                  ? 'Approving closeout...'
                  : isFinalApprover
                    ? 'Approve and lock group'
                    : 'Approve closeout'}
              </button>
            )}

          {tripStatus === 'closing' && hasExplicitBlockers && onReviewBalances && (
            <button
              type="button"
              id={`${idPrefix}-review-blockers`}
              onClick={() => handleAction(onReviewBalances)}
              disabled={isBusy}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--color-positive)] px-4 text-xs font-bold text-[#fff] disabled:cursor-not-allowed"
            >
              <Scale className="h-4 w-4" />
              {busyAction === 'review' ? 'Opening balances...' : 'Review blockers'}
            </button>
          )}

          {tripStatus === 'closing' && isAdmin && onCancelTripClosure && (
            <button
              type="button"
              id={`${idPrefix}-cancel`}
              onClick={() => handleAction(onCancelTripClosure)}
              disabled={lifecycleActionsDisabled}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-xs font-bold text-[var(--color-text)] disabled:cursor-not-allowed"
            >
              <RotateCcw className="h-4 w-4 text-[var(--color-negative)]" />
              {busyAction === 'cancel' ? 'Cancelling closeout...' : 'Cancel closeout'}
            </button>
          )}

          {tripStatus === 'closed' && onReviewBalances && (
            <button
              type="button"
              id={`${idPrefix}-view-balances`}
              onClick={() => handleAction(onReviewBalances)}
              disabled={isBusy}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-4 text-xs font-bold text-[var(--color-text)] disabled:cursor-not-allowed sm:col-span-2"
            >
              <Scale className="h-4 w-4 text-[var(--color-positive)]" />
              {busyAction === 'review' ? 'Opening balances...' : 'View final balances'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
