import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, ChevronDown, Menu, ShieldCheck, KeyRound, LogOut } from 'lucide-react';
import { BRAND } from '../../constants/brand';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

export interface TopbarProps {
  onOpenSearch: () => void;
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenSearch,
  onOpenMobileMenu,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { showToast } = useToast();

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
    showToast(
      !isDarkTheme ? 'Dark Mode (Preview)' : 'Light Mode Active',
      'Theme preference stored locally in client enclave.',
      'info'
    );
  };

  return (
    <header className="h-16 bg-white border-b border-[#e8edf3] px-4 md:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Mobile Hamburger + Title */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold text-slate-900">{BRAND.name}</span>
      </div>

      {/* Global Search Bar (Center/Left) */}
      <div className="flex-1 max-w-xl">
        <div
          onClick={onOpenSearch}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') onOpenSearch();
          }}
          className="flex items-center justify-between w-full px-3.5 py-2 bg-[#f8fafc] hover:bg-slate-100 border border-slate-200/90 rounded-xl cursor-pointer text-slate-400 hover:text-slate-600 transition-all shadow-subtle group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
            <span className="text-xs sm:text-sm text-slate-500 font-medium truncate">
              Search your encrypted notes...
            </span>
          </div>
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono font-medium text-slate-400 bg-white border border-slate-200 rounded shadow-xs shrink-0">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification Icon */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors relative"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-dropdown border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-bold text-slate-800">Security & Activity</span>
                <span className="text-[10px] text-blue-600 font-semibold cursor-pointer">Mark read</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 text-emerald-900">
                  <p className="font-semibold">Security Check Complete</p>
                  <p className="text-[11px] text-emerald-700">All local vaults verified & encrypted on this device.</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
                  <p className="font-semibold">New Device Key Synced</p>
                  <p className="text-[11px] text-slate-500">iPhone 15 Pro verified via ECDH challenge.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          aria-label="Toggle theme mode"
        >
          {isDarkTheme ? <Moon className="w-4 h-4 text-blue-500" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* User Avatar & Name */}
        <div className="relative">
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 pl-1.5 sm:pl-2 pr-1 sm:pr-2 py-1 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-blue-100 shrink-0">
              {user.avatarText || BRAND.defaultUser.avatarText}
            </div>
            <span className="hidden md:inline-block text-xs font-bold text-slate-800">
              {user.name || BRAND.defaultUser.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline-block" />
          </div>

          {/* User Menu Dropdown */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-dropdown border border-slate-200 p-2 z-50 animate-in fade-in duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-bold text-slate-900">{user.name || BRAND.defaultUser.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email || BRAND.defaultUser.email}</p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> {user.role || 'Protected Vault Active'}
                </div>
              </div>
              <a href="/settings" className="block px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-lg">
                Account & Security Settings
              </a>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  navigate('/login');
                }}
                className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2 font-medium"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Switch Persona / Login</span>
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  logout();
                  showToast('Session Locked', 'Local memory cache cleared and vault locked.', 'info');
                  navigate('/login');
                }}
                className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock Enclave Session</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
