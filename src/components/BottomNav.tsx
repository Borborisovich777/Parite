import React from 'react';
import { Receipt, Scale, Users } from 'lucide-react';

export type TabType = 'expenses' | 'balances' | 'members';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingRequestsCount: number;
  showAdminBadge: boolean;
  variant?: 'mobile' | 'desktop';
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  pendingRequestsCount,
  showAdminBadge,
  variant = 'mobile',
}) => {
  const tabs = [
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'balances', label: 'Balances', icon: Scale },
    { id: 'members', label: 'Members', icon: Users, badge: showAdminBadge ? pendingRequestsCount : 0 },
  ] as const;

  const isDesktop = variant === 'desktop';
  const containerClassName = isDesktop
    ? 'hidden w-full min-w-0 shrink-0 grid-cols-3 gap-2 border-b border-[var(--color-border)] bg-white/95 px-4 py-2 backdrop-blur-xl md:grid lg:px-6 xl:px-8'
    : 'bottom-nav-safe fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-xl border-t border-[var(--color-border)] flex items-start justify-around px-2 pt-1 z-30 shadow-[0_-10px_30px_rgba(40,73,60,0.09)] shrink-0 md:hidden';

  return (
    <div className={containerClassName}>
      {tabs.map(tab => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            type="button"
            key={tab.id}
            id={isDesktop ? `nav-tab-${tab.id}-desktop` : `nav-tab-${tab.id}`}
            onClick={() => onChangeTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex items-center justify-center text-center transition-all cursor-pointer ${
              isActive
                ? 'text-[var(--color-positive)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            } ${isDesktop ? 'min-h-11 min-w-0 w-full rounded-2xl border border-transparent px-3 py-2 gap-2 text-sm font-bold hover:border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]' : 'flex-col flex-1 h-[61px] min-w-[44px] py-0.5'}`}
          >
            <div className={`relative flex h-8 min-w-10 items-center justify-center rounded-xl px-2 transition-all duration-150 active:scale-95 ${
              isActive ? 'bg-[var(--color-positive-soft)] shadow-[inset_0_0_0_1px_rgba(47,125,102,0.08)]' : ''
            }`}>
              <IconComponent className={`w-5.5 h-5.5 transition-colors ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              
              {'badge' in tab && tab.badge > 0 ? (
                <span className="absolute -top-1 -right-1 bg-[var(--color-negative)] text-white font-mono font-bold text-[9px] min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center border-2 border-white tabular-nums">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className={`${isDesktop ? 'min-w-0 truncate text-sm' : 'text-[11px] mt-0.5'} tracking-tight ${isActive ? 'font-bold text-[var(--color-positive)]' : 'font-medium text-[var(--color-muted)]'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
