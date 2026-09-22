export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarText: string;
  role: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface MetricData {
  id: string;
  label: string;
  value: number | string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  iconName: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  target?: string;
  timestamp: string;
  type: 'edit' | 'share' | 'device' | 'create' | 'revoke';
  iconColor: string;
}
