import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { DashboardPage } from '../pages/DashboardPage';
import { NotesPage } from '../pages/NotesPage';
import { NoteDetailPage } from '../pages/NoteDetailPage';
import { NewNotePage } from '../pages/NewNotePage';
import { SearchPage } from '../pages/SearchPage';
import { SharedPage } from '../pages/SharedPage';
import { SharedWithMePage } from '../pages/SharedWithMePage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { RecentPage } from '../pages/RecentPage';
import { TrashPage } from '../pages/TrashPage';
import { SpacesPage } from '../pages/SpacesPage';
import { SpaceDetailPage } from '../pages/SpaceDetailPage';
import { AccessManagementPage } from '../pages/AccessManagementPage';
import { DevicesPage } from '../pages/DevicesPage';
import { SecurityCenterPage } from '../pages/SecurityCenterPage';
import { AuditLogsPage } from '../pages/AuditLogsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { LoginPage } from '../pages/LoginPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'notes',
        element: <NotesPage />,
      },
      {
        path: 'notes/new',
        element: <NewNotePage />,
      },
      {
        path: 'notes/:id',
        element: <NoteDetailPage />,
      },
      {
        path: 'search',
        element: <SearchPage />,
      },
      {
        path: 'shared',
        element: <SharedPage />,
      },
      {
        path: 'shared-with-me',
        element: <SharedWithMePage />,
      },
      {
        path: 'favorites',
        element: <FavoritesPage />,
      },
      {
        path: 'recent',
        element: <RecentPage />,
      },
      {
        path: 'trash',
        element: <TrashPage />,
      },
      {
        path: 'spaces',
        element: <SpacesPage />,
      },
      {
        path: 'spaces/:id',
        element: <SpaceDetailPage />,
      },
      {
        path: 'access-management',
        element: <AccessManagementPage />,
      },
      {
        path: 'devices',
        element: <DevicesPage />,
      },
      {
        path: 'security',
        element: <SecurityCenterPage />,
      },
      {
        path: 'audit-logs',
        element: <AuditLogsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
