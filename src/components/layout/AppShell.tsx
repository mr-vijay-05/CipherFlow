import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { QuickSearchModal } from '../modals/QuickSearchModal';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { BRAND } from '../../constants/brand';

export const AppShell: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useKeyboardShortcut('k', () => setIsSearchOpen(true));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-800 antialiased font-sans">
      {/* Desktop Left Sidebar */}
      <Sidebar className="hidden lg:flex shrink-0 z-20" />

      {/* Mobile Drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Topbar */}
        <Topbar
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto focus:outline-none flex flex-col justify-between">
          <div className="p-4 sm:p-6 lg:p-7 max-w-[1600px] w-full mx-auto">
            <Outlet />
          </div>

          {/* Footer (Requirement 18) */}
          <footer className="mt-auto border-t border-slate-200/80 bg-white/70 py-5 px-6 sm:px-8 text-xs text-slate-500">
            <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="font-semibold text-slate-700">{BRAND.copyright}</span>
                <span className="text-slate-300 hidden sm:inline">|</span>
                <span className="text-slate-500">{BRAND.philosophy}</span>
              </div>

              <div className="flex items-center gap-5">
                {BRAND.links.map(link => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Quick Search Modal */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
};
