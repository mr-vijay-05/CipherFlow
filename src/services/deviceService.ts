import { Device } from '../types/security';
import { INITIAL_DEVICES } from '../data/devices';

class DeviceService {
  private devices: Device[] = [...INITIAL_DEVICES];

  async getDevices(): Promise<Device[]> {
    return [...this.devices];
  }

  async revokeDevice(id: string): Promise<boolean> {
    const dev = this.devices.find(d => d.id === id);
    if (!dev) return false;
    dev.status = 'revoked';
    dev.lastActive = 'Revoked just now';
    return true;
  }
}

export const deviceService = new DeviceService();
