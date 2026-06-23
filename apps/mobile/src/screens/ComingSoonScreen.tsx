import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/auth-context';
import { api } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'ComingSoon'>;

export function ComingSoonScreen({ navigation }: Props) {
    const { user, callWithAuth, signOut } = useAuth();
    const [onboarded, setOnboarded] = useState<boolean | null>(null);
    const [kitchenName, setKitchenName] = useState('');

    // Reflect chef status so the CTA reads correctly. Re-runs on focus so it
    // updates after the wizard completes.
    useEffect(() => {
        const load = async () => {
            try {
                const chef = await callWithAuth((token) => api.chef.me(token));
                setOnboarded(chef.onboarded);
                setKitchenName(chef.kitchenName);
            } catch {
                setOnboarded(false);
            }
        };
        const unsub = navigation.addListener('focus', load);
        return unsub;
    }, [navigation, callWithAuth]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <View style={styles.brandRow}>
                    <Text style={styles.logo}>🍳</Text>
                    <Text style={styles.brand}>Gusto</Text>
                </View>

                <Text style={styles.title}>Coming soon</Text>
                <Text style={styles.lede}>
                    You're on the list. We're cooking up something great — home-chefs near you, very soon.
                </Text>
                <Text style={styles.who}>
                    Signed in as <Text style={styles.phone}>{user?.phone}</Text>
                </Text>

                {onboarded ? (
                    <Pressable style={styles.primary} onPress={() => navigation.navigate('ChefLive', { kitchenName })}>
                        <Text style={styles.primaryText}>✓ {kitchenName || 'Your kitchen'} is live</Text>
                    </Pressable>
                ) : (
                    <Pressable style={styles.primary} onPress={() => navigation.navigate('Onboarding')}>
                        <Text style={styles.primaryText}>👩‍🍳 Become a chef</Text>
                    </Pressable>
                )}

                <Pressable style={styles.signOut} onPress={signOut}>
                    <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#faf7f2' },
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    logo: { fontSize: 28 },
    brand: { fontSize: 24, fontWeight: '800', color: '#d2553a' },
    title: { fontSize: 48, fontWeight: '800', color: '#1d1b16', letterSpacing: -1.5, textAlign: 'center' },
    lede: { fontSize: 17, color: '#6b6457', textAlign: 'center', maxWidth: 360 },
    who: { color: '#8a8275', fontSize: 14, marginTop: 6 },
    phone: { fontWeight: '700', color: '#6b6457' },
    primary: {
        marginTop: 10,
        backgroundColor: '#d2553a',
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 24,
    },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    signOut: {
        paddingVertical: 11,
        paddingHorizontal: 22,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e3ddd2',
        backgroundColor: '#fff',
    },
    signOutText: { color: '#6b6457', fontWeight: '600' },
});
