import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { searchService } from '../../services/searchService';
import { Note } from '../../types/note';
import { Search, FileText, ArrowRight, Lock, Hash, Clock } from 'lucide-react';

export interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    const runSearch = async () => {
      setIsSearching(true);
      try {
        const found = await searchService.searchEncryptedNotes({ query });
        setResults(found);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(runSearch, 150);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleSelectNote = (id: string) => {
    onClose();
    navigate(`/notes/${id}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      showCloseButton={false}
    >
      <div className="space-y-3 -m-1">
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-slate-200 pb-3">
          <Search className="w-5 h-5 text-slate-400 absolute left-2" />
          <input
            autoFocus
            type="text"
            className="w-full pl-10 pr-12 py-2 text-base text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
            placeholder="Search your encrypted notes, tags, or content..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results / Suggestions */}
        <div className="max-h-80 overflow-y-auto pt-1 divide-y divide-slate-100">
          {results.length > 0 ? (
            results.map(note => (
              <div
                key={note.id}
                onClick={() => handleSelectNote(note.id)}
                className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors flex items-center justify-between group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 truncate transition-colors">
                        {note.title}
                      </h4>
                      {note.securityStatus === 'encrypted' && (
                        <Lock className="w-3 h-3 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {note.description || note.content.substring(0, 60)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {note.tags.map(t => (
                        <span key={t} className="text-[10px] text-blue-600 font-medium flex items-center">
                          <Hash className="w-2.5 h-2.5" />{t}
                        </span>
                      ))}
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{note.updatedAt}
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </div>
            ))
          ) : query ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No encrypted notes found matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              Type keywords, #tags, or topic names to search your vault.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Encrypted search mock: simulated client-side indexing</span>
          <span>Press ESC to exit</span>
        </div>
      </div>
    </Modal>
  );
};
