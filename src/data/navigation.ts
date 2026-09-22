export interface NavItem {
  id: string;
  label: string;
  href: string;
  iconName: 'LayoutDashboard' | 'FileText' | 'Search' | 'Users' | 'Star' | 'Clock' | 'Trash2' | 'Share2' | 'FolderKanban' | 'KeyRound' | 'Laptop' | 'ShieldCheck' | 'ScrollText' | 'Settings';
  badge?: string | number;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAVIGATION_CONFIG: NavSection[] = [
  {
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' },
      { id: 'notes', label: 'Notes', href: '/notes', iconName: 'FileText' },
      { id: 'search', label: 'Search', href: '/search', iconName: 'Search' },
      { id: 'shared-with-me', label: 'Shared with Me', href: '/shared-with-me', iconName: 'Users' },
      { id: 'favorites', label: 'Favorites', href: '/favorites', iconName: 'Star' },
      { id: 'recent', label: 'Recent', href: '/recent', iconName: 'Clock' },
      { id: 'trash', label: 'Trash', href: '/trash', iconName: 'Trash2' },
    ],
  },
  {
    title: 'COLLABORATION',
    items: [
      { id: 'shared-notes', label: 'Shared Notes', href: '/shared', iconName: 'Share2' },
      { id: 'team-spaces', label: 'Team Spaces', href: '/spaces', iconName: 'FolderKanban' },
      { id: 'access-management', label: 'Access Management', href: '/access-management', iconName: 'KeyRound' },
    ],
  },
  {
    title: 'SECURITY',
    items: [
      { id: 'devices', label: 'Devices', href: '/devices', iconName: 'Laptop' },
      { id: 'security-center', label: 'Security Center', href: '/security', iconName: 'ShieldCheck' },
      { id: 'audit-logs', label: 'Audit Logs', href: '/audit-logs', iconName: 'ScrollText' },
    ],
  },
];
