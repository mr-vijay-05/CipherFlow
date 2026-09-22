export type SecurityStatusType = 'encrypted' | 'shared' | 'locked';

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'viewer' | 'editor' | 'admin';
  grantedAt: string;
}

export interface Note {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  spaceId?: string;
  updatedAt: string;
  createdAt: string;
  isFavorite: boolean;
  isPinned: boolean;
  isTrashed?: boolean;
  securityStatus: SecurityStatusType;
  collaborators?: Collaborator[];
  userRole?: 'OWNER' | 'EDITOR' | 'VIEWER' | 'viewer' | 'editor' | 'admin';
  iconType?: 'file' | 'code' | 'lightbulb' | 'heart' | 'plane' | 'users' | 'book';
}

export interface Space {
  id: string;
  name: string;
  description: string;
  noteCount: number;
  icon: 'user' | 'graduation-cap' | 'briefcase' | 'folder' | 'shield';
  color?: string;
  isPrivate: boolean;
  collaboratorCount?: number;
}
