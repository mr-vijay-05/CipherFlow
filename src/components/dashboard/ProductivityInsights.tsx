import React from 'react';
import { Card } from '../common/Card';
import { FileText, Clock, TrendingUp, ArrowUpRight } from 'lucide-react';

export const ProductivityInsights: React.FC = () => {
  // Chart data matching reference visual balance
  const weekData = [
    { day: 'Mon', created: 25, edited: 55 },
    { day: 'Tue', created: 40, edited: 82 },
    { day: 'Wed', created: 105, edited: 70 },
    { day: 'Thu', created: 30, edited: 88 },
    { day: 'Fri', created: 20, edited: 62 },
    { day: 'Sat', created: 45, edited: 75 },
    { day: 'Sun', created: 18, edited: 35 },
  ];

  const maxVal = 110;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold text-slate-900 tracking-tight">
        Productivity Insights
      </h3>

      <Card padding="md" className="bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Chart area (Left: 8 cols) */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            {/* Legend */}
            <div className="flex items-center justify-end gap-5 mb-4 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-200"></span>
                <span>Notes Created</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span>Notes Edited</span>
              </div>
            </div>

            {/* Custom Bar Visualization */}
            <div className="relative flex items-end justify-between h-44 pt-4 pb-2 border-b border-slate-100">
              {/* Y Axis Guide Lines */}
              <div className="absolute inset-x-0 top-0 border-b border-dashed border-slate-100 flex items-center justify-between text-[10px] text-slate-300 pointer-events-none">
                <span>110</span>
              </div>
              <div className="absolute inset-x-0 top-1/3 border-b border-dashed border-slate-100 flex items-center justify-between text-[10px] text-slate-300 pointer-events-none">
                <span>86</span>
              </div>
              <div className="absolute inset-x-0 top-2/3 border-b border-dashed border-slate-100 flex items-center justify-between text-[10px] text-slate-300 pointer-events-none">
                <span>25</span>
              </div>

              {/* Bars per day */}
              <div className="w-full flex items-end justify-around gap-2 px-2 z-10">
                {weekData.map((item) => (
                  <div key={item.day} className="flex flex-col items-center gap-2 flex-1 group">
                    <div className="flex items-end gap-1.5 h-36">
                      {/* Created Bar (Light Blue) */}
                      <div
                        style={{ height: `${(item.created / maxVal) * 100}%` }}
                        className="w-2.5 sm:w-3.5 bg-blue-200 rounded-t-md group-hover:bg-blue-300 transition-all cursor-pointer relative"
                        title={`${item.day}: ${item.created} created`}
                      />
                      {/* Edited Bar (Primary Blue) */}
                      <div
                        style={{ height: `${(item.edited / maxVal) * 100}%` }}
                        className="w-2.5 sm:w-3.5 bg-blue-600 rounded-t-md group-hover:bg-blue-700 transition-all cursor-pointer relative"
                        title={`${item.day}: ${item.edited} edited`}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-700 transition-colors">
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Metrics Panel (4 cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between gap-3 lg:border-l lg:border-slate-100 lg:pl-6">
            {/* Stat 1 */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-slate-900 leading-tight">6</p>
                  <p className="text-[11px] text-slate-500 font-medium">Notes this week</p>
                </div>
              </div>
              <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" /> 20%
              </span>
            </div>

            {/* Stat 2 */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-slate-900 leading-tight">2.4h</p>
                  <p className="text-[11px] text-slate-500 font-medium">Time spent</p>
                </div>
              </div>
              <span className="inline-flex items-center text-xs font-bold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" /> 12%
              </span>
            </div>

            {/* Stat 3 */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Most active day</p>
                  <p className="text-sm font-bold text-emerald-600">Wednesday</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
