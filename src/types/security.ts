export interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
  ipAddress: string;
  lastActive: string;
  isCurrent: boolean;
  status: 'active' | 'revoked';
  keyFingerprint: string;
}

export interface AuditLog {
  id: string;
  action: string;
  target: string;
  timestamp: string;
  category: 'edit' | 'share' | 'device' | 'auth' | 'security' | 'revoke' | 'create';
  actor: string;
  ipAddress: string;
  status: 'success' | 'warning' | 'alert';
}

export interface SecurityOverview {
  overallStatus: 'all_systems_secure' | 'attention_needed' | 'critical';
  e2eeStatus: string;
  keyStatus: string;
  serverStatus: string;
  activeDevicesCount: number;
  lastSecurityCheck: string;
  storageUsedMB: number;
  storageTotalMB: number;
  clientVersion: string;
}
