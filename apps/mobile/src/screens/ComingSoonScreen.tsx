import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/auth-context';

export function ComingSoonScreen() {
    const { user, signOut } = useAuth();

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
    signOut: {
        marginTop: 10,
        paddingVertical: 11,
        paddingHorizontal: 22,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e3ddd2',
        backgroundColor: '#fff',
    },
    signOutText: { color: '#6b6457', fontWeight: '600' },
});
