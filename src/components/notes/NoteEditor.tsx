import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Note } from '../../types/note';
import { noteService } from '../../services/noteService';
import { useToast } from '../../hooks/useToast';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  Lock,
  Users,
  CheckCircle2,
  Clock,
  Pin,
  Star,
  Share2,
  ArrowLeft,
  Bold,
  Italic,
  Heading2,
  Code,
  List,
  Link2,
  Eye,
  Edit3,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { syncService, OverallSyncState } from '../../services/syncService';
import { ShareModal } from '../modals/ShareModal';

export type SaveStatusState = 'Saved securely' | 'Encrypting locally...' | 'Saving...' | 'Encryption Error';

export interface NoteEditorProps {
  initialNote?: Note;
  isNew?: boolean;
  onOpenShareModal?: (note: Note) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  initialNote,
  isNew = false,
  onOpenShareModal,
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [title, setTitle] = useState(initialNote?.title || '');
  const [content, setContent] = useState(initialNote?.content || '');
  const [tags, setTags] = useState<string[]>(initialNote?.tags || ['general']);
  const [tagInput, setTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(initialNote?.isFavorite || false);
  const [isPinned, setIsPinned] = useState(initialNote?.isPinned || false);
  const [isPreview, setIsPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatusState>('Saved securely');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<OverallSyncState>(syncService.getState());
  const [hasConflict, setHasConflict] = useState<boolean>(false);
  const [isInternalShareOpen, setIsInternalShareOpen] = useState(false);

  const isViewer = initialNote?.userRole?.toUpperCase() === 'VIEWER';
  const isInitialMount = useRef(true);

  // Subscribe to cloud sync state
  useEffect(() => {
    const unsubscribe = syncService.subscribe((state, noteId) => {
      setCloudSyncState(state);
      if (initialNote) {
        setHasConflict(!!syncService.getConflict(initialNote.id));
      }
    });
    return unsubscribe;
  }, [initialNote]);

  // Auto-save handler with actual AES-256-GCM encryption
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (isNew) return; // For new notes, user explicitly clicks "Save Note"
    if (!initialNote) return;
    if (isViewer) return; // Viewers cannot commit updates

    setSaveStatus('Saving...');
    setErrorMessage(null);

    const timer = setTimeout(async () => {
      try {
        setSaveStatus('Encrypting locally...');
        await noteService.updateNote(initialNote.id, {
          title,
          content,
          tags,
          isFavorite,
          isPinned,
        });
        setSaveStatus('Saved securely');
      } catch (err: any) {
        setSaveStatus('Encryption Error');
        const msg = err?.message || 'Encryption failure: Note could not be securely saved.';
        setErrorMessage(msg);
        showToast('Encryption Failed', msg, 'error');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [title, content, tags, isFavorite, isPinned, isNew, initialNote]);

  const handleCreate = async () => {
    if (!title.trim()) {
      showToast('Title Required', 'Please enter a title for your note.', 'warning');
      return;
    }

    try {
      setSaveStatus('Encrypting locally...');
      setErrorMessage(null);

      const created = await noteService.createNote({
        title: title.trim(),
        description: content.substring(0, 90).replace(/\n/g, ' ') || 'Newly created encrypted note...',
        content,
        tags,
        isFavorite,
        isPinned,
        securityStatus: 'encrypted',
        iconType: 'file',
      });

      setSaveStatus('Saved securely');
      showToast('Encrypted & Saved', `"${created.title}" encrypted with AES-256-GCM in IndexedDB.`, 'success');
      navigate(`/notes/${created.id}`);
    } catch (err: any) {
      setSaveStatus('Encryption Error');
      const msg = err?.message || 'Client encryption failed: Note was not persisted to disk.';
      setErrorMessage(msg);
      showToast('Encryption Failure', msg, 'error');
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, '').toLowerCase();
      if (!tags.includes(clean)) {
        setTags([...tags, clean]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const insertFormat = (before: string, after: string = '') => {
    const textarea = document.getElementById('note-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end) || 'text';
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);
    setContent(newContent);
  };

  return (
    <div className="space-y-4">
      {/* Top Header Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-subtle">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Real Security Badge */}
            <Badge variant="encrypted" size="md">
              AES-256-GCM
            </Badge>

            {/* Sharing status badge */}
            {initialNote?.collaborators && initialNote.collaborators.length > 0 ? (
              <Badge variant="shared" size="md">
                Shared with {initialNote.collaborators.length} {initialNote.collaborators.length === 1 ? 'person' : 'people'}
              </Badge>
            ) : (
              <Badge variant="neutral" size="md">
                Private Vault
              </Badge>
            )}

            {/* Save state status */}
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                saveStatus === 'Saved securely'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : saveStatus === 'Encrypting locally...' || saveStatus === 'Saving...'
                  ? 'text-blue-700 bg-blue-50 border-blue-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200'
              }`}
            >
              {saveStatus === 'Saved securely' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              {(saveStatus === 'Encrypting locally...' || saveStatus === 'Saving...') && (
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              )}
              {saveStatus === 'Encryption Error' && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
              {saveStatus}
            </span>

            {/* Cloud Sync Status */}
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                cloudSyncState === 'synced'
                  ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                  : cloudSyncState === 'syncing'
                  ? 'text-blue-700 bg-blue-50 border-blue-200'
                  : cloudSyncState === 'saved_locally'
                  ? 'text-slate-700 bg-slate-50 border-slate-200'
                  : cloudSyncState === 'offline'
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200'
              }`}
            >
              {cloudSyncState === 'synced' && <Cloud className="w-3.5 h-3.5 text-indigo-600" />}
              {cloudSyncState === 'syncing' && <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
              {cloudSyncState === 'saved_locally' && <Clock className="w-3.5 h-3.5 text-slate-500" />}
              {cloudSyncState === 'offline' && <CloudOff className="w-3.5 h-3.5 text-amber-600" />}
              {cloudSyncState === 'conflict' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
              {cloudSyncState === 'synced' && 'Cloud synced'}
              {cloudSyncState === 'syncing' && 'Syncing...'}
              {cloudSyncState === 'saved_locally' && 'Queued for sync'}
              {cloudSyncState === 'offline' && 'Offline'}
              {cloudSyncState === 'conflict' && 'Sync Conflict'}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Preview / Edit Toggle */}
          <button
            onClick={() => setIsPreview(!isPreview)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            {isPreview ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {isPreview ? 'Edit' : 'Preview'}
          </button>

          {/* Pin toggle */}
          <button
            onClick={() => setIsPinned(!isPinned)}
            className={`p-2 rounded-xl border transition-colors ${
              isPinned
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'border-slate-200 text-slate-400 hover:text-slate-700'
            }`}
            title="Pin note"
          >
            <Pin className={`w-4 h-4 transform rotate-45 ${isPinned ? 'fill-blue-600' : ''}`} />
          </button>

          {/* Favorite toggle */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className={`p-2 rounded-xl border transition-colors ${
              isFavorite
                ? 'bg-amber-50 border-amber-200 text-amber-500'
                : 'border-slate-200 text-slate-400 hover:text-amber-500'
            }`}
            title="Favorite note"
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
          </button>

          {/* Share button */}
          {!isNew && initialNote && (
            <Button
              variant="outline"
              size="sm"
              icon={<Users className="w-3.5 h-3.5" />}
              onClick={() => onOpenShareModal ? onOpenShareModal(initialNote) : setIsInternalShareOpen(true)}
            >
              Share {initialNote.collaborators && initialNote.collaborators.length > 0 ? `(${initialNote.collaborators.length})` : ''}
            </Button>
          )}

          {/* Save if new */}
          {isNew && (
            <Button size="sm" variant="primary" onClick={handleCreate}>
              Save Note
            </Button>
          )}
        </div>
      </div>

      {/* Fail-Closed Error Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in duration-150">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong>Fail-Closed Cryptographic Protection</strong>: {errorMessage}
            <p className="text-[11px] text-rose-600 mt-0.5">Plaintext was not persisted to disk to prevent unencrypted exposure.</p>
          </div>
        </div>
      )}

      {/* Optimistic Concurrency Conflict Banner (Section 11 & 14) */}
      {hasConflict && initialNote && (
        <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-950">Cloud Version Divergence Detected (409 Conflict)</strong>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Another device updated this note, or local version diverged from the server. Choose how to reconcile:
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              onClick={async () => {
                await syncService.resolveWithRemote(initialNote.id);
                const reloaded = await noteService.getNoteById(initialNote.id);
                if (reloaded) {
                  setTitle(reloaded.title);
                  setContent(reloaded.content);
                  setTags(reloaded.tags);
                }
                setHasConflict(false);
                showToast('Cloud Version Restored', 'Replaced local note with latest encrypted cloud version.', 'info');
              }}
              className="px-3 py-1.5 font-medium bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl transition-colors shadow-xs"
            >
              Accept Cloud Version
            </button>
            <button
              onClick={async () => {
                await syncService.resolveWithLocal(initialNote.id);
                setHasConflict(false);
                showToast('Local Version Enforced', 'Overwriting cloud with current local edits.', 'success');
              }}
              className="px-3 py-1.5 font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors shadow-xs"
            >
              Overwrite Cloud with Local
            </button>
          </div>
        </div>
      )}

      {/* Viewer Read-Only Warning Banner */}
      {isViewer && (
        <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-2.5 text-xs text-slate-700 font-medium">
          <Eye className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            <strong className="text-slate-900">Read-Only Access (Viewer)</strong>: You possess cryptographic decryption capability for this note version, but your role does not authorize editing.
          </span>
        </div>
      )}

      {/* Editor Main Canvas */}
      <Card padding="none" className="bg-white border-slate-200/90 shadow-card overflow-hidden">
        {/* Formatting Toolbar */}
        {!isViewer && (
          <div className="flex items-center gap-1 p-2.5 px-4 bg-slate-50/80 border-b border-slate-200/80 flex-wrap">
            <button
              onClick={() => insertFormat('**', '**')}
              className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('*', '*')}
              className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('## ')}
              className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Heading"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1"></div>
            <button
              onClick={() => insertFormat('`', '`')}
              className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Code"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('- ')}
              className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Bullet list"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => insertFormat('[', '](https://)')}
              className="p-1.5 text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
              title="Link"
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Editor Body */}
        <div className="p-6 md:p-8 space-y-4">
          {/* Note Title Input */}
          <input
            type="text"
            placeholder="Note Title..."
            value={title}
            readOnly={isViewer}
            onChange={e => setTitle(e.target.value)}
            className={`w-full text-2xl md:text-3xl font-extrabold text-slate-900 placeholder:text-slate-300 focus:outline-none bg-transparent tracking-tight ${
              isViewer ? 'cursor-default' : ''
            }`}
          />

          {/* Tags row */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 pb-3 border-b border-slate-100">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50/70 border border-blue-100 rounded-lg"
              >
                #{tag}
                {!isViewer && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-800 font-bold ml-0.5"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {!isViewer && (
              <input
                type="text"
                placeholder="+ add tag and press enter"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="text-xs text-slate-600 placeholder:text-slate-400 bg-transparent focus:outline-none py-1 px-2 border-b border-transparent focus:border-blue-400"
              />
            )}
          </div>

          {/* Main content textarea / markdown preview */}
          {isPreview ? (
            <div className="prose prose-slate max-w-none min-h-[350px] py-2 text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800">
              {content || <span className="text-slate-400 italic">No content to preview.</span>}
            </div>
          ) : (
            <textarea
              id="note-textarea"
              rows={14}
              readOnly={isViewer}
              placeholder={isViewer ? 'Note content is read-only.' : 'Write your note with markdown support... (Content is protected with client-side AES-256-GCM encryption in IndexedDB)'}
              value={content}
              onChange={e => setContent(e.target.value)}
              className={`w-full text-sm leading-relaxed text-slate-800 placeholder:text-slate-300 focus:outline-none resize-y font-mono bg-transparent ${
                isViewer ? 'cursor-default opacity-90' : ''
              }`}
            />
          )}

          {/* Footer Metadata */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Encrypted locally with AES-256-GCM
            </span>
            <span>
              {content.trim() ? content.trim().split(/\s+/).length : 0} words
            </span>
          </div>
        </div>
      </Card>

      {/* Internal Share Modal */}
      {isInternalShareOpen && initialNote && (
        <ShareModal
          isOpen={isInternalShareOpen}
          onClose={() => setIsInternalShareOpen(false)}
          note={initialNote}
        />
      )}
    </div>
  );
};
