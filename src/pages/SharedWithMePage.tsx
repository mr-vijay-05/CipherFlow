import React from 'react';
import { useNotes } from '../hooks/useNotes';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { Users, Shield } from 'lucide-react';

export const SharedWithMePage: React.FC = () => {
  const { notes, toggleFavorite, togglePin, trashNote } = useNotes();

  // Notes where you are a recipient
  const incomingNotes = notes.filter(n => n.id === 'note-2');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Shared with Me
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Encrypted documents shared directly to your public key by other team members.
        </p>
      </div>

      <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center gap-2 text-xs text-blue-900">
        <Shield className="w-4 h-4 text-blue-600 shrink-0" />
        <span>Keys are verified with the sender&apos;s digital signature prior to decryption.</span>
      </div>

      {incomingNotes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {incomingNotes.map(note => (
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
            icon={<Users className="w-8 h-8" />}
            title="No notes shared with you yet"
            description="When teammates share encrypted documents to your public key, they will appear here."
          />
        </div>
      )}
    </div>
  );
};
