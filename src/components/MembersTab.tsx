import React, { useEffect, useState } from 'react';
import { AccountAccess, Trip, Member } from '../types';
import { Clock, Pencil, RefreshCw, Shield, ShieldCheck, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { buildInviteUrl } from '../lib/inviteLinks';
import { InviteShareCard } from './InviteShareCard';
import { MemberAvatar } from './MemberAvatar';
import { MemberAvatarPicker } from './MemberAvatarPicker';

type MemberCategory = 'approved' | 'requests' | 'removed';
type BusyMemberAction = 'approve' | 'reject' | 'remove' | 'promote' | 'demote';

interface MembersTabProps {
  trip: Trip;
  currentMember: Member;
  members: Member[];
  accountRequests?: AccountAccess[];
  accountRequestsError?: string | null;
  isPlatformAdmin?: boolean;
  busyAccountUserId?: string | null;
  busyAccountDecision?: 'approve' | 'reject' | null;
  isRefreshing?: boolean;
  initialCategory?: MemberCategory;
  onApproveMember: (memberId: string) => void | Promise<void>;
  onRejectMember: (memberId: string) => void | Promise<void>;
  onRemoveMember: (memberId: string) => void | Promise<void>;
  onPromoteMember: (memberId: string) => void | Promise<void>;
  onDemoteAdmin: (memberId: string) => void | Promise<void>;
  onViewMemberSpending: (memberId: string) => void;
  onApproveAccount?: (userId: string) => void | Promise<void>;
  onRejectAccount?: (userId: string) => void | Promise<void>;
  onRegenerateInviteCode?: () => Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  trip,
  currentMember,
  members,
  accountRequests = [],
  accountRequestsError = null,
  isPlatformAdmin = false,
  busyAccountUserId = null,
  busyAccountDecision = null,
  isRefreshing = false,
  initialCategory = 'approved',
  onApproveMember,
  onRejectMember,
  onRemoveMember,
  onPromoteMember,
  onDemoteAdmin,
  onViewMemberSpending,
  onApproveAccount,
  onRejectAccount,
  onRegenerateInviteCode,
  onRefresh,
}) => {
  const [activeCategory, setActiveCategory] = useState<MemberCategory>(initialCategory);
  const [busyMemberAction, setBusyMemberAction] = useState<{ memberId: string; action: BusyMemberAction } | null>(null);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const isAdmin = currentMember.role === 'admin';
  const canManageRequests = isAdmin || isPlatformAdmin;
  const isTripActive = (trip.status ?? 'active') === 'active';
  const approvedMembers = members.filter(member => member.status === 'approved');
  const pendingRequests = members.filter(member => member.status === 'pending');
  const otherMembers = members.filter(member => member.status === 'removed' || member.status === 'rejected');
  const pendingRequestCount = (isAdmin ? pendingRequests.length : 0)
    + (isPlatformAdmin ? accountRequests.length : 0);

  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  const runMemberAction = async (memberId: string, actionType: BusyMemberAction, action: () => void | Promise<void>) => {
    setBusyMemberAction({ memberId, action: actionType });
    try {
      await action();
    } catch (error) {
      console.error(error);
    } finally {
      setBusyMemberAction(null);
    }
  };

  const isMemberBusy = (memberId: string) => busyMemberAction?.memberId === memberId;

  return (
    <div className={`flex flex-col gap-5 px-4 pb-24 pt-5 md:px-6 md:pb-6 lg:px-8 ${isAvatarPickerOpen ? '' : 'animate-fade-in'}`}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-positive)]">
            {trip.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold font-display text-[var(--color-text)] tracking-tight">
            Members
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
            {approvedMembers.length} {approvedMembers.length === 1 ? 'person is' : 'people are'} sharing this group
            {canManageRequests && pendingRequestCount > 0
              ? ` · ${pendingRequestCount} waiting for approval`
              : '.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              id="btn-refresh-members"
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-positive)] shadow-sm disabled:opacity-60"
              aria-label={isRefreshing ? 'Refreshing members' : 'Refresh members'}
              title={isRefreshing ? 'Refreshing members' : 'Refresh members'}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <span className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-[10px] font-bold text-[var(--color-positive)] shadow-sm">
            {approvedMembers.length} active
          </span>
        </div>
      </div>

      {isAdmin && isTripActive && (
        <InviteShareCard
          groupName={trip.name}
          inviteCode={trip.invite_code}
          inviteUrl={buildInviteUrl(trip.invite_code, window.location.href)}
          onRegenerateInviteCode={onRegenerateInviteCode}
        />
      )}

      {canManageRequests && (
        <div
          className={`grid shrink-0 gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-1 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}
          role="tablist"
          aria-label="Member categories"
        >
          <button
            type="button"
            id="members-approved-tab"
            role="tab"
            aria-selected={activeCategory === 'approved'}
            aria-controls="members-approved-panel"
            onClick={() => setActiveCategory('approved')}
            className={`min-h-10 rounded-xl px-1 text-[10px] font-bold transition-all cursor-pointer ${
              activeCategory === 'approved'
                ? 'bg-white text-[var(--color-positive)] shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Active ({approvedMembers.length})
          </button>

          <button
            type="button"
            id="btn-requests-filter"
            role="tab"
            aria-selected={activeCategory === 'requests'}
            aria-controls="members-requests-panel"
            onClick={() => setActiveCategory('requests')}
            className={`relative min-h-10 rounded-xl px-1 text-[10px] font-bold transition-all cursor-pointer ${
              activeCategory === 'requests'
                ? 'bg-white text-[var(--color-positive)] shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Requests
            {pendingRequestCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-negative)] px-1 text-[8px] font-bold text-[#fff]">
                {pendingRequestCount}
              </span>
            )}
          </button>

          {isAdmin && (
            <button
              type="button"
              id="members-inactive-tab"
              role="tab"
              aria-selected={activeCategory === 'removed'}
              aria-controls="members-inactive-panel"
              onClick={() => setActiveCategory('removed')}
              className={`min-h-10 rounded-xl px-1 text-[10px] font-bold transition-all cursor-pointer ${
                activeCategory === 'removed'
                  ? 'bg-white text-[var(--color-positive)] shadow-sm'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              Inactive ({otherMembers.length})
            </button>
          )}
        </div>
      )}

      {isPlatformAdmin && accountRequestsError && (
        <div
          className="flex items-start gap-2 rounded-2xl border border-[var(--color-negative)]/20 bg-[var(--color-negative-soft)] px-3 py-2.5 text-xs text-[var(--color-negative)]"
          role="alert"
        >
          <UserX className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">Account requests could not be refreshed</p>
            <p className="mt-0.5 leading-relaxed opacity-80">{accountRequestsError} Use the refresh button to try again.</p>
          </div>
        </div>
      )}

      {(!canManageRequests || activeCategory === 'approved') && (
        <section
          id={canManageRequests ? 'members-approved-panel' : undefined}
          role={canManageRequests ? 'tabpanel' : undefined}
          aria-labelledby={canManageRequests ? 'members-approved-tab' : undefined}
          className="grid gap-3 lg:grid-cols-2"
        >
          {approvedMembers.map(member => {
            const isCurrentUser = member.id === currentMember.id;

            return (
              <div
                key={member.id}
                id={`member-row-${member.id}`}
                className="parite-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {isCurrentUser ? (
                    <button
                      type="button"
                      onClick={() => setIsAvatarPickerOpen(true)}
                      className="group relative shrink-0 cursor-pointer rounded-2xl transition-transform active:scale-95"
                      aria-label="Customize your avatar"
                      title="Customize your avatar"
                    >
                      <MemberAvatar member={member} size="md" />
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--color-positive)] text-[#fff] shadow-sm">
                        <Pencil className="h-2.5 w-2.5" strokeWidth={2.6} />
                      </span>
                    </button>
                  ) : (
                    <MemberAvatar member={member} size="md" />
                  )}
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-bold leading-tight text-[var(--color-text)]">
                      {member.display_name}{isCurrentUser ? ' (You)' : ''}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--color-muted)]">
                      {member.role === 'admin' && <Shield className="h-3 w-3 text-[var(--color-positive)]" />}
                      {member.role === 'admin' ? 'Group admin' : 'Member'} · Active
                    </span>
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <button
                    type="button"
                    id={`btn-view-spending-${member.id}`}
                    onClick={() => onViewMemberSpending(member.id)}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-[10px] font-bold text-[var(--color-positive)] cursor-pointer sm:flex-none"
                  >
                    View spending
                  </button>

                  {isAdmin && isTripActive && !isCurrentUser && (
                    member.role === 'admin' ? (
                      <button
                        type="button"
                        id={`btn-demote-admin-${member.id}`}
                        onClick={() => {
                          if (confirm(`Remove admin permissions from ${member.display_name}? They will stay in the group as a member.`)) {
                            runMemberAction(member.id, 'demote', () => onDemoteAdmin(member.id));
                          }
                        }}
                        disabled={isMemberBusy(member.id)}
                        className="min-w-0 flex-1 rounded-xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 py-2.5 text-[10px] font-bold text-[var(--color-negative)] transition-colors cursor-pointer sm:flex-none"
                        title="Remove admin"
                      >
                        {busyMemberAction?.memberId === member.id && busyMemberAction.action === 'demote' ? 'Removing admin...' : 'Remove admin'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        id={`btn-promote-member-${member.id}`}
                        onClick={() => runMemberAction(member.id, 'promote', () => onPromoteMember(member.id))}
                        disabled={isMemberBusy(member.id)}
                        className="min-w-0 flex-1 rounded-xl border border-[var(--color-positive)]/15 bg-[var(--color-positive-soft)] px-3 py-2.5 text-[10px] font-bold text-[var(--color-positive)] transition-colors cursor-pointer sm:flex-none"
                        title="Make admin"
                      >
                        {busyMemberAction?.memberId === member.id && busyMemberAction.action === 'promote' ? 'Making admin...' : 'Make admin'}
                      </button>
                    )
                  )}

                  {isAdmin && isTripActive && !isCurrentUser && (
                    <button
                      type="button"
                      id={`btn-remove-member-${member.id}`}
                      onClick={() => {
                        if (confirm(`Remove ${member.display_name}? Historical expenses paid or split by them remain intact.`)) {
                          runMemberAction(member.id, 'remove', () => onRemoveMember(member.id));
                        }
                      }}
                      disabled={isMemberBusy(member.id)}
                      className="rounded-xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] p-2.5 text-[var(--color-negative)] transition-colors cursor-pointer"
                      title={busyMemberAction?.memberId === member.id && busyMemberAction.action === 'remove' ? 'Removing member...' : 'Remove member'}
                      aria-label={busyMemberAction?.memberId === member.id && busyMemberAction.action === 'remove' ? 'Removing member' : 'Remove member'}
                    >
                      {busyMemberAction?.memberId === member.id && busyMemberAction.action === 'remove' ? (
                        <span className="text-[10px] font-bold">Removing...</span>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {canManageRequests && activeCategory === 'requests' && (
        <section
          id="members-requests-panel"
          role="tabpanel"
          aria-labelledby="btn-requests-filter"
          className="flex flex-col gap-4"
        >
          {pendingRequestCount === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-white px-4 py-12 text-center text-[var(--color-muted)] lg:col-span-2">
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
                <Clock className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)]">No pending requests</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">New accounts and group join requests will appear here automatically.</p>
            </div>
          ) : null}

          {isPlatformAdmin && accountRequests.length > 0 && (
            <section aria-labelledby="account-request-heading">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h2 id="account-request-heading" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
                    <ShieldCheck className="h-4 w-4 text-[var(--color-positive)]" />
                    New account requests
                  </h2>
                  <p className="mt-1 text-[10px] text-[var(--color-muted)]">Approve an account before it can join any group.</p>
                </div>
                <span className="rounded-full bg-[var(--color-positive-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-positive)]">
                  {accountRequests.length}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {accountRequests.map(request => {
                  const isBusy = busyAccountUserId === request.user_id;
                  return (
                    <div key={request.user_id} id={`account-request-${request.user_id}`} className="parite-card flex flex-col gap-3 p-3.5">
                      <div className="min-w-0">
                        <p className="break-all text-sm font-bold text-[var(--color-text)]">{request.email}</p>
                        <p className="mt-1 flex items-center gap-1 text-[10px] font-mono text-[var(--color-muted)]">
                          <Clock className="h-3 w-3" />
                          Requested {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          id={`btn-reject-account-${request.user_id}`}
                          onClick={() => onRejectAccount?.(request.user_id)}
                          disabled={Boolean(busyAccountUserId) || !onRejectAccount}
                          className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] px-3 text-xs font-bold text-[var(--color-negative)] disabled:opacity-60"
                        >
                          <UserX className="h-4 w-4" />
                          {isBusy && busyAccountDecision === 'reject' ? 'Working...' : 'Reject'}
                        </button>
                        <button
                          type="button"
                          id={`btn-approve-account-${request.user_id}`}
                          onClick={() => onApproveAccount?.(request.user_id)}
                          disabled={Boolean(busyAccountUserId) || !onApproveAccount}
                          className="flex min-h-10 cursor-pointer items-center justify-center gap-1 rounded-xl bg-[var(--color-positive)] px-3 text-xs font-bold text-white disabled:opacity-60"
                        >
                          <UserCheck className="h-4 w-4" />
                          {isBusy && busyAccountDecision === 'approve' ? 'Working...' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {isAdmin && pendingRequests.length > 0 && (
            <section aria-labelledby="group-request-heading">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h2 id="group-request-heading" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text)]">
                    <UserPlus className="h-4 w-4 text-[var(--color-positive)]" />
                    Group join requests
                  </h2>
                  <p className="mt-1 text-[10px] text-[var(--color-muted)]">Approve people who used this group's invite link, QR, or manual code.</p>
                </div>
                <span className="rounded-full bg-[var(--color-positive-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-positive)]">
                  {pendingRequests.length}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {pendingRequests.map(request => (
                  <div
                    key={request.id}
                    id={`pending-member-card-${request.id}`}
                    className="parite-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar member={request} size="md" />
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[var(--color-text)]">{request.display_name}</span>
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-mono text-[var(--color-muted)]">
                          <Clock className="h-3 w-3" />
                          {new Date(request.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-end">
                      <button
                        type="button"
                        id={`btn-view-spending-${request.id}`}
                        onClick={() => onViewMemberSpending(request.id)}
                        className="col-span-2 min-w-0 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-2.5 text-[10px] font-bold text-[var(--color-positive)] sm:col-span-1"
                      >
                        View spending
                      </button>
                      <button
                        type="button"
                        id={`btn-reject-request-${request.id}`}
                        onClick={() => runMemberAction(request.id, 'reject', () => onRejectMember(request.id))}
                        disabled={isMemberBusy(request.id) || !isTripActive}
                        className="flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] p-2.5 text-[10px] font-bold text-[var(--color-negative)]"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        <span>{busyMemberAction?.memberId === request.id && busyMemberAction.action === 'reject' ? 'Rejecting...' : 'Reject'}</span>
                      </button>
                      <button
                        type="button"
                        id={`btn-approve-request-${request.id}`}
                        onClick={() => runMemberAction(request.id, 'approve', () => onApproveMember(request.id))}
                        disabled={isMemberBusy(request.id) || !isTripActive}
                        className="flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-xl bg-[var(--color-positive)] p-2.5 text-[10px] font-bold text-white"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>{busyMemberAction?.memberId === request.id && busyMemberAction.action === 'approve' ? 'Approving...' : 'Approve'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </section>
      )}

      {isAdmin && activeCategory === 'removed' && (
        <section
          id="members-inactive-panel"
          role="tabpanel"
          aria-labelledby="members-inactive-tab"
          className="grid gap-3 lg:grid-cols-2"
        >
          {otherMembers.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-white px-4 py-10 text-center lg:col-span-2">
              <p className="text-sm font-semibold text-[var(--color-text)]">No inactive members</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">Removed and rejected members will appear here.</p>
            </div>
          ) : (
            otherMembers.map(member => (
              <div key={member.id} className="parite-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar member={member} size="md" />
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[var(--color-text)]">
                      {member.display_name}
                    </span>
                    <span className={`text-[10px] font-mono uppercase font-bold inline-block mt-1 ${
                      member.status === 'removed' ? 'text-amber-700' : 'text-[var(--color-negative)]'
                    }`}>
                      {member.status}
                    </span>
                  </div>
                </div>

                <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-end">
                  <button
                    type="button"
                    id={`btn-view-spending-${member.id}`}
                    onClick={() => onViewMemberSpending(member.id)}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2 text-[10px] font-bold text-[var(--color-positive)] cursor-pointer"
                  >
                    View spending
                  </button>

                  <button
                    type="button"
                    onClick={() => runMemberAction(member.id, 'approve', () => onApproveMember(member.id))}
                    disabled={isMemberBusy(member.id) || !isTripActive}
                    className="rounded-xl bg-[var(--color-positive)] px-3 py-2 text-[10px] font-bold text-[#fff] cursor-pointer"
                  >
                    {busyMemberAction?.memberId === member.id && busyMemberAction.action === 'approve' ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      <MemberAvatarPicker
        isOpen={isAvatarPickerOpen}
        member={currentMember}
        onClose={() => setIsAvatarPickerOpen(false)}
      />
    </div>
  );
};
