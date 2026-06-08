import React from 'react';
import { Member, Trip } from '../types';
import { db } from '../lib/storage';
import { User, RefreshCw, Layers, ShieldCheck, Heart } from 'lucide-react';

interface RoleSwitcherProps {
  trip: Trip | undefined;
  members: Member[];
  currentMemberId: string | null;
  onSelectMember: (memberId: string | null) => void;
  onResetDB: () => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  trip,
  members,
  currentMemberId,
  onSelectMember,
  onResetDB,
}) => {
  const currentMember = members.find(m => m.id === currentMemberId);

  return (
    <div className="bg-slate-900 text-white text-xs px-3 py-2.5 flex flex-col gap-2 border-b border-slate-800 shrink-0 z-40">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>TripBalance Sandbox Controls</span>
        </div>
        <button
          onClick={onResetDB}
          id="btn-reset-db"
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2 py-1 rounded transition-colors"
          title="Reset local storage back to sample GRAD26 trip data"
        >
          <RefreshCw className="w-3" />
          <span>Reset Sample Trip</span>
        </button>
      </div>

      <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded border border-slate-800/80">
        <div className="flex items-center gap-1.5 text-slate-200">
          <span className="font-semibold text-slate-400">Current Scope:</span>
          {trip ? (
            <span className="bg-indigo-900/40 text-indigo-300 border border-indigo-800/60 px-1.5 py-0.5 rounded text-[10px] font-mono">
              {trip.name} ({trip.base_currency})
            </span>
          ) : (
            <span className="text-slate-500 italic">No trip active (Landing)</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <User className="w-3 h-3 text-emerald-400" />
          <span className="font-semibold text-slate-200">
            {currentMember ? currentMember.display_name : 'No Persona'}
          </span>
          {currentMember?.role === 'admin' && (
            <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/50 px-1 py-0.1 rounded font-mono font-bold flex items-center gap-0.5">
              <ShieldCheck className="w-2 h-2" /> ADMIN
            </span>
          )}
        </div>
      </div>

      {trip && (
        <div className="flex flex-col gap-1 mt-1">
          <div className="text-[10px] text-slate-400 font-semibold mb-0.5">
            Test and switch member access views (changes app behavior reactively):
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
            {members.map(member => {
              const isActive = member.id === currentMemberId;
              let statusBadge = '';
              if (member.status === 'pending') statusBadge = ' ⏳';
              if (member.status === 'rejected') statusBadge = ' ❌';
              if (member.status === 'removed') statusBadge = ' 🚫';

              return (
                <button
                  key={member.id}
                  id={`btn-persona-${member.id}`}
                  onClick={() => onSelectMember(member.id)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-all shrink-0 whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 text-white font-bold ring-1 ring-indigo-500/50 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {member.display_name}
                  {statusBadge}
                  <span className="text-[8px] font-mono opacity-80 block text-left">
                    {member.role.toUpperCase()} • {member.status.toUpperCase()}
                  </span>
                </button>
              );
            })}
            
            <button
              id="btn-persona-gast"
              onClick={() => onSelectMember(null)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all shrink-0 whitespace-nowrap ${
                currentMemberId === null
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Guest / New User
              <span className="text-[8px] font-mono opacity-80 block text-left">
                Not Joined Yet
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
