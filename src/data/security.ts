import { SecurityOverview } from '../types/security';

export interface SecurityStatusItem {
  id: string;
  title: string;
  subtitle: string;
  status: 'verified' | 'active' | 'notice';
}

export const SECURITY_ITEMS: SecurityStatusItem[] = [
  {
    id: 'e2ee',
    title: 'End-to-End Encryption',
    subtitle: 'Your notes are encrypted on this device',
    status: 'verified',
  },
  {
    id: 'keys',
    title: 'Keys',
    subtitle: 'Client controlled',
    status: 'verified',
  },
  {
    id: 'server',
    title: 'Server',
    subtitle: 'Stores ciphertext only',
    status: 'verified',
  },
  {
    id: 'devices',
    title: 'Devices',
    subtitle: '2 active devices',
    status: 'verified',
  },
  {
    id: 'last-check',
    title: 'Last Security Check',
    subtitle: 'Today, 7:12 PM',
    status: 'verified',
  },
];

export const MOCK_SECURITY_OVERVIEW: SecurityOverview = {
  overallStatus: 'all_systems_secure',
  e2eeStatus: 'Hardware AES-256-GCM Enclave Enforced',
  keyStatus: 'ECDH-P256 Client-Generated',
  serverStatus: 'Zero plaintext note body in server storage (Blind ciphertext storage)',
  activeDevicesCount: 2,
  lastSecurityCheck: 'Today, 7:12 PM',
  storageUsedMB: 1228,
  storageTotalMB: 10240,
  clientVersion: 'v1.0.4-client (WebCrypto API ready)',
};
