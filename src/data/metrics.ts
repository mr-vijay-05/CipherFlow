import { MetricData } from '../types/user';

export const DASHBOARD_METRICS: MetricData[] = [
  {
    id: 'total-notes',
    label: 'Total Notes',
    value: 24,
    change: '+12%',
    changeType: 'positive',
    iconName: 'FileText',
  },
  {
    id: 'shared-notes',
    label: 'Shared Notes',
    value: 6,
    change: '+2',
    changeType: 'positive',
    iconName: 'Users',
  },
  {
    id: 'recently-edited',
    label: 'Recently Edited',
    value: 8,
    change: '+5',
    changeType: 'positive',
    iconName: 'Clock',
  },
  {
    id: 'favorites',
    label: 'Favorites',
    value: 5,
    change: '—',
    changeType: 'neutral',
    iconName: 'Star',
  },
];
