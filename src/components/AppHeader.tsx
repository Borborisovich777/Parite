import React from 'react';
import { Member, Trip } from '../types';
import { MemberAvatar } from './MemberAvatar';

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
  const tripStatus = trip.status ?? 'active';
  const statusLabel = tripStatus !== 'active'
    ? tripStatus
    : currentMember?.status === 'approved'
      ? `Base ${trip.base_currency}`
      : currentMember?.status ?? trip.base_currency;

  return (
    <header className="app-header-safe header-wash sticky top-0 z-40 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 pb-3.5 shadow-[0_8px_24px_rgba(40,73,60,0.05)]">
      <button
        type="button"
        id="btn-open-side-menu"
        onClick={onMenuOpen}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white/45 text-[var(--color-text)] transition-all hover:bg-white/70 active:scale-95 md:w-auto md:px-2.5 md:pr-3.5"
        aria-label={currentMember ? `Open menu for ${currentMember.display_name}` : 'Open menu'}
      >
        <MemberAvatar member={currentMember} size="md" />
        <span className="hidden text-xs font-bold md:inline">Menu</span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase leading-none tracking-[0.16em] text-[var(--color-positive)]">
          Parité group
        </p>
        <h1 className="mt-1 truncate font-display text-[17px] font-bold leading-tight text-[var(--color-text)]">
          {trip.name}
        </h1>
      </div>

      <div className="currency-tag shrink-0 rounded-full px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--color-positive)]">
        {statusLabel}
      </div>
    </header>
  );
};
