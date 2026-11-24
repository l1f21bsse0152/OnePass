import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'onepass_auth_token';
const USER_KEY = 'onepass_user_data';

// Override this for a physical device or a deployed API.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api';
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

class ApiError extends Error {
  statusCode: number;
  errors?: string[];

  constructor(message: string, statusCode = 400, errors?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
  skipAuth?: boolean;
  multipart?: boolean;
}

/**
 * Storage helpers using expo-secure-store
 */
export const storage = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (e) {
      console.warn('Failed to save auth token to SecureStore:', e);
    }
  },

  async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (e) {
      console.warn('Failed to remove auth token from SecureStore:', e);
    }
  },

  async getUser<T>(): Promise<T | null> {
    try {
      const data = await SecureStore.getItemAsync(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setUser<T>(user: T): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user data to SecureStore:', e);
    }
  },

  async removeUser(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (e) {
      console.warn('Failed to remove user data from SecureStore:', e);
    }
  },
};

/**
 * Core HTTP Request Wrapper
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    params,
    skipAuth = false,
    multipart = false,
    headers = {},
    ...customConfig
  } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const requestHeaders: Record<string, string> = {
    ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
    Accept: 'application/json',
    'X-OnePass-Device-Type': 'mobile',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await storage.getToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...customConfig,
      headers: requestHeaders,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        data.message || 'An unexpected server error occurred.',
        response.status,
        data.errors
      );
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or connectivity issue
    throw new ApiError(
      error.message || 'Unable to connect to OnePass server. Check your connection.',
      0
    );
  }
}

export { ApiError };
