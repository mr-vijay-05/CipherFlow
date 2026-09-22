import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import { Search, LayoutGrid, List, Plus } from 'lucide-react';

export interface NoteToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTag: string;
  onTagChange: (tag: string) => void;
  availableTags: string[];
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  totalCount: number;
}

export const NoteToolbar: React.FC<NoteToolbarProps> = ({
  searchQuery,
  onSearchChange,
  selectedTag,
  onTagChange,
  availableTags,
  viewMode,
  onViewModeChange,
  totalCount,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-subtle mb-5">
      {/* Search & Filter */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter encrypted notes..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Tag Pill Filter */}
        <select
          value={selectedTag}
          onChange={e => onTagChange(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">All Tags</option>
          {availableTags.map(tag => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
      </div>

      {/* View Switcher & New Note */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
        <span className="text-xs font-medium text-slate-400">
          {totalCount} {totalCount === 1 ? 'note' : 'notes'}
        </span>

        {/* Grid vs List Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-lg text-slate-500 transition-colors ${viewMode === 'grid' ? 'bg-white shadow-xs text-blue-600' : 'hover:text-slate-800'}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 rounded-lg text-slate-500 transition-colors ${viewMode === 'list' ? 'bg-white shadow-xs text-blue-600' : 'hover:text-slate-800'}`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/notes/new')}
        >
          New Note
        </Button>
      </div>
    </div>
  );
};
