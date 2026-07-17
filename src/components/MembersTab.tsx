import React, { useEffect, useState } from 'react';
import { Trip, Member } from '../types';
import { Clock, Pencil, Shield, Trash2, UserCheck, UserX } from 'lucide-react';
import { MemberAvatar } from './MemberAvatar';
import { MemberAvatarPicker } from './MemberAvatarPicker';

type MemberCategory = 'approved' | 'requests' | 'removed';
type BusyMemberAction = 'approve' | 'reject' | 'remove' | 'promote' | 'demote';

interface MembersTabProps {
  trip: Trip;
  currentMember: Member;
  members: Member[];
  initialCategory?: MemberCategory;
  onApproveMember: (memberId: string) => void | Promise<void>;
  onRejectMember: (memberId: string) => void | Promise<void>;
  onRemoveMember: (memberId: string) => void | Promise<void>;
  onPromoteMember: (memberId: string) => void | Promise<void>;
  onDemoteAdmin: (memberId: string) => void | Promise<void>;
  onViewMemberSpending: (memberId: string) => void;
}

export const MembersTab: React.FC<MembersTabProps> = ({
  trip,
  currentMember,
  members,
  initialCategory = 'approved',
  onApproveMember,
  onRejectMember,
  onRemoveMember,
  onPromoteMember,
  onDemoteAdmin,
  onViewMemberSpending,
}) => {
  const [activeCategory, setActiveCategory] = useState<MemberCategory>(initialCategory);
  const [busyMemberAction, setBusyMemberAction] = useState<{ memberId: string; action: BusyMemberAction } | null>(null);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const isAdmin = currentMember.role === 'admin';
  const isTripActive = (trip.status ?? 'active') === 'active';
  const approvedMembers = members.filter(member => member.status === 'approved');
  const pendingRequests = members.filter(member => member.status === 'pending');
  const otherMembers = members.filter(member => member.status === 'removed' || member.status === 'rejected');

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
            {isAdmin && pendingRequests.length > 0
              ? ` · ${pendingRequests.length} waiting for approval`
              : '.'}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-[10px] font-bold text-[var(--color-positive)] shadow-sm">
          {approvedMembers.length} active
        </span>
      </div>

      {isAdmin && (
        <div className="grid shrink-0 grid-cols-3 gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-1">
          <button
            type="button"
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
            onClick={() => setActiveCategory('requests')}
            className={`relative min-h-10 rounded-xl px-1 text-[10px] font-bold transition-all cursor-pointer ${
              activeCategory === 'requests'
                ? 'bg-white text-[var(--color-positive)] shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Requests
            {pendingRequests.length > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-negative)] px-1 text-[8px] font-bold text-[#fff]">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('removed')}
            className={`min-h-10 rounded-xl px-1 text-[10px] font-bold transition-all cursor-pointer ${
              activeCategory === 'removed'
                ? 'bg-white text-[var(--color-positive)] shadow-sm'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Inactive ({otherMembers.length})
          </button>
        </div>
      )}

      {(!isAdmin || activeCategory === 'approved') && (
        <section className="grid gap-3 lg:grid-cols-2">
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

      {isAdmin && activeCategory === 'requests' && (
        <section className="grid gap-3 lg:grid-cols-2">
          {pendingRequests.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-white px-4 py-12 text-center text-[var(--color-muted)] lg:col-span-2">
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
                <Clock className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-[var(--color-text)]">No pending requests</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">New join requests will appear here.</p>
            </div>
          ) : (
            pendingRequests.map(request => (
              <div
                key={request.id}
                id={`pending-member-card-${request.id}`}
                className="parite-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar member={request} size="md" />
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[var(--color-text)]">
                      {request.display_name}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] font-mono text-[var(--color-muted)]">
                      <Clock className="w-3 h-3" />
                      {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="grid w-full shrink-0 grid-cols-3 gap-2 sm:flex sm:w-auto sm:justify-end">
                  <button
                    type="button"
                    id={`btn-view-spending-${request.id}`}
                    onClick={() => onViewMemberSpending(request.id)}
                    className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-2.5 text-[10px] font-bold text-[var(--color-positive)] cursor-pointer"
                  >
                    View spending
                  </button>

                  <button
                    type="button"
                    id={`btn-reject-request-${request.id}`}
                    onClick={() => runMemberAction(request.id, 'reject', () => onRejectMember(request.id))}
                    disabled={isMemberBusy(request.id) || !isTripActive}
                    className="min-w-0 rounded-xl border border-[var(--color-negative)]/15 bg-[var(--color-negative-soft)] p-2.5 text-[10px] font-bold text-[var(--color-negative)] cursor-pointer flex items-center justify-center gap-1"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>{busyMemberAction?.memberId === request.id && busyMemberAction.action === 'reject' ? 'Rejecting...' : 'Reject'}</span>
                  </button>

                  <button
                    type="button"
                    id={`btn-approve-request-${request.id}`}
                    onClick={() => runMemberAction(request.id, 'approve', () => onApproveMember(request.id))}
                    disabled={isMemberBusy(request.id) || !isTripActive}
                    className="min-w-0 rounded-xl bg-[var(--color-positive)] p-2.5 text-[10px] font-bold text-[#fff] cursor-pointer flex items-center justify-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{busyMemberAction?.memberId === request.id && busyMemberAction.action === 'approve' ? 'Approving...' : 'Approve'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {isAdmin && activeCategory === 'removed' && (
        <section className="grid gap-3 lg:grid-cols-2">
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
