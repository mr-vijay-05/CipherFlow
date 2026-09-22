import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Note } from '../../types/note';
import {
  FileText,
  Code,
  Lightbulb,
  Heart,
  Plane,
  Pin,
  Star,
  MoreVertical,
  ArrowRight,
  Share2,
  Trash2,
  Lock
} from 'lucide-react';

const ICON_MAP = {
  file: FileText,
  code: Code,
  lightbulb: Lightbulb,
  heart: Heart,
  plane: Plane,
  book: FileText,
  users: FileText,
};

const COLOR_MAP = {
  file: 'bg-blue-50 text-blue-600 border-blue-100',
  code: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  lightbulb: 'bg-amber-50 text-amber-600 border-amber-100',
  heart: 'bg-rose-50 text-rose-500 border-rose-100',
  plane: 'bg-sky-50 text-sky-600 border-sky-100',
  book: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  users: 'bg-purple-50 text-purple-600 border-purple-100',
};

export interface RecentNotesProps {
  notes: Note[];
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  onShareNote?: (note: Note) => void;
  onTrashNote?: (id: string, e: React.MouseEvent) => void;
}

export const RecentNotes: React.FC<RecentNotesProps> = ({
  notes,
  onToggleFavorite,
  onTogglePin,
  onShareNote,
  onTrashNote,
}) => {
  const navigate = useNavigate();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const displayNotes = notes.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Header with View All */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          Recent Notes
        </h3>
        <Link
          to="/notes"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group transition-colors"
        >
          View all
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Notes List */}
      <div className="space-y-2">
        {displayNotes.map((note) => {
          const Icon = ICON_MAP[note.iconType || 'file'] || FileText;
          const colorClass = COLOR_MAP[note.iconType || 'file'] || COLOR_MAP.file;

          return (
            <Card
              key={note.id}
              padding="none"
              className="p-3.5 sm:px-4 sm:py-3 hover:border-slate-300 hover:shadow-subtle transition-all cursor-pointer relative group bg-white"
              onClick={() => navigate(`/notes/${note.id}`)}
            >
              <div className="flex items-center justify-between gap-3">
                {/* Left side: Icon, Title, Description, Tags */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colorClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 truncate transition-colors">
                        {note.title}
                      </h4>
                      {note.isPinned && (
                        <Pin className="w-3 h-3 text-blue-600 fill-blue-600 shrink-0 transform rotate-45" />
                      )}
                      {note.securityStatus === 'encrypted' && (
                        <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
                      {note.description}
                    </p>
                  </div>
                </div>

                {/* Tags (Desktop / Tablet) */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  {note.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[11px] font-medium text-blue-600 bg-blue-50/70 rounded-md border border-blue-100"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Right side: Timestamp & More Menu */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                    {note.updatedAt}
                  </span>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === note.id ? null : note.id);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      aria-label="Note options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Context Menu Dropdown */}
                    {activeMenuId === note.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-dropdown border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            setActiveMenuId(null);
                            onToggleFavorite(note.id, e);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Star className={`w-3.5 h-3.5 ${note.isFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                          {note.isFavorite ? 'Unfavorite' : 'Add to Favorites'}
                        </button>
                        <button
                          onClick={(e) => {
                            setActiveMenuId(null);
                            onTogglePin(note.id, e);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Pin className="w-3.5 h-3.5" />
                          {note.isPinned ? 'Unpin' : 'Pin to Top'}
                        </button>
                        {onShareNote && (
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              onShareNote(note);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Share2 className="w-3.5 h-3.5 text-blue-600" />
                            Share Encrypted Note
                          </button>
                        )}
                        <div className="border-t border-slate-100 my-1"></div>
                        {onTrashNote && (
                          <button
                            onClick={(e) => {
                              setActiveMenuId(null);
                              onTrashNote(note.id, e);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Move to Trash
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
