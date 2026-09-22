import { useState, useEffect, useCallback } from 'react';
import { Note } from '../types/note';
import { noteService } from '../services/noteService';
import { useToast } from './useToast';

export function useNotes(filter?: {
  spaceId?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  isTrashed?: boolean;
  tag?: string;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await noteService.getNotes(filter);
      setNotes(data);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  }, [filter?.spaceId, filter?.isFavorite, filter?.isPinned, filter?.isTrashed, filter?.tag]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const toggleFavorite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = await noteService.toggleFavorite(id);
    if (updated) {
      setNotes(prev => prev.map(n => (n.id === id ? updated : n)));
      showToast(
        updated.isFavorite ? 'Added to Favorites' : 'Removed from Favorites',
        `"${updated.title}" favorite status updated.`,
        'info'
      );
    }
  };

  const togglePin = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = await noteService.togglePin(id);
    if (updated) {
      setNotes(prev => prev.map(n => (n.id === id ? updated : n)));
      showToast(
        updated.isPinned ? 'Note Pinned' : 'Note Unpinned',
        `"${updated.title}" pin status updated.`,
        'info'
      );
    }
  };

  const trashNote = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const success = await noteService.trashNote(id);
    if (success) {
      setNotes(prev => prev.filter(n => n.id !== id));
      showToast('Moved to Trash', 'Note can be restored anytime from Trash.', 'warning');
    }
  };

  return {
    notes,
    loading,
    refresh: loadNotes,
    toggleFavorite,
    togglePin,
    trashNote,
  };
}
