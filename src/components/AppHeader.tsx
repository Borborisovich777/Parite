import React from 'react';
import { Menu } from 'lucide-react';
import { Member, Trip } from '../types';

interface AppHeaderProps {
  trip: Trip;
  currentMember: Member | null;
  onMenuOpen: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  trip,
  currentMember,
  onMenuOpen,
}) => {
  const statusLabel = currentMember?.status === 'approved'
    ? `Base ${trip.base_currency}`
    : currentMember?.status ?? trip.base_currency;

  return (
    <header className="shrink-0 bg-[#121418]/95 border-b border-slate-800/70 px-4 py-3 flex items-center justify-between gap-3">
      <button
        type="button"
        id="btn-open-side-menu"
        onClick={onMenuOpen}
        className="w-11 h-11 rounded-2xl bg-[#1a1d23] border border-slate-800 text-slate-200 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 leading-none">
          TripBalance
        </p>
        <h1 className="text-base font-bold text-white font-display truncate leading-tight mt-1">
          {trip.name}
        </h1>
      </div>

      <div className="shrink-0 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-bold text-indigo-300 uppercase font-mono">
        {statusLabel}
      </div>
    </header>
  );
};
