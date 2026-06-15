import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AuthTokens, AuthUser, OtpChannel } from '@gusto/contracts';
import { api } from '../api/client';

interface AuthState {
    user: AuthUser | null;
    loading: boolean;
    requestOtp: (phone: string, channel: OtpChannel) => Promise<void>;
    verifyOtp: (phone: string, code: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const SESSION_KEY = 'gusto.session';
const DEVICE_KEY = 'gusto.deviceId';

interface Session {
    user: AuthUser;
    tokens: AuthTokens;
}

async function getDeviceId(): Promise<string> {
    let id = await SecureStore.getItemAsync(DEVICE_KEY);
    if (!id) {
        id = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        await SecureStore.setItemAsync(DEVICE_KEY, id);
    }
    return id;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        SecureStore.getItemAsync(SESSION_KEY)
            .then((raw) => raw && setSession(JSON.parse(raw) as Session))
            .finally(() => setLoading(false));
    }, []);

    const persist = async (next: Session | null) => {
        setSession(next);
        if (next) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
        else await SecureStore.deleteItemAsync(SESSION_KEY);
    };

    const value = useMemo<AuthState>(
        () => ({
            user: session?.user ?? null,
            loading,
            requestOtp: async (phone, channel) => {
                await api.requestOtp(phone, channel);
            },
            verifyOtp: async (phone, code) => {
                const deviceId = await getDeviceId();
                const res = await api.verifyOtp(phone, code, deviceId);
                await persist({ user: res.user, tokens: res.tokens });
            },
            signOut: async () => {
                if (session?.tokens.refreshToken) {
                    await api.logout(session.tokens.refreshToken).catch(() => undefined);
                }
                await persist(null);
            },
        }),
        [session, loading],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
