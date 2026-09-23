import React, { useState, useEffect, useCallback } from 'react';
import { auditService } from '../services/auditService';
import { AuditLog } from '../types/security';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useToast } from '../hooks/useToast';
import {
  ScrollText,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Shield,
  RefreshCw,
  Server,
  Laptop,
} from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const { showToast } = useToast();

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditService.getAuditLogs(category);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadLogs();
    const unsubscribe = auditService.subscribe(() => {
      loadLogs();
    });
    return unsubscribe;
  }, [loadLogs]);

  const filteredLogs = logs.filter(l => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.action.toLowerCase().includes(q) ||
      l.target.toLowerCase().includes(q) ||
      l.actor.toLowerCase().includes(q) ||
      l.ipAddress.toLowerCase().includes(q)
    );
  });

  const handleExportCSV = () => {
    if (logs.length === 0) {
      showToast('No Logs', 'No audit log entries to export.', 'info');
      return;
    }

    const headers = ['Event ID', 'Action', 'Target Resource', 'Local Timestamp (Browser)', 'Actor', 'IP Address', 'Status', 'Origin'];
    const rows = logs.map(l => [
      l.id,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.target.replace(/"/g, '""')}"`,
      `"${l.timestamp}"`,
      `"${l.actor}"`,
      `"${l.ipAddress}"`,
      l.status,
      l.isClientRecorded ? 'Client-Recorded' : 'Server-Authoritative',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cipherflow-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(
      'Audit Logs Exported',
      `${logs.length} authoritative audit records exported as CSV.`,
      'success'
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Security & Audit Logs
            </h2>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              IMMUTABLE AUDIT TRAIL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Cryptographically sealed server audit events and fail-closed client tamper records. Zero plaintext logged.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            disabled={loading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export Logs
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="sm" className="bg-white">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Search audit events by action, note, actor, or IP..."
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
            <option value="create">Note Initialization</option>
            <option value="edit">Edits & Re-encryptions</option>
            <option value="share">Access Grants</option>
            <option value="revoke">Revocations & Rekeying</option>
            <option value="security">Tamper & Security Failures</option>
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
                <th className="py-3 px-4">Timestamp (Browser Local)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Origin</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ScrollText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No audit events found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Create or edit notes, share with collaborators, or run security checks to populate the immutable audit trail.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{log.action}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Category: {log.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-semibold font-mono text-[11px]">
                      {log.target}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap" title={log.rawCreatedAt || log.timestamp}>
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {log.actor}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {log.ipAddress}
                    </td>
                    <td className="py-3 px-4">
                      {log.isClientRecorded ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Laptop className="w-3 h-3" /> Client-Recorded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Server className="w-3 h-3" /> Server-Verified
                        </span>
                      )}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
