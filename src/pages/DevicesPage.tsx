import React, { useState, useEffect } from 'react';
import { deviceService } from '../services/deviceService';
import { Device } from '../types/security';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useToast } from '../hooks/useToast';
import { Laptop, Smartphone, Tablet, ShieldCheck, Ban, CheckCircle2, Shield } from 'lucide-react';

const DEVICE_ICONS = {
  desktop: Laptop,
  mobile: Smartphone,
  tablet: Tablet,
};

export const DevicesPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const { showToast } = useToast();

  const loadDevices = async () => {
    const list = await deviceService.getDevices();
    setDevices(list);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevoke = async (id: string, name: string) => {
    const success = await deviceService.revokeDevice(id);
    if (success) {
      showToast('Device Key Revoked', `Hardware key for "${name}" has been disabled.`, 'warning');
      loadDevices();
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Enrolled Devices
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Devices possessing client-side keypairs authorized to sync and decrypt your vault.
        </p>
      </div>

      <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Hardware-Backed Key Pairs</strong>: Each device creates a local private key stored in its Secure Enclave or protected IndexedDB keystore. Keys never sync unencrypted to cloud servers.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map(device => {
          const Icon = DEVICE_ICONS[device.type] || Laptop;

          return (
            <Card
              key={device.id}
              padding="md"
              className={`bg-white border flex flex-col justify-between ${
                device.isCurrent ? 'ring-2 ring-blue-500/30 border-blue-200' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {device.isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Current Device
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        device.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {device.status === 'active' ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{device.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{device.os} • {device.browser}</p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
                  <div className="flex justify-between">
                    <span>IP Address:</span>
                    <span className="font-mono text-slate-700">{device.ipAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Active:</span>
                    <span className="text-slate-700 font-medium">{device.lastActive}</span>
                  </div>
                  <div className="pt-1">
                    <span className="block text-slate-400">Key Fingerprint:</span>
                    <span className="font-mono text-[10px] text-slate-600 truncate block">
                      {device.keyFingerprint}
                    </span>
                  </div>
                </div>
              </div>

              {!device.isCurrent && device.status === 'active' && (
                <div className="pt-4 border-t border-slate-100 mt-4">
                  <Button
                    variant="danger"
                    size="sm"
                    className="w-full"
                    icon={<Ban className="w-3.5 h-3.5" />}
                    onClick={() => handleRevoke(device.id, device.name)}
                  >
                    Revoke Device
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
