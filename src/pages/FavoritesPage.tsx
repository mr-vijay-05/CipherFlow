import React from 'react';
import { useNotes } from '../hooks/useNotes';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { Star } from 'lucide-react';

export const FavoritesPage: React.FC = () => {
  const { notes, toggleFavorite, togglePin, trashNote } = useNotes();
  const favoriteNotes = notes.filter(n => n.isFavorite);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Favorites
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Starred sensitive notes for immediate offline access.
        </p>
      </div>

      {favoriteNotes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {favoriteNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              viewMode="grid"
              onToggleFavorite={toggleFavorite}
              onTogglePin={togglePin}
              onTrash={trashNote}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-card">
          <EmptyState
            icon={<Star className="w-8 h-8" />}
            title="No favorite notes yet"
            description="Star any note by clicking its star icon to bookmark it here."
          />
        </div>
      )}
    </div>
  );
};
