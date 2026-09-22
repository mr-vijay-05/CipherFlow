import { Space } from '../types/note';

export const INITIAL_SPACES: Space[] = [
  {
    id: 'personal',
    name: 'Personal',
    description: 'Your private thoughts',
    noteCount: 12,
    icon: 'user',
    isPrivate: true,
    color: '#8b5cf6', // Violet
  },
  {
    id: 'college',
    name: 'College',
    description: 'Academic notes and projects',
    noteCount: 8,
    icon: 'graduation-cap',
    isPrivate: false,
    collaboratorCount: 4,
    color: '#10b981', // Emerald
  },
  {
    id: 'work',
    name: 'Work',
    description: 'Professional and client work',
    noteCount: 4,
    icon: 'briefcase',
    isPrivate: false,
    collaboratorCount: 7,
    color: '#3b82f6', // Blue
  },
];
