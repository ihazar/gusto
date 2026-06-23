import Constants from 'expo-constants';
import {
    AuthResponse,
    CatalogQuery,
    Chef,
    Courier,
    CourierEarnings,
    CreateOrderDto,
    CreateReviewDto,
    DeliveryJob,
    DevicePlatform,
    KitchenDetail,
    KitchenSummary,
    OnboardingDto,
    Order,
    OrderTracking,
    OtpChannel,
    RequestOtpResponse,
    UpdateCourierDto,
} from '@gusto/contracts';
import { Platform } from 'react-native';

/** An error carrying the HTTP status, so callers can react to 401 etc. */
export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

/**
 * In development, talk to the API on the same host that served the JS bundle
 * (Metro), swapping Metro's port for the API's. This makes the iOS simulator
 * (localhost), the Android emulator (which can't see the host's localhost), and
 * physical devices on the LAN all work with no per-platform configuration.
 */
function devApiBase(): string | undefined {
    const hostUri =
        Constants.expoConfig?.hostUri ?? (Constants.expoGoConfig as { debuggerHost?: string } | null)?.debuggerHost;
    const host = hostUri?.split(':')[0];
    return host ? `http://${host}:5007/api` : undefined;
}

// Resolve order: explicit EXPO_PUBLIC_API_URL override -> dev host auto-detect
// -> app.json extra (Heroku/prod default) -> hardcoded fallback.
const BASE = (
    process.env.EXPO_PUBLIC_API_URL ??
    (__DEV__ ? devApiBase() : undefined) ??
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
        throw new ApiError(message, res.status);
    }

    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

async function get<T>(path: string, accessToken?: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
    return (await res.json()) as T;
}

/** Bodyless PUT/DELETE used by toggles like favorites. */
async function send<T>(method: 'PUT' | 'DELETE', path: string, accessToken?: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

async function patch<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
    return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
    const parts = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
    return parts.length ? `?${parts.join('&')}` : '';
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

    chef: {
        me: (accessToken: string) => get<Chef>('/chef/me', accessToken),
        completeOnboarding: (accessToken: string, dto: OnboardingDto) =>
            post<Chef>('/chef/me/onboarding/complete', dto, accessToken),
    },

    catalog: {
        list: (query: CatalogQuery, accessToken?: string) =>
            get<KitchenSummary[]>(`/kitchens${qs(query as Record<string, string | number | undefined>)}`, accessToken),
        get: (id: string, accessToken?: string) => get<KitchenDetail>(`/kitchens/${id}`, accessToken),
    },

    favorites: {
        list: (accessToken: string) => get<KitchenSummary[]>('/me/favorites', accessToken),
        add: (accessToken: string, chefId: string) =>
            send<{ favorited: boolean }>('PUT', `/me/favorites/${chefId}`, accessToken),
        remove: (accessToken: string, chefId: string) =>
            send<{ favorited: boolean }>('DELETE', `/me/favorites/${chefId}`, accessToken),
    },

    orders: {
        create: (accessToken: string, dto: CreateOrderDto) => post<Order>('/orders', dto, accessToken),
        mine: (accessToken: string) => get<Order[]>('/me/orders', accessToken),
        tracking: (accessToken: string, id: string) => get<OrderTracking>(`/orders/${id}/tracking`, accessToken),
        review: (accessToken: string, id: string, dto: CreateReviewDto) =>
            post<void>(`/orders/${id}/review`, dto, accessToken),
    },

    courier: {
        me: (accessToken: string) => get<Courier>('/courier/me', accessToken),
        update: (accessToken: string, dto: UpdateCourierDto) => patch<Courier>('/courier/me', dto, accessToken),
        jobs: (accessToken: string) => get<DeliveryJob[]>('/courier/jobs', accessToken),
        accept: (accessToken: string, id: string) => post<DeliveryJob[]>(`/courier/jobs/${id}/accept`, {}, accessToken),
        pickup: (accessToken: string, id: string) => post<DeliveryJob[]>(`/courier/jobs/${id}/pickup`, {}, accessToken),
        deliver: (accessToken: string, id: string) =>
            post<DeliveryJob[]>(`/courier/jobs/${id}/deliver`, {}, accessToken),
        earnings: (accessToken: string) => get<CourierEarnings>('/courier/earnings', accessToken),
    },
};
