import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useToast } from '../../hooks/useToast';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [sourceType, setSourceType] = useState<'markdown' | 'obsidian' | 'json'>('markdown');
  const [isImporting, setIsImporting] = useState(false);
  const { showToast } = useToast();

  const handleSimulateImport = () => {
    setIsImporting(true);
    setTimeout(() => {
      setIsImporting(false);
      showToast(
        'Import Simulated Successfully',
        `3 notes imported into your personal vault with local encryption.`,
        'success'
      );
      onImportComplete?.();
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Notes to Encrypted Vault"
      subtitle="Import existing knowledge bases with automatic client-side encryption."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Source format selection */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-2">
            Select Source Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'markdown', label: 'Markdown (.md)' },
              { id: 'obsidian', label: 'Obsidian Vault' },
              { id: 'json', label: 'JSON Export' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSourceType(item.id as any)}
                className={`p-3 text-xs font-medium rounded-xl border text-center transition-all ${
                  sourceType === item.id
                    ? 'border-blue-500 bg-blue-50/60 text-blue-700 font-semibold shadow-subtle'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Dropzone */}
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/20 transition-all cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Drag and drop files here, or <span className="text-blue-600 underline">browse</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Files will be parsed and encrypted locally before writing to vault storage.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSimulateImport}
            disabled={isImporting}
            icon={isImporting ? undefined : <FileText className="w-4 h-4" />}
          >
            {isImporting ? 'Encrypting & Importing...' : 'Import Files'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
