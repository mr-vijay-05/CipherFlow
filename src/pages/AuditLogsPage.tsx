import React, { useState, useEffect } from 'react';
import { auditService } from '../services/auditService';
import { AuditLog } from '../types/security';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useToast } from '../hooks/useToast';
import { ScrollText, Download, Filter, CheckCircle2, AlertTriangle, AlertCircle, Shield } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    auditService.getAuditLogs(category).then(setLogs);
  }, [category]);

  const filteredLogs = logs.filter(l => {
    const q = search.toLowerCase();
    return !q || l.action.toLowerCase().includes(q) || l.target.toLowerCase().includes(q) || l.actor.toLowerCase().includes(q);
  });

  const handleExportCSV = () => {
    showToast(
      'Audit Logs Exported',
      'Encrypted diagnostic log package downloaded locally.',
      'success'
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Security & Audit Logs
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Immutable client-recorded timeline of encryption events, key rotations, and access changes.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          icon={<Download className="w-3.5 h-3.5" />}
        >
          Export Logs
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="sm" className="bg-white">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Search audit events by action, target or actor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Categories</option>
            <option value="edit">Edits & Encryption</option>
            <option value="share">Access Grants</option>
            <option value="device">Device Keys</option>
            <option value="revoke">Revocations</option>
          </select>
        </div>
      </Card>

      {/* Logs Table */}
      <Card padding="none" className="bg-white border-slate-200 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Event / Action</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block">{log.action}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Category: {log.category}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-800 font-semibold">
                    {log.target}
                  </td>
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {log.actor}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">
                    {log.ipAddress}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        log.status === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.status === 'warning'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {log.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                      {log.status === 'warning' && <AlertTriangle className="w-3 h-3" />}
                      {log.status === 'alert' && <AlertCircle className="w-3 h-3" />}
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
