import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { useToast } from '../hooks/useToast';
import { KeyRound, ShieldAlert, CheckCircle2, UserX, AlertTriangle, Shield } from 'lucide-react';

interface AccessEntry {
  id: string;
  collaboratorName: string;
  collaboratorEmail: string;
  noteTitle: string;
  role: 'Viewer' | 'Editor' | 'Admin';
  grantedAt: string;
  keyFingerprint: string;
  status: 'Active' | 'Revoked';
}

const INITIAL_ACCESS_ENTRIES: AccessEntry[] = [
  {
    id: 'acc-1',
    collaboratorName: 'Arjun Verma',
    collaboratorEmail: 'arjun@cipherflow.internal',
    noteTitle: 'Project Orion - Architecture',
    role: 'Editor',
    grantedAt: '2 days ago',
    keyFingerprint: 'SHA256:d8:21:4a:9f...',
    status: 'Active',
  },
  {
    id: 'acc-2',
    collaboratorName: 'Dr. Sarah Lin',
    collaboratorEmail: 'sarah.lin@college.edu',
    noteTitle: 'Research Ideas',
    role: 'Viewer',
    grantedAt: '1 week ago',
    keyFingerprint: 'SHA256:bb:30:19:ff...',
    status: 'Active',
  },
  {
    id: 'acc-3',
    collaboratorName: 'Priya Sharma',
    collaboratorEmail: 'priya@techco.io',
    noteTitle: 'Project Orion - Architecture',
    role: 'Viewer',
    grantedAt: '3 days ago',
    keyFingerprint: 'SHA256:44:c1:09:aa...',
    status: 'Active',
  },
  {
    id: 'acc-4',
    collaboratorName: 'Rohan Mehta',
    collaboratorEmail: 'rohan@enterprise.com',
    noteTitle: 'Quarterly Security Budget',
    role: 'Viewer',
    grantedAt: '2 weeks ago',
    keyFingerprint: 'SHA256:77:88:12:00...',
    status: 'Revoked',
  },
];

export const AccessManagementPage: React.FC = () => {
  const [entries, setEntries] = useState<AccessEntry[]>(INITIAL_ACCESS_ENTRIES);
  const [selectedEntry, setSelectedEntry] = useState<AccessEntry | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { showToast } = useToast();

  const handleOpenRevoke = (entry: AccessEntry) => {
    setSelectedEntry(entry);
    setIsConfirmOpen(true);
  };

  const handleConfirmRevoke = () => {
    if (!selectedEntry) return;

    setEntries(prev =>
      prev.map(e => (e.id === selectedEntry.id ? { ...e, status: 'Revoked' } : e))
    );

    showToast(
      'Access Grant Revoked',
      `Cryptographic certificate issued revoking ${selectedEntry.collaboratorName}. Note re-encryption scheduled.`,
      'warning'
    );
    setIsConfirmOpen(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Cryptographic Access Management
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Inspect and revoke wrapped key grants across all collaborative notes.
        </p>
      </div>

      <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Zero-Trust Revocation</strong>: When access is revoked, a revocation certificate is signed on your device. The note is immediately re-encrypted with a fresh symmetric key and re-wrapped only for remaining authorized recipients.
        </div>
      </div>

      {/* Table Card */}
      <Card padding="none" className="bg-white border-slate-200 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Collaborator</th>
                <th className="py-3 px-4">Target Note</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Key Fingerprint</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {entries.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{item.collaboratorName}</p>
                    <p className="text-[11px] text-slate-400">{item.collaboratorEmail}</p>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {item.noteTitle}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                      {item.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {item.keyFingerprint}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        item.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : null}
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.status === 'Active' ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleOpenRevoke(item)}
                        icon={<UserX className="w-3.5 h-3.5" />}
                      >
                        Revoke Access
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Revoke Cryptographic Access?"
        subtitle="This action will issue a revocation certificate and re-encrypt the note."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 leading-relaxed">
              Are you sure you want to revoke access from <strong>{selectedEntry?.collaboratorName}</strong> for note &ldquo;{selectedEntry?.noteTitle}&rdquo;? They will immediately lose decryption ability.
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmRevoke}>
              Confirm Revocation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
