import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KitchenSummary } from '@gusto/contracts';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/auth-context';
import { api } from '../api/client';

// Default search origin (Tel Aviv center) until device location is wired up.
const ORIGIN = { lat: 32.0853, lng: 34.7818 };

const symbol = (c: string) => (c === 'ILS' ? '₪' : c === 'USD' ? '$' : c === 'EUR' ? '€' : `${c} `);

type Props = NativeStackScreenProps<RootStackParamList, 'Discover'>;

export function DiscoverScreen({ navigation }: Props) {
    const { accessToken } = useAuth();
    const [q, setQ] = useState('');
    const [kitchens, setKitchens] = useState<KitchenSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        async (search: string) => {
            setLoading(true);
            setError(null);
            try {
                const data = await api.catalog.list(
                    { lat: ORIGIN.lat, lng: ORIGIN.lng, q: search || undefined },
                    accessToken ?? undefined,
                );
                setKitchens(data);
            } catch {
                setError('Could not load kitchens. Is the API running?');
            } finally {
                setLoading(false);
            }
        },
        [accessToken],
    );

    useEffect(() => {
        void load('');
    }, [load]);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.title}>Home-chefs near you</Text>
                <View style={{ width: 18 }} />
            </View>

            <View style={styles.searchRow}>
                <TextInput
                    style={styles.search}
                    value={q}
                    onChangeText={setQ}
                    onSubmitEditing={() => load(q)}
                    placeholder="Search kitchens or dishes…"
                    placeholderTextColor="#bcb4a6"
                    returnKeyType="search"
                />
            </View>

            {loading ? (
                <ActivityIndicator color="#d2553a" style={{ marginTop: 40 }} />
            ) : error ? (
                <Text style={styles.empty}>{error}</Text>
            ) : kitchens.length === 0 ? (
                <Text style={styles.empty}>No kitchens yet. Be the first to become a chef!</Text>
            ) : (
                <FlatList
                    data={kitchens}
                    keyExtractor={(k) => k.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <Pressable
                            style={styles.card}
                            onPress={() =>
                                navigation.navigate('KitchenDetail', { id: item.id, name: item.kitchenName })
                            }
                        >
                            <Image source={{ uri: item.timelineUrl }} style={styles.cover} />
                            {item.favorited && <Text style={styles.heart}>♥</Text>}
                            <View style={styles.cardBody}>
                                <View style={styles.cardHead}>
                                    <Text style={styles.kitchen} numberOfLines={1}>
                                        {item.kitchenName || 'Untitled kitchen'}
                                    </Text>
                                    {item.priceFrom !== undefined && (
                                        <Text style={styles.price}>
                                            from {symbol(item.currency)}
                                            {item.priceFrom}
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.meta}>
                                    {item.city}
                                    {item.distanceKm !== undefined ? ` · ${item.distanceKm} km` : ''} · {item.dishCount}{' '}
                                    {item.dishCount === 1 ? 'dish' : 'dishes'}
                                    {item.rating > 0 ? ` · ★ ${item.rating}` : ''}
                                </Text>
                                <View style={styles.badges}>
                                    {item.hasKosher && <Text style={styles.kosher}>✡️ Kosher</Text>}
                                    {item.diets.slice(0, 3).map((d) => (
                                        <Text key={d} style={styles.diet}>
                                            {d.replace(/_/g, ' ').toLowerCase()}
                                        </Text>
                                    ))}
                                </View>
                            </View>
                        </Pressable>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#faf7f2' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    back: { fontSize: 30, color: '#6b6457', lineHeight: 30 },
    title: { fontSize: 18, fontWeight: '800', color: '#1d1b16' },
    searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
    search: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e3ddd2',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        fontSize: 15,
        color: '#1d1b16',
    },
    list: { padding: 16, gap: 16 },
    card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0e9dd', overflow: 'hidden' },
    cover: { width: '100%', height: 140, backgroundColor: '#f1ece3' },
    heart: { position: 'absolute', top: 10, right: 12, fontSize: 20, color: '#d2553a' },
    cardBody: { padding: 14, gap: 6 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    kitchen: { fontSize: 17, fontWeight: '700', color: '#1d1b16', flex: 1 },
    price: { color: '#d2553a', fontWeight: '800', fontSize: 14 },
    meta: { color: '#6b6457', fontSize: 13 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    kosher: {
        backgroundColor: '#eef3ff',
        color: '#3a57d2',
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 9,
        fontSize: 12,
        fontWeight: '600',
    },
    diet: {
        backgroundColor: '#f6f1e8',
        color: '#7a4a36',
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 9,
        fontSize: 12,
        fontWeight: '600',
    },
    empty: { textAlign: 'center', color: '#8a8275', marginTop: 50, paddingHorizontal: 30 },
});
