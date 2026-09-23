import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Note } from '../types/note';
import { noteService } from '../services/noteService';
import { NoteEditor } from '../components/notes/NoteEditor';
import { ShareModal } from '../components/modals/ShareModal';
import { EmptyState } from '../components/common/EmptyState';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NoteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchNote = async () => {
      setLoading(true);
      setError(null);
      try {
        const found = await noteService.getNoteById(id);
        setNote(found);
      } catch (err: any) {
        console.error(`[NoteDetail] Error loading note "${id}":`, err);
        setError(err?.message || 'Decryption failed: cryptographic integrity check failed.');
      } finally {
        setLoading(false);
      }
    };
    fetchNote();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-medium">Decrypting note payload locally...</p>
      </div>
    );
  }

  if (error) {
    const isTamper = error.toLowerCase().includes('tag mismatch') || 
                    error.toLowerCase().includes('corrupted') || 
                    error.toLowerCase().includes('integrity') ||
                    error.toLowerCase().includes('authentication') ||
                    error.toLowerCase().includes('aad');

    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className={`bg-white rounded-2xl border ${isTamper ? 'border-rose-300' : 'border-slate-200'} p-8 shadow-card`}>
          <EmptyState
            icon={<FileQuestion className="w-8 h-8 text-rose-500" />}
            title={isTamper ? "Cryptographic Integrity Alert: Decryption Failed" : "Decryption Error"}
            description={
              isTamper
                ? `Fail-Closed Security Boundary: WebCrypto AES-256-GCM message authentication tag rejected this note's ciphertext/IV/AAD. Plaintext content is permanently shielded. Error: ${error}`
                : `Could not decrypt this note payload: ${error}`
            }
            actionLabel="Back to All Notes"
            actionIcon={<ArrowLeft className="w-4 h-4" />}
            onAction={() => navigate('/notes')}
          />
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-card">
          <EmptyState
            icon={<FileQuestion className="w-8 h-8" />}
            title="Note Not Found"
            description="The requested encrypted note does not exist or may have been permanently removed."
            actionLabel="Back to All Notes"
            actionIcon={<ArrowLeft className="w-4 h-4" />}
            onAction={() => navigate('/notes')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <NoteEditor
        key={note.id}
        initialNote={note}
        isNew={false}
        onOpenShareModal={() => setIsShareOpen(true)}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        note={note}
        onShared={async () => {
          if (id) {
            const updated = await noteService.getNoteById(id);
            setNote(updated);
          }
        }}
      />
    </div>
  );
};
