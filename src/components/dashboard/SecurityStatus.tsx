import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../common/Card';
import { SECURITY_ITEMS } from '../../data/security';
import { ShieldCheck, CheckCircle2, ChevronRight } from 'lucide-react';

export const SecurityStatus: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card
      padding="sm"
      className="bg-white border-[#e8edf3] shadow-card hover:border-slate-300 transition-all cursor-pointer group"
      onClick={() => navigate('/security')}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              Security Status
            </h3>
            <p className="text-xs font-bold text-emerald-600">
              All systems secure
            </p>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
      </div>

      {/* Security Checklist Items */}
      <div className="pt-3 space-y-2.5">
        {SECURITY_ITEMS.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5">
            <div className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 fill-emerald-600 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {item.title}
              </p>
              <p className="text-[11px] text-slate-500 font-normal leading-tight mt-0.5">
                {item.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
