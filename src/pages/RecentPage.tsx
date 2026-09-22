import React from 'react';
import { useNotes } from '../hooks/useNotes';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { Clock } from 'lucide-react';

export const RecentPage: React.FC = () => {
  const { notes, toggleFavorite, togglePin, trashNote } = useNotes();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Recently Modified Notes
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Notes sorted by most recent local write and cryptographic commit.
        </p>
      </div>

      {notes.length > 0 ? (
        <div className="space-y-2.5">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              viewMode="list"
              onToggleFavorite={toggleFavorite}
              onTogglePin={togglePin}
              onTrash={trashNote}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-card">
          <EmptyState
            icon={<Clock className="w-8 h-8" />}
            title="No recent notes"
            description="Notes you edit or inspect will appear here in chronological order."
          />
        </div>
      )}
    </div>
  );
};
