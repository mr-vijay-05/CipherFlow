import React from 'react';
import { Card } from '../common/Card';
import { GraduationCap, Quote } from 'lucide-react';

export const QuoteCard: React.FC = () => {
  return (
    <Card
      padding="md"
      className="bg-white border-[#e8edf3] shadow-card relative overflow-hidden select-none"
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1 max-w-[80%]">
          <Quote className="w-5 h-5 text-blue-500/40 fill-blue-500/20 mb-1" />
          <p className="text-sm sm:text-base font-semibold text-slate-800 tracking-tight leading-snug">
            &ldquo;Encrypted notes.<br />Brighter ideas.&rdquo;
          </p>
        </div>

        {/* Decorative Badge Icon */}
        <div className="w-10 h-10 rounded-full bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-600 shadow-subtle shrink-0 self-end mt-4">
          <GraduationCap className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
};
