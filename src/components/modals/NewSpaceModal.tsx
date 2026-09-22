import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { spaceService } from '../../services/spaceService';
import { useToast } from '../../hooks/useToast';
import { FolderKanban, Lock, Users, Sparkles } from 'lucide-react';

export interface NewSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const NewSpaceModal: React.FC<NewSpaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [icon, setIcon] = useState<'user' | 'graduation-cap' | 'briefcase' | 'folder' | 'shield'>('folder');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await spaceService.createSpace({
        name: name.trim(),
        description: description.trim() || 'Custom collaborative knowledge partition',
        isPrivate,
        icon,
      });
      showToast(
        'Team Space Created',
        `Space "${name}" initialized with separate encryption key enclave.`,
        'success'
      );
      setName('');
      setDescription('');
      onCreated?.();
      onClose();
    } catch (err) {
      showToast('Error', 'Failed to create team space.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Space"
      subtitle="Partition notes into encrypted boundaries for teams or topics."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Space Name"
          placeholder="e.g. Distributed Security Research"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Description</label>
          <textarea
            rows={2}
            className="w-full rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Briefly describe the purpose of this space..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Access Model */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-2">Access & Privacy Model</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsPrivate(true)}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                isPrivate
                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Personal Vault</p>
                <p className="text-[11px] text-slate-500 font-normal">Encrypted strictly with device master key</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsPrivate(false)}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                !isPrivate
                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-semibold'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Team Space</p>
                <p className="text-[11px] text-slate-500 font-normal">Shared symmetric key wrapped per member</p>
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={isSubmitting || !name.trim()}
            icon={<Sparkles className="w-4 h-4" />}
          >
            {isSubmitting ? 'Creating Space...' : 'Create Space'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
