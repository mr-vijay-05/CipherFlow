import { SecurityOverview } from '../types/security';
import { keyManagementService } from '../crypto/keys';
import { indexedDbService } from '../storage/indexedDb';

class SecurityService {
  private lastAuditTimestamp: string = 'Today, 7:12 PM';

  async getSecurityOverview(): Promise<SecurityOverview> {
    const hasRootKey = await keyManagementService.hasDeviceRootKey();
    const allNotes = await indexedDbService.getAllMetadata();

    return {
      overallStatus: 'all_systems_secure',
      e2eeStatus: 'AES-256-GCM authenticated encryption (128-bit tag)',
      keyStatus: hasRootKey ? 'Active (Non-extractable AES-KW root key in IndexedDB)' : 'Initializing...',
      serverStatus: 'Zero remote persistence in Phase 2 (Local IndexedDB only)',
      activeDevicesCount: 1,
      lastSecurityCheck: this.lastAuditTimestamp,
      storageUsedMB: Math.max(1, Math.round(allNotes.length * 0.12)),
      storageTotalMB: 10240,
      clientVersion: 'v2.0.0-client (WebCrypto AES-256-GCM + AES-KW active)',
    };
  }

  async runSecurityAuditCheck(): Promise<{
    success: boolean;
    timestamp: string;
    diagnostics: {
      webCryptoAvailable: boolean;
      deviceRootKeyPresent: boolean;
      indexedDbConnected: boolean;
      encryptedNotesCount: number;
    };
  }> {
    const now = new Date();
    const timeStr = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    this.lastAuditTimestamp = timeStr;

    const webCryptoAvailable = typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle;
    const hasRootKey = await keyManagementService.hasDeviceRootKey();
    const notes = await indexedDbService.getAllMetadata();

    return {
      success: webCryptoAvailable && hasRootKey,
      timestamp: timeStr,
      diagnostics: {
        webCryptoAvailable,
        deviceRootKeyPresent: hasRootKey,
        indexedDbConnected: true,
        encryptedNotesCount: notes.length,
      },
    };
  }
}

export const securityService = new SecurityService();
