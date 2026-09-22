import React from 'react';
import { Card } from '../common/Card';
import { MetricData } from '../../types/user';
import { FileText, Users, Clock, Star, ArrowUpRight } from 'lucide-react';

const METRIC_ICONS = {
  FileText,
  Users,
  Clock,
  Star,
};

export interface MetricCardProps {
  metric: MetricData;
}

export const MetricCard: React.FC<MetricCardProps> = ({ metric }) => {
  const IconComponent = METRIC_ICONS[metric.iconName as keyof typeof METRIC_ICONS] || FileText;

  return (
    <Card padding="sm" className="hover:shadow-card-hover transition-all group">
      <div className="flex items-center gap-3.5">
        {/* Icon Container */}
        <div className="w-11 h-11 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform shrink-0">
          <IconComponent className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {metric.value}
            </span>
            {metric.change && metric.change !== '—' && (
              <span className="inline-flex items-center text-[11px] font-semibold text-emerald-600">
                <ArrowUpRight className="w-3 h-3" />
                {metric.change}
              </span>
            )}
            {metric.change === '—' && (
              <span className="text-xs text-slate-400 font-medium">—</span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
            {metric.label}
          </p>
        </div>
      </div>
    </Card>
  );
};
