import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchService } from '../services/searchService';
import { Note } from '../types/note';
import { NoteCard } from '../components/notes/NoteCard';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/common/Card';
import { Search, Shield, Filter, Hash, Sparkles } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedSecurity, setSelectedSecurity] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const doSearch = async () => {
      setLoading(true);
      try {
        const res = await searchService.searchEncryptedNotes({
          query,
          tag: selectedTag || undefined,
          securityStatus: selectedSecurity || undefined,
        });
        setResults(res);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(doSearch, 150);
    return () => clearTimeout(timer);
  }, [query, selectedTag, selectedSecurity]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Encrypted Search
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Query your encrypted documents without exposing plaintext search tokens to the server.
        </p>
      </div>

      {/* Search Filter Controls Bar */}
      <Card padding="sm" className="bg-white">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Main search bar */}
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              placeholder="Search by keywords, tags, code snippets or title..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            {/* Tag filter */}
            <select
              value={selectedTag}
              onChange={e => setSelectedTag(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Tags</option>
              <option value="orion">#orion</option>
              <option value="architecture">#architecture</option>
              <option value="research">#research</option>
              <option value="meeting">#meeting</option>
              <option value="personal">#personal</option>
            </select>

            {/* Security filter */}
            <select
              value={selectedSecurity}
              onChange={e => setSelectedSecurity(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Security States</option>
              <option value="encrypted">Encrypted Only</option>
              <option value="shared">Shared Only</option>
              <option value="locked">Hardware Locked</option>
            </select>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Search tokens evaluated client-side. Server never observes query terms.</span>
          </div>
          <span className="font-semibold text-slate-600">{results.length} matches</span>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          Scanning encrypted local index...
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map(note => (
            <NoteCard key={note.id} note={note} viewMode="grid" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-card">
          <EmptyState
            icon={<Search className="w-8 h-8" />}
            title="No matching notes found"
            description={
              query
                ? `No encrypted notes matched your query "${query}". Try searching other keywords or clear your filters.`
                : 'Enter search terms above to search across your encrypted notes.'
            }
          />
        </div>
      )}
    </div>
  );
};
