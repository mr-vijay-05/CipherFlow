import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useToast } from '../hooks/useToast';
import { BRAND } from '../constants/brand';
import { User, Shield, Sliders, Bell, HardDrive, Download, KeyRound, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'storage'>('profile');
  const [userName, setUserName] = useState<string>(BRAND.defaultUser.name);
  const [userEmail, setUserEmail] = useState<string>(BRAND.defaultUser.email);
  const [autoLockMinutes, setAutoLockMinutes] = useState('15');
  const { showToast } = useToast();

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Profile Updated', 'User profile saved locally.', 'success');
  };

  const handleExportKeyBackup = () => {
    showToast(
      'Encrypted Key Vault Exported',
      'Download complete. Store this paper backup offline in a secure location.',
      'success'
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Settings & Vault Preferences
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Configure client encryption behaviors, profile, and local vault parameters.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'security', label: 'Security & Enclave', icon: Shield },
          { id: 'preferences', label: 'Preferences', icon: Sliders },
          { id: 'storage', label: 'Storage', icon: HardDrive },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile */}
      {activeTab === 'profile' && (
        <Card padding="lg" className="bg-white">
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-extrabold text-lg flex items-center justify-center ring-4 ring-blue-100 shadow-sm">
                {BRAND.defaultUser.avatarText}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">{userName}</h4>
                <p className="text-xs text-slate-400">Vault Owner • Hardware Key Paired</p>
              </div>
            </div>

            <Input
              label="Full Name"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              type="email"
              value={userEmail}
              onChange={e => setUserEmail(e.target.value)}
              required
            />

            <div className="pt-2">
              <Button type="submit" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 2: Security & Enclave */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <Card padding="md" className="bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Auto-Lock Inactive Enclave</h4>
                <p className="text-xs text-slate-500">Flush decrypted key caches from RAM when computer is idle.</p>
              </div>
              <select
                value={autoLockMinutes}
                onChange={e => setAutoLockMinutes(e.target.value)}
                className="text-xs border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 font-medium"
              >
                <option value="5">After 5 minutes</option>
                <option value="15">After 15 minutes</option>
                <option value="60">After 1 hour</option>
                <option value="never">Never (Session only)</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Offline Master Key Paper Backup</h4>
                <p className="text-xs text-slate-500">Download a BIP39-compatible emergency recovery certificate.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportKeyBackup}
              >
                Download Key Backup
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Preferences */}
      {activeTab === 'preferences' && (
        <Card padding="md" className="bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Telemetry & Analytics</h4>
              <p className="text-xs text-slate-500">CipherFlow is strictly zero-telemetry by architectural design.</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Disabled Permanent
            </span>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Default Space for New Notes</h4>
              <p className="text-xs text-slate-500">Automatically partition freshly initialized notes.</p>
            </div>
            <select className="text-xs border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 font-medium">
              <option value="personal">Personal Vault</option>
              <option value="work">Work Space</option>
              <option value="college">College Space</option>
            </select>
          </div>
        </Card>
      )}

      {/* Tab 4: Storage */}
      {activeTab === 'storage' && (
        <Card padding="md" className="bg-white space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Vault Capacity Breakdown</h4>
            <p className="text-xs text-slate-500 mt-0.5">1.2 GB consumed of 10.0 GB encrypted quota.</p>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full w-[12%]"></div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="font-bold text-slate-900">920 MB</p>
              <p className="text-[11px] text-slate-400">Encrypted Notes</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="font-bold text-slate-900">308 MB</p>
              <p className="text-[11px] text-slate-400">Attachments</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="font-bold text-slate-900">8.8 GB</p>
              <p className="text-[11px] text-emerald-600">Available Space</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => showToast('Cache Cleared', 'Decrypted RAM cache cleared.', 'info')}
            >
              Clear Temporary Cache
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
