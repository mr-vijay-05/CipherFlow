import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spaceService } from '../services/spaceService';
import { Space } from '../types/note';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { NewSpaceModal } from '../components/modals/NewSpaceModal';
import {
  FolderKanban,
  User,
  GraduationCap,
  Briefcase,
  Plus,
  Lock,
  Users,
  ChevronRight
} from 'lucide-react';

const SPACE_ICONS = {
  user: User,
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  folder: FolderKanban,
  shield: Lock,
};

export const SpacesPage: React.FC = () => {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isNewSpaceOpen, setIsNewSpaceOpen] = useState(false);

  const loadSpaces = async () => {
    const list = await spaceService.getSpaces();
    setSpaces(list);
  };

  useEffect(() => {
    loadSpaces();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Team & Knowledge Spaces
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Isolated cryptographic partitions for personal, academic, and professional knowledge.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsNewSpaceOpen(true)}
        >
          New Space
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {spaces.map(space => {
          const Icon = SPACE_ICONS[space.icon] || FolderKanban;

          return (
            <Card
              key={space.id}
              padding="md"
              className="bg-white hover:border-slate-300 hover:shadow-card-hover transition-all cursor-pointer group flex flex-col justify-between"
              onClick={() => navigate(`/spaces/${space.id}`)}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      space.isPrivate
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}
                  >
                    {space.isPrivate ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {space.isPrivate ? 'Private Enclave' : 'Collaborative Space'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {space.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {space.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  {space.noteCount} encrypted notes
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Card>
          );
        })}
      </div>

      <NewSpaceModal
        isOpen={isNewSpaceOpen}
        onClose={() => setIsNewSpaceOpen(false)}
        onCreated={loadSpaces}
      />
    </div>
  );
};
