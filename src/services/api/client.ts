/**
 * CipherFlow API Client
 * 
 * Handles authenticated communication with the FastAPI backend.
 * Plaintext note content NEVER passes through this client.
 * Only ciphertexts, wrapped keys, IVs, AAD, and metadata are transmitted.
 */

const getBaseUrl = (): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
      return (import.meta as any).env.VITE_API_URL;
    }
  } catch {
    // fallback
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getBaseUrl();

export interface ApiErrorResponse {
  detail: string | { msg: string; type: string }[];
  status: number;
  isConflict?: boolean;
}

export class ApiError extends Error {
  status: number;
  isConflict: boolean;
  details: any;

  constructor(status: number, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isConflict = status === 409;
    this.details = details;
  }
}

class ApiClient {
  private token: string | null = null;
  private readonly baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Load cached dev token if available
    try {
      if (typeof localStorage !== 'undefined') {
        this.token = localStorage.getItem('cipherflow_auth_token');
      }
    } catch {
      this.token = null;
    }
  }

  setToken(token: string | null): void {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('cipherflow_auth_token', token);
      } else {
        localStorage.removeItem('cipherflow_auth_token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    if (this.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: response.statusText };
        }

        const message = typeof errorData.detail === 'string'
          ? errorData.detail
          : (Array.isArray(errorData.detail) ? errorData.detail.map((e: any) => e.msg).join(', ') : 'Network request failed');

        throw new ApiError(response.status, message, errorData);
      }

      return await response.json() as T;
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      // Network or fetch failure (offline, connection refused)
      throw new ApiError(0, err instanceof Error ? err.message : 'Network error (Backend unavailable)');
    }
  }

  async get<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T>(endpoint: string, data?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async put<T>(endpoint: string, data?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async patch<T>(endpoint: string, data?: any, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async delete<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const apiClient = new ApiClient();
