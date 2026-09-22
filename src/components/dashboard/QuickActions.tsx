import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Zap, Plus, Share2, UploadCloud, Users } from 'lucide-react';

export interface QuickActionsProps {
  onOpenShareModal: () => void;
  onOpenImportModal: () => void;
  onOpenNewSpaceModal: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onOpenShareModal,
  onOpenImportModal,
  onOpenNewSpaceModal,
}) => {
  const navigate = useNavigate();

  return (
    <Card padding="sm" className="bg-white border-[#e8edf3] shadow-card space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
          Quick Actions
        </h3>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* + New Note */}
        <button
          onClick={() => navigate('/notes/new')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-sm transition-all select-none"
        >
          <Plus className="w-4 h-4" />
          <span>New Note</span>
        </button>

        {/* Share a Note */}
        <button
          onClick={onOpenShareModal}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-subtle transition-all select-none"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Share a Note</span>
        </button>

        {/* Import Notes */}
        <button
          onClick={onOpenImportModal}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-subtle transition-all select-none"
        >
          <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
          <span>Import Notes</span>
        </button>

        {/* New Team Space */}
        <button
          onClick={onOpenNewSpaceModal}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-subtle transition-all select-none"
        >
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>New Team Space</span>
        </button>
      </div>
    </Card>
  );
};
