
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { apiRequest, storage, ApiError } from '../services/api';
import {
  assertTravelerRole,
  isTravelerRole,
  MOBILE_ROLE_ACCESS_MESSAGE,
} from '../utils/mobileRoleAccess';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'traveler' | 'facility' | 'admin';
  isEmailVerified?: boolean;
  phoneNumber?: string | null;
  city?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  emergencyContact?: {
    name: string;
    phoneNumber: string;
    relationship: string;
  } | null;
  profilePhotoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    tokenType: string;
    expiresIn: string;
    user: User;
  };
}

type GoogleSignInResult =
  | { requiresOtp: true; email: string }
  | { requiresOtp: false };

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleSignIn: (idToken: string) => Promise<GoogleSignInResult>;
  register: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<{ email: string; expiresIn: string }>;
  verifyRegistrationOtp: (email: string, otp: string) => Promise<User>;
  verifyGoogleRegistrationOtp: (email: string, otp: string) => Promise<User>;
  resendRegistrationOtp: (
    email: string
  ) => Promise<{ email: string; expiresIn: string }>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (payload: {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from SecureStore on startup
  useEffect(() => {
    async function restoreSession() {
      try {
        const savedToken = await storage.getToken();
        const savedUser = await storage.getUser<User>();

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(savedUser);

          // Verify token validity in background
          try {
            const profileRes = await apiRequest<{
              success: boolean;
              data: { user: User };
            }>('/auth/me', {
              headers: { Authorization: `Bearer ${savedToken}` },
            });

            if (profileRes?.data?.user) {
              setUser(profileRes.data.user);
              await storage.setUser(profileRes.data.user);
            }
          } catch (e: any) {
            if (e instanceof ApiError && e.statusCode === 401) {
              await storage.removeToken();
              await storage.removeUser();
              setToken(null);
              setUser(null);
            }
          }
        }
      } catch (err) {
        console.warn('Session restoration failed:', err);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
      skipAuth: true,
    });

    const authToken = res.data.token;
    const authUser = res.data.user;
    assertTravelerRole(authUser.role);

    await storage.setToken(authToken);
    await storage.setUser(authUser);

    setToken(authToken);
    setUser(authUser);
  }, []);

  const googleSignIn = useCallback(
    async (idToken: string): Promise<GoogleSignInResult> => {
      const res = await apiRequest<{
        success: boolean;
        data:
          | { requiresOtp: true; email: string }
          | {
              requiresOtp?: false;
              token: string;
              user: User;
            };
      }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
        skipAuth: true,
      });

      if (res.data.requiresOtp) {
        return {
          requiresOtp: true,
          email: res.data.email,
        };
      }

      if (!res.data.token || !res.data.user) {
        throw new Error('Google sign-in returned an invalid response.');
      }
      assertTravelerRole(res.data.user.role);

      await storage.setToken(res.data.token);
      await storage.setUser(res.data.user);
      setToken(res.data.token);
      setUser(res.data.user);

      return { requiresOtp: false };
    },
    []
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const res = await apiRequest<{
        success: boolean;
        message: string;
        data: { email: string; expiresIn: string };
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
        skipAuth: true,
      });

      return res.data;
    },
    []
  );

  const verifyRegistrationOtp = useCallback(
    async (email: string, otp: string) => {
      const res = await apiRequest<{
        success: boolean;
        data: { user: User };
      }>('/auth/verify-registration-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
        }),
        skipAuth: true,
      });

      return res.data.user;
    },
    []
  );

  const verifyGoogleRegistrationOtp = useCallback(
    async (email: string, otp: string) => {
      const res = await apiRequest<AuthResponse>(
        '/auth/google/verify-registration-otp',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp: otp.trim(),
          }),
          skipAuth: true,
        }
      );

      assertTravelerRole(res.data.user.role);
      await storage.setToken(res.data.token);
      await storage.setUser(res.data.user);
      setToken(res.data.token);
      setUser(res.data.user);

      return res.data.user;
    },
    []
  );

  const resendRegistrationOtp = useCallback(async (email: string) => {
    const res = await apiRequest<{
      success: boolean;
      message: string;
      data: { email: string; expiresIn: string };
    }>('/auth/resend-registration-otp', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
      }),
      skipAuth: true,
    });

    return res.data;
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const res = await apiRequest<{
      success: boolean;
      message: string;
    }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
      }),
      skipAuth: true,
    });

    return res.message;
  }, []);

  const resetPassword = useCallback(
    async (payload: {
      email: string;
      otp: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      await apiRequest<{ success: boolean; message: string }>(
        '/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            email: payload.email.trim().toLowerCase(),
            otp: payload.otp.trim(),
            newPassword: payload.newPassword,
            confirmPassword: payload.confirmPassword,
          }),
          skipAuth: true,
        }
      );
    },
    []
  );

  const logout = useCallback(async () => {
    await storage.removeToken();
    await storage.removeUser();
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return;

    const res = await apiRequest<{
      success: boolean;
      data: { user: User };
    }>('/auth/me');

    if (res?.data?.user) {
      if (!isTravelerRole(res.data.user.role)) {
        await logout();
        throw new Error(MOBILE_ROLE_ACCESS_MESSAGE);
      }
      setUser(res.data.user);
      await storage.setUser(res.data.user);
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        googleSignIn,
        register,
        verifyRegistrationOtp,
        verifyGoogleRegistrationOtp,
        resendRegistrationOtp,
        forgotPassword,
        resetPassword,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
