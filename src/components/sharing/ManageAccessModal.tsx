import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Note, Collaborator } from '../../types/note';
import { sharingService } from '../../services/sharingService';
import { RemoteShareRecord } from '../../services/api/sharingApi';
import { useToast } from '../../hooks/useToast';
import {
  Shield,
  ShieldAlert,
  KeyRound,
  RotateCw,
  Trash2,
  Users,
  AlertTriangle,
  History,
  Lock,
} from 'lucide-react';

export interface ManageAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note | null;
  onUpdated?: () => void;
}

export const ManageAccessModal: React.FC<ManageAccessModalProps> = ({
  isOpen,
  onClose,
  note,
  onUpdated,
}) => {
  const [shares, setShares] = useState<RemoteShareRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadShares = async () => {
    if (!note) return;
    setIsLoading(true);
    try {
      const res = await sharingService.listNoteShares(note.id);
      setShares(res);
    } catch {
      // fallback to note.collaborators if server offline
      if (note.collaborators) {
        setShares(
          note.collaborators.map(c => ({
            id: c.id,
            noteId: note.id,
            ownerId: 'owner',
            recipientId: c.id,
            role: c.role.toUpperCase() as any,
            status: 'ACTIVE',
            createdAt: c.grantedAt,
            updatedAt: c.grantedAt,
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && note) {
      loadShares();
    }
  }, [isOpen, note?.id]);

  const handleRoleChange = async (recipientId: string, newRole: 'viewer' | 'editor') => {
    if (!note) return;
    setUpdatingUserId(recipientId);
    try {
      await sharingService.updateCollaboratorRole(note.id, recipientId, newRole);
      showToast(
        'Permission Updated',
        `Role changed to ${newRole.toUpperCase()} for ${recipientId}.`,
        'success'
      );
      await loadShares();
      onUpdated?.();
    } catch (err) {
      showToast('Update Failed', 'Could not update collaborator role.', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRevoke = async (recipientId: string) => {
    if (!note) return;
    setRevokingUserId(recipientId);
    try {
      const res = await sharingService.revokeAccess(note.id, recipientId);
      showToast(
        'Access Cryptographically Revoked',
        `Generated fresh AES-256-GCM note key (v${res.newVersion}). Revoked user has NO envelope for this version.`,
        'warning'
      );
      await loadShares();
      onUpdated?.();
    } catch (err: any) {
      showToast('Revocation Failed', err?.message || 'Could not complete cryptographic rekey.', 'error');
    } finally {
      setRevokingUserId(null);
    }
  };

  const activeShares = shares.filter(s => s.status === 'ACTIVE');
  const revokedShares = shares.filter(s => s.status === 'REVOKED');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cryptographic Access Control"
      subtitle={note ? `Access list for "${note.title}"` : 'Manage grants and revocation'}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Core Cryptographic Principle Banner */}
        <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-start gap-3 shadow-sm">
          <KeyRound className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-100">Zero Server-Side Plaintext Sharing</p>
            <p className="text-slate-300 leading-relaxed">
              We don't share the note itself. We share controlled cryptographic access to the note's encryption key via ECDH-P256 sealed envelopes.
            </p>
          </div>
        </div>

        {/* Cryptographic Revocation Reality Warning Banner (CRITICAL LANGUAGE) */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong className="text-amber-950 font-semibold block mb-0.5">Revocation Boundary Notice</strong>
            Revoking access performs automatic cryptographic rekeying (K2) and prevents future access to newly protected versions. It cannot erase plaintext that a recipient has already viewed, copied, exported, or captured.
          </div>
        </div>

        {/* Active Grants */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              Active Key Grants ({activeShares.length})
            </h4>
            <span className="text-[11px] text-slate-500">
              AES-256-GCM Note Key Sealed per Peer
            </span>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {activeShares.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No active external collaborators. Only your device holds the wrapped note key.
              </div>
            ) : (
              activeShares.map(share => (
                <div key={share.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {share.recipientId}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Granted: {new Date(share.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={share.role.toLowerCase()}
                      disabled={updatingUserId === share.recipientId || revokingUserId === share.recipientId}
                      onChange={e => handleRoleChange(share.recipientId, e.target.value as any)}
                      className="text-xs rounded-lg border border-slate-200 bg-white text-slate-800 py-1 px-2.5 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="viewer">VIEWER (Read-only)</option>
                      <option value="editor">EDITOR (Read & Write)</option>
                    </select>

                    <Button
                      variant="danger"
                      size="sm"
                      disabled={revokingUserId === share.recipientId}
                      onClick={() => handleRevoke(share.recipientId)}
                      className="text-xs flex items-center gap-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200"
                    >
                      {revokingUserId === share.recipientId ? (
                        <>
                          <RotateCw className="w-3 h-3 animate-spin" />
                          Rekeying...
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3 h-3" />
                          Revoke & Rekey
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Revoked Recipients / Audit History */}
        {revokedShares.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5 text-slate-500" />
              Revoked Recipients ({revokedShares.length})
            </h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              {revokedShares.map(share => (
                <div key={share.id} className="p-2.5 flex items-center justify-between text-xs text-slate-500">
                  <div>
                    <span className="font-medium text-slate-700 line-through mr-2">
                      {share.recipientId}
                    </span>
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-semibold px-1.5 py-0.5 rounded">
                      REVOKED
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Revoked {share.revokedAt ? new Date(share.revokedAt).toLocaleDateString() : 'Previously'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
