/**
 * CipherFlow Auth API
 * 
 * Manages development authentication tokens for FastAPI.
 */

import { apiClient } from './client';

export interface UserResponse {
  id: string;
  email: string;
  is_active: boolean;
}

export interface TokenResponse {
  accessToken: string;
  access_token?: string;
  tokenType: string;
  userId: string;
  email: string;
}

export async function loginDevToken(email: string = 'dev@cipherflow.com'): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/api/v1/auth/dev-token', { email });
  const token = response.accessToken || response.access_token;
  apiClient.setToken(token || null);
  return response;
}

export async function getCurrentUser(): Promise<UserResponse> {
  return apiClient.get<UserResponse>('/api/v1/auth/me');
}
