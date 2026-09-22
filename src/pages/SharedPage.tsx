import React, { useState } from 'react';
import { useNotes } from '../hooks/useNotes';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { ShareModal } from '../components/modals/ShareModal';
import { Note } from '../types/note';
import { Share2, Users, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SharedPage: React.FC = () => {
  const navigate = useNavigate();
  const { notes, toggleFavorite, togglePin, trashNote, refresh } = useNotes();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Notes that have collaborators or are marked shared
  const sharedNotes = notes.filter(
    n => n.securityStatus === 'shared' || (n.collaborators && n.collaborators.length > 0)
  );

  const handleOpenShare = (note: Note) => {
    setSelectedNote(note);
    setIsShareOpen(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Shared Notes
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Knowledge bases shared with peers via cryptographic access grants and key wrapping.
        </p>
      </div>

      {sharedNotes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sharedNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              viewMode="grid"
              onToggleFavorite={toggleFavorite}
              onTogglePin={togglePin}
              onShare={handleOpenShare}
              onTrash={trashNote}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-card">
          <EmptyState
            icon={<Share2 className="w-8 h-8" />}
            title="No shared notes yet"
            description="Share your notes with collaborators by creating cryptographic key access grants."
            actionLabel="View All Notes"
            actionIcon={<Users className="w-4 h-4" />}
            onAction={() => navigate('/notes')}
          />
        </div>
      )}

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        note={selectedNote}
        onShared={refresh}
      />
    </div>
  );
};
