import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Search,
  Users,
  Star,
  Clock,
  Trash2,
  Share2,
  FolderKanban,
  KeyRound,
  Laptop,
  ShieldCheck,
  ScrollText,
  Cloud,
  MoreVertical,
  Shield
} from 'lucide-react';
import { NAVIGATION_CONFIG, NavItem } from '../../data/navigation';
import { BRAND } from '../../constants/brand';

const ICON_MAP = {
  LayoutDashboard,
  FileText,
  Search,
  Users,
  Star,
  Clock,
  Trash2,
  Share2,
  FolderKanban,
  KeyRound,
  Laptop,
  ShieldCheck,
  ScrollText,
  Settings: LayoutDashboard,
};

export interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '', onNavigate }) => {
  const location = useLocation();

  const isRouteActive = (href: string) => {
    if (href === '/dashboard' || href === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <aside className={`w-64 bg-white border-r border-[#e8edf3] flex flex-col justify-between h-full select-none ${className}`}>
      {/* Top Branding & Nav List */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-5 pb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 shrink-0">
            {/* Custom geometric logo icon */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 2.24l7 3.89v4.87c0 4.29-2.98 8.3-7 9.42-4.02-1.12-7-5.13-7-9.42V8.13l7-3.89zm-1 4.76v7h2V9h-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
              {BRAND.name}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium truncate">
              {BRAND.tagline}
            </p>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="px-3 py-2 space-y-5" aria-label="Main Navigation">
          {NAVIGATION_CONFIG.map((section, idx) => (
            <div key={idx} className="space-y-0.5">
              {section.title && (
                <h3 className="px-3 mb-1.5 text-[11px] font-bold text-slate-400 tracking-wider">
                  {section.title}
                </h3>
              )}
              <div className="space-y-0.5">
                {section.items.map((item: NavItem) => {
                  const Icon = ICON_MAP[item.iconName] || FileText;
                  const active = isRouteActive(item.href);

                  return (
                    <NavLink
                      key={item.id}
                      to={item.href}
                      onClick={onNavigate}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            active ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Storage & User Profile */}
      <div className="p-3 space-y-3 border-t border-slate-100 bg-white">
        {/* Storage card */}
        <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-slate-700 font-semibold mb-1">
            <span className="flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
              Storage
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">1.2 GB of 10 GB used</p>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-2.5">
            <div className="bg-blue-600 h-full rounded-full w-[12%]"></div>
          </div>
          <button className="w-full py-1.5 px-2 bg-blue-50 hover:bg-blue-100/80 text-blue-600 text-[11px] font-semibold rounded-lg transition-colors border border-blue-100">
            Upgrade Plan
          </button>
        </div>

        {/* User Profile */}
        <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 ring-2 ring-blue-100">
              {BRAND.defaultUser.avatarText}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {BRAND.defaultUser.name}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {BRAND.defaultUser.email}
              </p>
            </div>
          </div>
          <button
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            aria-label="User account actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
