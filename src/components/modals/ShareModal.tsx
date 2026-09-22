import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Note } from '../../types/note';
import { sharingService } from '../../services/sharingService';
import { CollaboratorSearchResult } from '../../services/api/sharingApi';
import { useToast } from '../../hooks/useToast';
import {
  Shield,
  KeyRound,
  UserCheck,
  Mail,
  Users,
  Check,
  Search,
  SlidersHorizontal,
  Lock,
} from 'lucide-react';
import { ManageAccessModal } from '../sharing/ManageAccessModal';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  note?: Note | null;
  onShared?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  note,
  onShared,
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CollaboratorSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<CollaboratorSearchResult | null>(null);
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (query.trim().length >= 1) {
      const timer = setTimeout(async () => {
        const results = await sharingService.searchUsers(query.trim());
        setSearchResults(results);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [query]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) return;

    const targetUserId = selectedUser ? selectedUser.id : (query.includes('@') ? `user-${query.split('@')[0]}` : query);
    if (!targetUserId) return;

    setIsSubmitting(true);
    try {
      await sharingService.shareNoteWithRecipient(note.id, targetUserId, role);
      showToast(
        'Key Envelope Sealed',
        `Cryptographic access granted to ${targetUserId} as ${role.toUpperCase()}.`,
        'success'
      );
      setQuery('');
      setSelectedUser(null);
      onShared?.();
      onClose();
    } catch (err: any) {
      showToast('Sharing Failed', err?.message || 'Could not seal cryptographic envelope.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !isManageOpen}
        onClose={onClose}
        title="Share Encrypted Note"
        subtitle={note ? `Grant key access for: "${note.title}"` : 'Manage access grants'}
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Cryptographic Principle Banner */}
          <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-950 leading-relaxed">
              <strong>Cryptographic Key Envelope</strong>: We don't share the note itself. We share controlled cryptographic access to the note's encryption key.
            </div>
          </div>

          {/* Search / Recipient Input */}
          <form onSubmit={handleShare} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Recipient Email or User ID
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="e.g. bob@cipherflow.com or user-bob"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    if (selectedUser && selectedUser.email !== e.target.value) {
                      setSelectedUser(null);
                    }
                  }}
                  leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                  required
                />
              </div>

              {/* Search Suggestions */}
              {searchResults.length > 0 && !selectedUser && (
                <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100 z-10">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setQuery(user.email);
                      }}
                      className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{user.email}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{user.id}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        user.hasPublicKey
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {user.hasPublicKey ? 'Key Registered' : 'Pending Key'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Permission Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Access Level
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`cursor-pointer border rounded-xl p-2.5 flex items-center gap-2 transition-all ${
                  role === 'viewer'
                    ? 'border-blue-500 bg-blue-50/40 text-blue-950 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="viewer"
                    checked={role === 'viewer'}
                    onChange={() => setRole('viewer')}
                    className="sr-only"
                  />
                  <div className="text-xs">
                    <span className="block font-semibold">VIEWER</span>
                    <span className="text-[11px] text-slate-500">Read & verify only</span>
                  </div>
                </label>

                <label className={`cursor-pointer border rounded-xl p-2.5 flex items-center gap-2 transition-all ${
                  role === 'editor'
                    ? 'border-blue-500 bg-blue-50/40 text-blue-950 font-medium'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value="editor"
                    checked={role === 'editor'}
                    onChange={() => setRole('editor')}
                    className="sr-only"
                  />
                  <div className="text-xs">
                    <span className="block font-semibold">EDITOR</span>
                    <span className="text-[11px] text-slate-500">Read & encrypt updates</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsManageOpen(true)}
                icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
              >
                Manage Access ({note?.collaborators?.length || 0})
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || !query}
                icon={<KeyRound className="w-4 h-4" />}
              >
                {isSubmitting ? 'Sealing Envelope...' : 'Seal & Share Key'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Manage Access Modal */}
      {isManageOpen && (
        <ManageAccessModal
          isOpen={isManageOpen}
          onClose={() => setIsManageOpen(false)}
          note={note || null}
          onUpdated={onShared}
        />
      )}
    </>
  );
};
