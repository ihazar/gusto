import Constants from 'expo-constants';
import { AuthResponse, DevicePlatform, OtpChannel, RequestOtpResponse } from '@gusto/contracts';
import { Platform } from 'react-native';

// Resolve order: EXPO_PUBLIC_API_URL env (flip to local) -> app.json extra
// (Heroku default) -> hardcoded fallback.
const BASE = (
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
    'https://gustochefs.com/api'
).replace(/\/$/, '');

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
        // Surface the API's message (e.g. region-blocked, invalid code) when present.
        let message = `Request failed (${res.status})`;
        try {
            const data = (await res.json()) as { message?: string | string[] };
            if (data?.message) {
                message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
            }
        } catch {
            // non-JSON body; keep the generic message
        }
        throw new Error(message);
    }

    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const devicePlatform: DevicePlatform = Platform.OS === 'ios' ? DevicePlatform.IOS : DevicePlatform.ANDROID;

export const api = {
    requestOtp: (phone: string, channel: OtpChannel) =>
        post<RequestOtpResponse>('/auth/otp/request', { phone, channel }),

    verifyOtp: (phone: string, code: string, deviceId: string, pushToken?: string) =>
        post<AuthResponse>('/auth/otp/verify', {
            phone,
            code,
            device: { deviceId, platform: devicePlatform, pushToken },
        }),

    refresh: (refreshToken: string) => post<AuthResponse>('/auth/refresh', { refreshToken }),

    logout: (refreshToken: string) => post<void>('/auth/logout', { refreshToken }),
};
