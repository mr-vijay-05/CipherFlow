import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Note } from '../../types/note';
import {
  FileText,
  Pin,
  Star,
  MoreVertical,
  Users,
  Lock,
  Clock,
  Trash2,
  Share2
} from 'lucide-react';

export interface NoteCardProps {
  note: Note;
  viewMode?: 'grid' | 'list';
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
  onTogglePin?: (id: string, e: React.MouseEvent) => void;
  onShare?: (note: Note) => void;
  onTrash?: (id: string, e: React.MouseEvent) => void;
  onRestore?: (id: string, e: React.MouseEvent) => void;
  onDeletePermanent?: (id: string, e: React.MouseEvent) => void;
  isTrashView?: boolean;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  viewMode = 'grid',
  onToggleFavorite,
  onTogglePin,
  onShare,
  onTrash,
  onRestore,
  onDeletePermanent,
  isTrashView = false,
}) => {
  const navigate = useNavigate();

  if (viewMode === 'list') {
    return (
      <Card
        padding="none"
        className="p-3 sm:px-4 sm:py-3 hover:border-slate-300 hover:shadow-subtle transition-all cursor-pointer bg-white group"
        onClick={() => !isTrashView && navigate(`/notes/${note.id}`)}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 truncate transition-colors">
                  {note.title}
                </h4>
                {note.isPinned && (
                  <Pin className="w-3 h-3 text-blue-600 fill-blue-600 shrink-0 transform rotate-45" />
                )}
                {note.securityStatus === 'encrypted' && (
                  <Badge variant="encrypted" size="sm">Encrypted</Badge>
                )}
                {note.securityStatus === 'shared' && (
                  <Badge variant="shared" size="sm">Shared</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {note.description || note.content.substring(0, 80)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1">
              {note.tags.map(t => (
                <span key={t} className="text-[11px] text-blue-600 bg-blue-50/70 border border-blue-100 px-2 py-0.5 rounded-md font-medium">
                  #{t}
                </span>
              ))}
            </div>

            <span className="text-xs text-slate-400 font-medium">
              {note.updatedAt}
            </span>

            {isTrashView ? (
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                {onRestore && (
                  <button
                    onClick={e => onRestore(note.id, e)}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Restore
                  </button>
                )}
                {onDeletePermanent && (
                  <button
                    onClick={e => onDeletePermanent(note.id, e)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {onToggleFavorite && (
                  <button
                    onClick={e => onToggleFavorite(note.id, e)}
                    className="p-1 text-slate-400 hover:text-amber-500 transition-colors"
                  >
                    <Star className={`w-4 h-4 ${note.isFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={() => onShare(note)}
                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                {onTrash && (
                  <button
                    onClick={e => onTrash(note.id, e)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Grid View Card
  return (
    <Card
      padding="sm"
      className="bg-white hover:border-slate-300 hover:shadow-card-hover transition-all cursor-pointer flex flex-col justify-between group h-56"
      onClick={() => !isTrashView && navigate(`/notes/${note.id}`)}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            {note.securityStatus === 'encrypted' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <Lock className="w-3 h-3" /> Encrypted
              </span>
            )}
            {note.securityStatus === 'shared' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                <Users className="w-3 h-3" /> Shared
              </span>
            )}
          </div>

          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {!isTrashView && onTogglePin && (
              <button
                onClick={e => onTogglePin(note.id, e)}
                className={`p-1 rounded hover:bg-slate-100 transition-colors ${note.isPinned ? 'text-blue-600' : 'text-slate-400'}`}
                title="Pin Note"
              >
                <Pin className={`w-3.5 h-3.5 transform rotate-45 ${note.isPinned ? 'fill-blue-600' : ''}`} />
              </button>
            )}
            {!isTrashView && onToggleFavorite && (
              <button
                onClick={e => onToggleFavorite(note.id, e)}
                className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-amber-500"
                title="Favorite"
              >
                <Star className={`w-3.5 h-3.5 ${note.isFavorite ? 'text-amber-500 fill-amber-500' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 line-clamp-1 transition-colors">
          {note.title}
        </h4>

        {/* Excerpt */}
        <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
          {note.description || note.content.replace(/#|\*|`|-/g, '')}
        </p>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-100 mt-auto">
        <div className="flex items-center justify-between gap-2">
          {/* Tags */}
          <div className="flex items-center gap-1 overflow-hidden">
            {note.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium truncate">
                #{tag}
              </span>
            ))}
          </div>

          <span className="text-[11px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {note.updatedAt}
          </span>
        </div>
      </div>
    </Card>
  );
};
