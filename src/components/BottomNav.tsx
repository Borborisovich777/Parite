import React from 'react';
import { Home, Receipt, Scale, Users } from 'lucide-react';

export type TabType = 'dashboard' | 'expenses' | 'balances' | 'members';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingRequestsCount: number;
  showAdminBadge: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  pendingRequestsCount,
  showAdminBadge,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'balances', label: 'Balances', icon: Scale },
    { id: 'members', label: 'Members', icon: Users, badge: showAdminBadge ? pendingRequestsCount : 0 },
  ] as const;

  return (
    <div className="bottom-nav-safe fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#121418]/95 backdrop-blur border-t border-slate-800 flex justify-around items-start px-2 z-30 shadow-[0_-8px_28px_rgba(0,0,0,0.12)] shrink-0">
      {tabs.map(tab => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => onChangeTab(tab.id)}
            className={`relative flex flex-col items-center justify-center flex-1 h-[68px] py-1 text-center transition-all cursor-pointer ${
              isActive
                ? 'text-indigo-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
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
            <span className={`text-[11px] tracking-tight font-medium mt-0.5 ${isActive ? 'font-bold text-indigo-300' : 'text-slate-500'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
