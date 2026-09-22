import React, { useState, useEffect } from 'react';
import { noteService } from '../services/noteService';
import { Note } from '../types/note';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../hooks/useToast';
import { Trash2, AlertTriangle } from 'lucide-react';

export const TrashPage: React.FC = () => {
  const [trashedNotes, setTrashedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadTrash = async () => {
    setLoading(true);
    const data = await noteService.getNotes({ isTrashed: true });
    setTrashedNotes(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (id: string) => {
    const success = await noteService.restoreNote(id);
    if (success) {
      showToast('Note Restored', 'The note has been returned to your active vault.', 'success');
      loadTrash();
    }
  };

  const handleDeletePermanent = async (id: string) => {
    const success = await noteService.deletePermanently(id);
    if (success) {
      showToast('Permanently Deleted', 'Cryptographic keys for this note destroyed.', 'info');
      loadTrash();
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Trash
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Items in trash are marked for cryptographic shredding.
        </p>
      </div>

      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Permanently deleting an item destroys all local and wrapped key references.</span>
      </div>

      {trashedNotes.length > 0 ? (
        <div className="space-y-2.5">
          {trashedNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              viewMode="list"
              isTrashView={true}
              onRestore={() => handleRestore(note.id)}
              onDeletePermanent={() => handleDeletePermanent(note.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-card">
          <EmptyState
            icon={<Trash2 className="w-8 h-8" />}
            title="Trash is empty"
            description="No notes have been moved to the trash."
          />
        </div>
      )}
    </div>
  );
};
