import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { INITIAL_ACTIVITIES } from '../../data/activities';
import {
  FileEdit,
  UserPlus,
  Laptop,
  FilePlus,
  UserX,
  ArrowRight,
  Activity
} from 'lucide-react';

const ACTIVITY_ICONS = {
  edit: FileEdit,
  share: UserPlus,
  device: Laptop,
  create: FilePlus,
  revoke: UserX,
};

export const ActivityTimeline: React.FC = () => {
  return (
    <Card padding="sm" className="bg-white border-[#e8edf3] shadow-card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Recent Activity
          </h3>
        </div>
        <Link
          to="/audit-logs"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 group transition-colors"
        >
          View all
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Connected Timeline */}
      <div className="relative pl-6 space-y-4">
        {/* Continuous vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

        {INITIAL_ACTIVITIES.map((act) => {
          const Icon = ACTIVITY_ICONS[act.type] || FileEdit;

          return (
            <div key={act.id} className="relative flex items-start gap-3 group">
              {/* Timeline Node Icon */}
              <div
                className={`absolute -left-6 w-6 h-6 rounded-full border flex items-center justify-center bg-white shadow-subtle ${act.iconColor}`}
              >
                <Icon className="w-3 h-3" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight truncate">
                  {act.title}
                </p>
                <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                  {act.timestamp}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
