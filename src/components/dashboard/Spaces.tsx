import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { Space } from '../../types/note';
import { User, GraduationCap, Briefcase, Folder, ChevronRight, ArrowRight } from 'lucide-react';

const SPACE_ICONS = {
  user: User,
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  folder: Folder,
  shield: User,
};

const SPACE_ICON_COLORS = {
  user: 'bg-purple-50 text-purple-600 border-purple-100',
  'graduation-cap': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  briefcase: 'bg-blue-50 text-blue-600 border-blue-100',
  folder: 'bg-amber-50 text-amber-600 border-amber-100',
  shield: 'bg-indigo-50 text-indigo-600 border-indigo-100',
};

export interface SpacesProps {
  spaces: Space[];
}

export const Spaces: React.FC<SpacesProps> = ({ spaces }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          Your Spaces
        </h3>
        <Link
          to="/spaces"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group transition-colors"
        >
          View all
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Grid of Spaces */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {spaces.map((space) => {
          const Icon = SPACE_ICONS[space.icon] || Folder;
          const colorClass = SPACE_ICON_COLORS[space.icon] || SPACE_ICON_COLORS.folder;

          return (
            <Card
              key={space.id}
              padding="sm"
              className="hover:border-slate-300 hover:shadow-subtle transition-all cursor-pointer group bg-white"
              onClick={() => navigate(`/spaces/${space.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${colorClass}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {space.name}
                    </h4>
                    <span className="text-xs text-slate-400 font-medium">
                      {space.noteCount} notes
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all mt-1" />
              </div>

              <p className="text-xs text-slate-500 mt-2.5 line-clamp-1 font-normal">
                {space.description}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
