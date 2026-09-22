import { ActivityItem } from '../types/user';

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    title: 'You edited "Project Orion"',
    target: 'Project Orion - Architecture',
    timestamp: '2 hours ago',
    type: 'edit',
    iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  {
    id: 'act-2',
    title: 'You shared a note with Arjun',
    target: 'Meeting Notes - Client Discussion',
    timestamp: '5 hours ago',
    type: 'share',
    iconColor: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    id: 'act-3',
    title: 'New device "Windows Laptop"',
    target: 'Hardware Key Registration',
    timestamp: '1 day ago',
    type: 'device',
    iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  },
  {
    id: 'act-4',
    title: 'You created "Research Ideas"',
    target: 'Research Ideas',
    timestamp: '2 days ago',
    type: 'create',
    iconColor: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  {
    id: 'act-5',
    title: 'You revoked access from Rohan',
    target: 'Revocation Certificate Generated',
    timestamp: '3 days ago',
    type: 'revoke',
    iconColor: 'text-rose-600 bg-rose-50 border-rose-200',
  },
];
