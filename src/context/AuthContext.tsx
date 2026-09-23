import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginDevToken } from '../services/api/authApi';
import { apiClient } from '../services/api/client';
import { identityKeyService } from '../crypto/identityKeys';
import { sharingService } from '../services/sharingService';
import { BRAND } from '../constants/brand';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarText: string;
  role: string;
  vaultUnlocked: boolean;
}

export const DEMO_PROFILES: Record<string, UserProfile> = {
  alice: {
    id: 'user-alice',
    email: 'alice@cipherflow.com',
    name: 'Alice Sterling',
    avatarText: 'AS',
    role: 'Cryptographic Systems Architect',
    vaultUnlocked: true,
  },
  bob: {
    id: 'user-bob',
    email: 'bob@cipherflow.com',
    name: 'Bob Chen',
    avatarText: 'BC',
    role: 'Security Reviewer & Collaborator',
    vaultUnlocked: true,
  },
  carol: {
    id: 'user-carol',
    email: 'carol@cipherflow.com',
    name: 'Carol Vance',
    avatarText: 'CV',
    role: 'Senior Security Analyst',
    vaultUnlocked: true,
  },
  dev: {
    id: 'user-dev',
    email: 'dev@cipherflow.com',
    name: BRAND.defaultUser.name,
    avatarText: BRAND.defaultUser.avatarText,
    role: BRAND.defaultUser.role,
    vaultUnlocked: true,
  },
};

export interface AuthContextType {
  user: UserProfile;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, passphrase?: string) => Promise<void>;
  loginAsDemo: (demoKey: 'alice' | 'bob' | 'carol' | 'dev') => Promise<void>;
  logout: () => void;
  lockVault: () => void;
  unlockVault: (passphrase: string) => Promise<boolean>;
}

const STORAGE_KEY_USER = 'cipherflow_auth_profile';
const STORAGE_KEY_TOKEN = 'cipherflow_auth_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEMO_PROFILES.dev;
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TOKEN);
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (token) {
      apiClient.setToken(token);
    }
  }, [token]);

  const login = async (email: string, passphrase?: string): Promise<void> => {
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const tokenRes = await loginDevToken(normalizedEmail);
      const jwtToken = tokenRes.accessToken || tokenRes.access_token || '';

      // Determine profile or synthesize one
      const demoKey = Object.keys(DEMO_PROFILES).find(
        k => DEMO_PROFILES[k].email.toLowerCase() === normalizedEmail
      );

      let profile: UserProfile;
      if (demoKey) {
        profile = { ...DEMO_PROFILES[demoKey], vaultUnlocked: true };
      } else {
        const username = normalizedEmail.split('@')[0];
        const initials = username.substring(0, 2).toUpperCase();
        profile = {
          id: `user-${username}`,
          email: normalizedEmail,
          name: username.charAt(0).toUpperCase() + username.slice(1),
          avatarText: initials,
          role: 'Vault Member',
          vaultUnlocked: true,
        };
      }

      // Persist state
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
      localStorage.setItem(STORAGE_KEY_TOKEN, jwtToken);
      apiClient.setToken(jwtToken);

      setUser(profile);
      setToken(jwtToken);

      // Initialize identity keys for this profile in background
      try {
        await identityKeyService.getOrInitializeIdentityKey(profile.id);
        await sharingService.ensureDemoIdentitiesInitialized();
      } catch (keyErr) {
        console.warn('Identity key bootstrap notice:', keyErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsDemo = async (demoKey: 'alice' | 'bob' | 'carol' | 'dev'): Promise<void> => {
    const target = DEMO_PROFILES[demoKey];
    if (target) {
      await login(target.email);
    }
  };

  const logout = (): void => {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    apiClient.setToken(null);
    setToken(null);
    setUser({
      ...DEMO_PROFILES.dev,
      vaultUnlocked: false,
    });
  };

  const lockVault = (): void => {
    setUser(prev => {
      const updated = { ...prev, vaultUnlocked: false };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      return updated;
    });
  };

  const unlockVault = async (passphrase: string): Promise<boolean> => {
    if (!passphrase || passphrase.length < 4) {
      return false;
    }
    setUser(prev => {
      const updated = { ...prev, vaultUnlocked: true };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
      return updated;
    });
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && user.vaultUnlocked,
        isLoading,
        login,
        loginAsDemo,
        logout,
        lockVault,
        unlockVault,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
