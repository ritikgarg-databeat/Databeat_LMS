import axios, { type InternalAxiosRequestConfig } from 'axios';

import { APP_CONFIG } from '@/config/app.config';
import { env } from '@/config/env';
import { HTTP_STATUS } from '@/constants/http-status';
import type { ApiSuccessResponse } from '@/types/api';

/**
 * Single Axios instance used by every feature's `services/*.ts`. `withCredentials` is on
 * because the refresh token travels as an httpOnly cookie — see ARCHITECTURE.md §9.
 */
export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: APP_CONFIG.REQUEST_TIMEOUT_MS,
  withCredentials: true,
});

/**
 * In-memory access token — deliberately not persisted to localStorage/sessionStorage
 * (XSS-token-theft mitigation, ARCHITECTURE.md §9). A page reload always re-derives it
 * via a silent `/auth/refresh` call in AuthProvider, using the httpOnly refresh cookie.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Registered by AuthProvider so this module (outside React) can clear session state when
 * a refresh attempt ultimately fails — e.g. the refresh cookie itself expired or was revoked.
 */
let onSessionExpired: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Shared across concurrent 401s so a burst of requests triggers exactly one refresh call.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // A plain axios call (not `apiClient`) so this never re-enters the interceptor below.
  const { data } = await axios.post<ApiSuccessResponse<{ accessToken: string }>>(
    `${env.API_URL}/auth/refresh`,
    undefined,
    { withCredentials: true, timeout: APP_CONFIG.REQUEST_TIMEOUT_MS },
  );
  return data.data.accessToken;
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== HTTP_STATUS.UNAUTHORIZED) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableConfig | undefined;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') ?? false;
    const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh') ?? false;

    // Don't attempt to "refresh" a failed login or a failed refresh itself — that's a
    // genuine session expiry, not a stale-access-token blip.
    if (!originalRequest || originalRequest._retry || isAuthEndpoint || isRefreshEndpoint) {
      if (isRefreshEndpoint) {
        setAccessToken(null);
        onSessionExpired?.();
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;
      setAccessToken(newAccessToken);
      originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
      return apiClient(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);
      onSessionExpired?.();
      return Promise.reject(refreshError);
    }
  },
);
