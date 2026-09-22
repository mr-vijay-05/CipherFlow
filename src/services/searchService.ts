import { Note } from '../types/note';
import { noteService } from './noteService';

export interface SearchFilter {
  query: string;
  tag?: string;
  spaceId?: string;
  securityStatus?: string;
}

class SearchService {
  /**
   * Search client-side mock notes.
   * Future Phase 2 will execute blind index trapdoor queries.
   */
  async searchEncryptedNotes(filters: SearchFilter): Promise<Note[]> {
    const allNotes = await noteService.getNotes();
    const q = filters.query.trim().toLowerCase();

    return allNotes.filter(note => {
      // Query match
      const matchesQuery = !q || 
        note.title.toLowerCase().includes(q) ||
        note.description.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.tags.some(t => t.toLowerCase().includes(q));

      // Tag filter
      const matchesTag = !filters.tag || note.tags.includes(filters.tag);

      // Space filter
      const matchesSpace = !filters.spaceId || note.spaceId === filters.spaceId;

      // Security status filter
      const matchesSecurity = !filters.securityStatus || note.securityStatus === filters.securityStatus;

      return matchesQuery && matchesTag && matchesSpace && matchesSecurity;
    });
  }
}

export const searchService = new SearchService();
