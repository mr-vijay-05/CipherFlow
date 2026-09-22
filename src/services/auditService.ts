import { AuditLog } from '../types/security';
import { INITIAL_AUDIT_LOGS } from '../data/auditLogs';

class AuditService {
  private logs: AuditLog[] = [...INITIAL_AUDIT_LOGS];

  async getAuditLogs(filterCategory?: string): Promise<AuditLog[]> {
    if (filterCategory && filterCategory !== 'all') {
      return this.logs.filter(l => l.category === filterCategory);
    }
    return [...this.logs];
  }

  async recordAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const now = new Date();
    const timeStr = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newEntry: AuditLog = {
      ...event,
      id: `aud-${Date.now()}`,
      timestamp: timeStr,
    };
    this.logs.unshift(newEntry);
    return newEntry;
  }
}

export const auditService = new AuditService();
