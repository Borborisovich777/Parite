import React, { useEffect } from 'react';
import {
  ArrowLeft,
  Copy,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Member, Trip } from '../types';

interface SideMenuProps {
  isOpen: boolean;
  trip: Trip;
  currentMember: Member | null;
  onClose: () => void;
  onLeaveTrip: () => void;
  onAdminTools: () => void;
}

export const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  trip,
  currentMember,
  onClose,
  onLeaveTrip,
  onAdminTools,
}) => {
  const isAdmin = currentMember?.role === 'admin';

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyInvite = () => {
    navigator.clipboard?.writeText(trip.invite_code);
  };

  return (
    <div className="fixed inset-0 z-50 flex max-w-md mx-auto">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] cursor-default"
        aria-label="Close menu"
        onClick={onClose}
      />

      <aside className="relative z-10 h-full w-[82%] max-w-[340px] bg-[#121418] border-r border-slate-800 shadow-2xl flex flex-col animate-slide-up">
        <div className="px-4 py-4 border-b border-slate-800/80 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-mono text-slate-500">
              Current trip
            </p>
            <h2 className="text-lg font-bold text-white font-display truncate mt-1">
              {trip.name}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Base currency: <span className="font-mono text-indigo-300">{trip.base_currency}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[#1a1d23] border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 flex flex-col gap-5">
          <section className="rounded-2xl bg-[#1a1d23] border border-slate-800 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-3">
              Signed in as
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-200 flex items-center justify-center font-bold uppercase">
                {currentMember ? currentMember.display_name.charAt(0) : '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate">
                  {currentMember?.display_name ?? 'No trip member'}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] uppercase font-mono text-slate-500">
                  <span>{currentMember?.status ?? 'not joined'}</span>
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                Invite code
              </p>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-300 hover:text-indigo-200 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#1a1d23] px-4 py-3 font-mono text-lg font-bold tracking-widest text-white">
              {trip.invite_code}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            {isAdmin && currentMember?.status === 'approved' && (
              <button
                type="button"
                id="btn-menu-admin-tools"
                onClick={() => {
                  onAdminTools();
                  onClose();
                }}
                className="w-full min-h-11 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:border-indigo-500/40"
              >
                <Users className="w-4 h-4 text-indigo-300" />
                Admin tools
              </button>
            )}

            <button
              type="button"
              id="btn-app-leave-trip"
              onClick={() => {
                onLeaveTrip();
                onClose();
              }}
              className="w-full min-h-11 rounded-2xl bg-rose-950/35 border border-rose-900/40 text-rose-200 px-3 py-3 flex items-center gap-2 font-semibold text-sm cursor-pointer hover:bg-rose-950/55"
            >
              <ArrowLeft className="w-4 h-4" />
              Leave trip
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
};
