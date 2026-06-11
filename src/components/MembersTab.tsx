import React, { useEffect, useState } from 'react';
import { Trip, Member } from '../types';
import { Clock, Shield, Trash2, UserCheck, UserX } from 'lucide-react';

type MemberCategory = 'approved' | 'requests' | 'removed';

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
}) => {
  const [activeCategory, setActiveCategory] = useState<MemberCategory>(initialCategory);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const isAdmin = currentMember.role === 'admin';
  const isTripActive = (trip.status ?? 'active') === 'active';
  const approvedMembers = members.filter(member => member.status === 'approved');
  const pendingRequests = members.filter(member => member.status === 'pending');
  const otherMembers = members.filter(member => member.status === 'removed' || member.status === 'rejected');

  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  const runMemberAction = async (memberId: string, action: () => void | Promise<void>) => {
    setBusyMemberId(memberId);
    try {
      await action();
    } catch (error) {
      console.error(error);
    } finally {
      setBusyMemberId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-24 animate-fade-in px-4 pt-4">
      <div>
        <h1 className="text-xl font-bold font-display text-white tracking-tight">
          Members
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage access for {trip.name}.
        </p>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-3 gap-1.5 bg-[#1a1d23] border border-slate-800 p-1 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveCategory('approved')}
            className={`min-h-10 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
              activeCategory === 'approved'
                ? 'bg-indigo-600 text-slate-950'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Approved ({approvedMembers.length})
          </button>

          <button
            type="button"
            id="btn-requests-filter"
            onClick={() => setActiveCategory('requests')}
            className={`min-h-10 rounded-xl text-[10px] font-bold uppercase transition-all relative cursor-pointer ${
              activeCategory === 'requests'
                ? 'bg-indigo-600 text-slate-950'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Requests
            {pendingRequests.length > 0 && (
              <span className="absolute top-1 right-1 bg-rose-500 text-slate-950 text-[8px] w-4 h-4 rounded-full flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('removed')}
            className={`min-h-10 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
              activeCategory === 'removed'
                ? 'bg-indigo-600 text-slate-950'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Inactive ({otherMembers.length})
          </button>
        </div>
      )}

      {(!isAdmin || activeCategory === 'approved') && (
        <section className="flex flex-col gap-2">
          {approvedMembers.map(member => {
            const isCurrentUser = member.id === currentMember.id;

            return (
              <div
                key={member.id}
                id={`member-row-${member.id}`}
                className="bg-[#1a1d23] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-200 uppercase shrink-0">
                    {member.display_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-slate-100 block leading-tight truncate">
                      {member.display_name}{isCurrentUser ? ' (You)' : ''}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase flex items-center gap-1 mt-1">
                      {member.role === 'admin' && <Shield className="w-3 h-3 text-emerald-400" />}
                      {member.role} / approved
                    </span>
                  </div>
                </div>

                {isAdmin && isTripActive && !isCurrentUser && (
                  <div className="flex items-center gap-2 shrink-0">
                    {member.role === 'admin' ? (
                      <button
                        type="button"
                        id={`btn-demote-admin-${member.id}`}
                        onClick={() => {
                          if (confirm(`Remove admin permissions from ${member.display_name}? They will stay in the trip as a member.`)) {
                            runMemberAction(member.id, () => onDemoteAdmin(member.id));
                          }
                        }}
                        disabled={busyMemberId === member.id}
                        className="text-slate-950 bg-[var(--color-negative)] px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-[10px] font-bold"
                        title="Remove admin"
                      >
                        Remove admin
                      </button>
                    ) : (
                      <button
                        type="button"
                        id={`btn-promote-member-${member.id}`}
                        onClick={() => runMemberAction(member.id, () => onPromoteMember(member.id))}
                        disabled={busyMemberId === member.id}
                        className="text-slate-950 bg-[var(--color-positive)] px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-[10px] font-bold"
                        title="Make admin"
                      >
                        Make admin
                      </button>
                    )}
                    <button
                      type="button"
                      id={`btn-remove-member-${member.id}`}
                      onClick={() => {
                        if (confirm(`Remove ${member.display_name}? Historical expenses paid or split by them remain intact.`)) {
                          runMemberAction(member.id, () => onRemoveMember(member.id));
                        }
                      }}
                      disabled={busyMemberId === member.id}
                      className="text-slate-950 bg-[var(--color-negative)] p-2.5 rounded-xl transition-colors cursor-pointer"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {isAdmin && activeCategory === 'requests' && (
        <section className="flex flex-col gap-2">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 px-4 bg-[#1a1d23] border border-dashed border-slate-800 rounded-3xl text-slate-400">
              <Clock className="w-9 h-9 mx-auto text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-300">No pending requests</p>
              <p className="text-xs text-slate-500 mt-1">New join requests will appear here.</p>
            </div>
          ) : (
            pendingRequests.map(request => (
              <div
                key={request.id}
                id={`pending-member-card-${request.id}`}
                className="bg-[#1a1d23] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-bold text-slate-100 block truncate">
                    {request.display_name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(request.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    id={`btn-reject-request-${request.id}`}
                    onClick={() => runMemberAction(request.id, () => onRejectMember(request.id))}
                    disabled={busyMemberId === request.id || !isTripActive}
                    className="bg-[var(--color-negative)] text-slate-950 text-[10px] font-bold p-2.5 rounded-xl cursor-pointer flex items-center gap-1"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>

                  <button
                    type="button"
                    id={`btn-approve-request-${request.id}`}
                    onClick={() => runMemberAction(request.id, () => onApproveMember(request.id))}
                    disabled={busyMemberId === request.id || !isTripActive}
                    className="bg-[var(--color-positive)] text-slate-950 text-[10px] font-bold p-2.5 rounded-xl cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {isAdmin && activeCategory === 'removed' && (
        <section className="flex flex-col gap-2">
          {otherMembers.length === 0 ? (
            <div className="text-center py-10 px-4 bg-[#1a1d23] border border-dashed border-slate-800 rounded-3xl">
              <p className="text-sm text-slate-300 font-semibold">No inactive members</p>
            </div>
          ) : (
            otherMembers.map(member => (
              <div key={member.id} className="bg-[#1a1d23] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-slate-300 block truncate">
                    {member.display_name}
                  </span>
                  <span className={`text-[10px] font-mono uppercase font-bold inline-block mt-1 ${
                    member.status === 'removed' ? 'text-amber-300' : 'text-rose-300'
                  }`}>
                    {member.status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => runMemberAction(member.id, () => onApproveMember(member.id))}
                  disabled={busyMemberId === member.id || !isTripActive}
                  className="text-[10px] bg-[#121418] border border-slate-800 text-slate-200 hover:bg-slate-800 rounded-xl px-3 py-2 font-bold cursor-pointer"
                >
                  Approve
                </button>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
};
