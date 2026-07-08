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
    ? 'hidden md:flex shrink-0 bg-[#121418]/95 backdrop-blur border-b border-slate-800 px-4 py-2 gap-2'
    : 'bottom-nav-safe fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#121418]/95 backdrop-blur border-t border-slate-800 flex justify-around items-start px-2 z-30 shadow-[0_-8px_28px_rgba(0,0,0,0.12)] shrink-0 md:hidden';

  return (
    <div className={containerClassName}>
      {tabs.map(tab => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            id={isDesktop ? `nav-tab-${tab.id}-desktop` : `nav-tab-${tab.id}`}
            onClick={() => onChangeTab(tab.id)}
            className={`relative flex items-center justify-center text-center transition-all cursor-pointer ${
              isActive
                ? 'text-indigo-400'
                : 'text-slate-500 hover:text-slate-300'
            } ${isDesktop ? 'min-h-11 flex-1 rounded-2xl border border-transparent px-4 py-2 gap-2 text-sm font-bold hover:border-slate-800' : 'flex-col flex-1 h-[68px] py-1'}`}
          >
            <div className={`relative p-1.5 rounded-2xl transition-transform duration-150 active:scale-95 ${
              isActive ? 'bg-indigo-500/10' : ''
            }`}>
              <IconComponent className={`w-5.5 h-5.5 transition-colors ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              
              {'badge' in tab && tab.badge > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-slate-950 font-mono font-bold text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#1a1d23] animate-pulse">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className={`${isDesktop ? 'text-sm' : 'text-[11px] mt-0.5'} tracking-tight font-medium ${isActive ? 'font-bold text-indigo-300' : 'text-slate-500'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
