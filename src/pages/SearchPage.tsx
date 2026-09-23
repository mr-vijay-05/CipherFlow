import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchService } from '../services/searchService';
import { useAuth } from '../context/AuthContext';
import { Note } from '../types/note';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/common/Card';
import { Search, Shield, RefreshCw } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { user } = useAuth();

  const [query, setQuery] = useState(initialQuery);
  const [selectedTag, setSelectedTag] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const doSearch = async () => {
      setLoading(true);
      try {
        const matchingNotes = await searchService.searchNotes(query, user.id);
        
        let filtered = matchingNotes;
        if (selectedTag) {
          filtered = filtered.filter(n => n.tags && n.tags.includes(selectedTag));
        }

        setResults(filtered);
      } catch (err) {
        console.warn('Search query error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(doSearch, 200);
    return () => clearTimeout(timer);
  }, [query, selectedTag, user.id]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Search
            </h1>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-600" />
              Encrypted search
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Search your encrypted notes using blind search tokens.
          </p>
        </div>

        {query.trim() && !loading && (
          <span className="text-xs text-slate-500 font-medium">
            {results.length} {results.length === 1 ? 'note' : 'notes'} found
          </span>
        )}
      </div>

      {/* Search Input Bar */}
      <Card padding="sm" className="bg-white">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Search encrypted notes by keyword or title..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Quick Tag Filter */}
          <div className="w-full sm:w-auto shrink-0">
            <select
              value={selectedTag}
              onChange={e => setSelectedTag(e.target.value)}
              className="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Tags</option>
              <option value="architecture">#architecture</option>
              <option value="research">#research</option>
              <option value="meeting">#meeting</option>
              <option value="orion">#orion</option>
              <option value="crypto">#crypto</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Results View */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="font-medium">Searching securely...</span>
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(note => (
            <NoteCard key={note.id} note={note} viewMode="grid" />
          ))}
        </div>
      ) : query.trim() ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-card text-center">
          <EmptyState
            icon={<Search className="w-8 h-8 text-slate-400" />}
            title="No matching encrypted notes."
            description={`No encrypted notes match "${query}". Try searching for another keyword or clear your filters.`}
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-subtle">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Ready to search</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Type any word above to search your encrypted vault. Query terms are converted to blind cryptographic tokens before evaluation.
          </p>
        </div>
      )}
    </div>
  );
};
