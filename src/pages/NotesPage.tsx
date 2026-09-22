import React, { useState, useMemo } from 'react';
import { useNotes } from '../hooks/useNotes';
import { NoteToolbar } from '../components/notes/NoteToolbar';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { ShareModal } from '../components/modals/ShareModal';
import { Note } from '../types/note';
import { FileText, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotesPage: React.FC = () => {
  const navigate = useNavigate();
  const { notes, toggleFavorite, togglePin, trashNote, refresh } = useNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Share modal
  const [shareNote, setShareNote] = useState<Note | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Extract unique tags
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => n.tags.forEach(t => set.add(t)));
    return Array.from(set);
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q);
      const matchTag = !selectedTag || n.tags.includes(selectedTag);
      return matchQuery && matchTag;
    });
  }, [notes, searchQuery, selectedTag]);

  const handleOpenShare = (note: Note) => {
    setShareNote(note);
    setIsShareOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Page Title Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          All Encrypted Notes
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Manage your sensitive documents, architecture drafts, and knowledge records.
        </p>
      </div>

      {/* Toolbar */}
      <NoteToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
        availableTags={availableTags}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalCount={filteredNotes.length}
      />

      {/* Notes Grid / List */}
      {filteredNotes.length > 0 ? (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-2.5'
          }
        >
          {filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              viewMode={viewMode}
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
            icon={<FileText className="w-7 h-7" />}
            title="No encrypted notes found"
            description={
              searchQuery || selectedTag
                ? 'Try adjusting your search query or tag filter.'
                : 'Your encrypted vault is empty. Create your first sensitive note.'
            }
            actionLabel="Create Note"
            actionIcon={<Plus className="w-4 h-4" />}
            onAction={() => navigate('/notes/new')}
          />
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        note={shareNote}
        onShared={refresh}
      />
    </div>
  );
};
