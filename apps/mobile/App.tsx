import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth/auth-context';
import { LoginScreen } from './src/screens/LoginScreen';

function HomeScreen() {
    const { user, signOut } = useAuth();
    return (
        <View style={styles.center}>
            <Text style={styles.title}>You're in 🎉</Text>
            <Text style={styles.muted}>Signed in as {user?.phone}</Text>
            <Text style={styles.muted}>Browse & order home-chefs — coming in Phase 2.</Text>
            <Pressable onPress={signOut}>
                <Text style={styles.link}>Sign out</Text>
            </Pressable>
        </View>
    );
}

function Root() {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
            </View>
        );
    }
    return user ? <HomeScreen /> : <LoginScreen />;
}

export default function App() {
    return (
        <AuthProvider>
            <StatusBar style="dark" />
            <Root />
        </AuthProvider>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: 24,
        backgroundColor: '#faf7f2',
    },
    title: { fontSize: 26, fontWeight: '800', color: '#d2553a' },
    muted: { color: '#6b6457', textAlign: 'center' },
    link: { color: '#d2553a', marginTop: 12, fontWeight: '600' },
});
