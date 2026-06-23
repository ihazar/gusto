import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'ChefLive'>;

export function ChefLiveScreen({ navigation, route }: Props) {
    const kitchenName = route.params?.kitchenName?.trim() || 'Your kitchen';

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <Text style={styles.emoji}>🎉</Text>
                <Text style={styles.title}>You’re live!</Text>
                <Text style={styles.lede}>
                    <Text style={styles.kitchen}>{kitchenName}</Text> is now published and accepting orders.
                </Text>
                <Text style={styles.note}>
                    Manage your menu, photos and orders from the Gusto chef dashboard on the web.
                </Text>

                <Pressable style={styles.primary} onPress={() => navigation.navigate('ComingSoon')}>
                    <Text style={styles.primaryText}>Back to home</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#faf7f2' },
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
    emoji: { fontSize: 56 },
    title: { fontSize: 40, fontWeight: '800', color: '#1d1b16', letterSpacing: -1 },
    lede: { fontSize: 18, color: '#44403a', textAlign: 'center', maxWidth: 340 },
    kitchen: { fontWeight: '800', color: '#d2553a' },
    note: { fontSize: 14, color: '#8a8275', textAlign: 'center', maxWidth: 320, marginTop: 4 },
    primary: {
        marginTop: 12,
        backgroundColor: '#d2553a',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 28,
    },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
