import Constants from 'expo-constants';
import {
  AuthResponse,
  DevicePlatform,
  RequestOtpResponse,
} from '@hearth/contracts';
import { Platform } from 'react-native';

const BASE = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:5000/api';

async function post<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const devicePlatform: DevicePlatform =
  Platform.OS === 'ios' ? DevicePlatform.IOS : DevicePlatform.ANDROID;

export const api = {
  requestOtp: (phone: string) =>
    post<RequestOtpResponse>('/auth/otp/request', { phone }),

  verifyOtp: (phone: string, code: string, deviceId: string, pushToken?: string) =>
    post<AuthResponse>('/auth/otp/verify', {
      phone,
      code,
      device: { deviceId, platform: devicePlatform, pushToken },
    }),

  refresh: (refreshToken: string) =>
    post<AuthResponse>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) => post<void>('/auth/logout', { refreshToken }),
};
