import React, { useState } from 'react';
import { HeroBanner } from '../components/dashboard/HeroBanner';
import { MetricCard } from '../components/dashboard/MetricCard';
import { RecentNotes } from '../components/dashboard/RecentNotes';
import { Spaces } from '../components/dashboard/Spaces';
import { ProductivityInsights } from '../components/dashboard/ProductivityInsights';
import { SecurityStatus } from '../components/dashboard/SecurityStatus';
import { QuickActions } from '../components/dashboard/QuickActions';
import { ActivityTimeline } from '../components/dashboard/ActivityTimeline';
import { QuoteCard } from '../components/dashboard/QuoteCard';
import { ShareModal } from '../components/modals/ShareModal';
import { ImportModal } from '../components/modals/ImportModal';
import { NewSpaceModal } from '../components/modals/NewSpaceModal';
import { DASHBOARD_METRICS } from '../data/metrics';
import { INITIAL_SPACES } from '../data/spaces';
import { useNotes } from '../hooks/useNotes';
import { Note, Space } from '../types/note';
import { spaceService } from '../services/spaceService';

export const DashboardPage: React.FC = () => {
  const { notes, toggleFavorite, togglePin, trashNote, refresh } = useNotes();
  const [spaces, setSpaces] = useState<Space[]>(INITIAL_SPACES);

  // Modals state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedNoteForShare, setSelectedNoteForShare] = useState<Note | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNewSpaceModalOpen, setIsNewSpaceModalOpen] = useState(false);

  const handleOpenShare = (note?: Note) => {
    setSelectedNoteForShare(note || notes[0] || null);
    setIsShareModalOpen(true);
  };

  const handleRefreshSpaces = async () => {
    const updated = await spaceService.getSpaces();
    setSpaces(updated);
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Banner */}
      <HeroBanner />

      {/* 2. Main Grid Layout: Left Main Workspace (8 cols) & Right Utility Panels (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Central Content Workspace (8 cols on XL) */}
        <div className="xl:col-span-8 space-y-6">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {DASHBOARD_METRICS.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>

          {/* Recent Notes Section */}
          <RecentNotes
            notes={notes}
            onToggleFavorite={toggleFavorite}
            onTogglePin={togglePin}
            onShareNote={handleOpenShare}
            onTrashNote={trashNote}
          />

          {/* Your Spaces Section */}
          <Spaces spaces={spaces} />

          {/* Productivity Insights Section */}
          <ProductivityInsights />
        </div>

        {/* Right Column: Security, Actions, Activity & Quote Panels (4 cols on XL) */}
        <div className="xl:col-span-4 space-y-5">
          {/* Security Status Panel */}
          <SecurityStatus />

          {/* Quick Actions Panel */}
          <QuickActions
            onOpenShareModal={() => handleOpenShare()}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onOpenNewSpaceModal={() => setIsNewSpaceModalOpen(true)}
          />

          {/* Recent Activity Timeline */}
          <ActivityTimeline />

          {/* Supporting Brand Quote Card */}
          <QuoteCard />
        </div>
      </div>

      {/* Modals */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        note={selectedNoteForShare}
        onShared={refresh}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={refresh}
      />

      <NewSpaceModal
        isOpen={isNewSpaceModalOpen}
        onClose={() => setIsNewSpaceModalOpen(false)}
        onCreated={handleRefreshSpaces}
      />
    </div>
  );
};
