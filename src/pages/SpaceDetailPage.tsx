import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { spaceService } from '../services/spaceService';
import { useNotes } from '../hooks/useNotes';
import { Space } from '../types/note';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { ArrowLeft, FolderKanban, Plus, Lock } from 'lucide-react';

export const SpaceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [space, setSpace] = useState<Space | null>(null);
  const { notes, toggleFavorite, togglePin, trashNote } = useNotes({ spaceId: id });

  useEffect(() => {
    if (!id) return;
    spaceService.getSpaceById(id).then(res => setSpace(res));
  }, [id]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/spaces')}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          aria-label="Back to Spaces"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {space?.name || 'Space'}
            </h2>
            {space?.isPrivate && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                <Lock className="w-3 h-3" /> Private
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {space?.description || 'Encrypted knowledge partition.'}
          </p>
        </div>
      </div>

      {notes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
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
            icon={<FolderKanban className="w-8 h-8" />}
            title="No notes in this space"
            description="Create your first encrypted note in this partition."
            actionLabel="Create Note in Space"
            actionIcon={<Plus className="w-4 h-4" />}
            onAction={() => navigate('/notes/new')}
          />
        </div>
      )}
    </div>
  );
};
