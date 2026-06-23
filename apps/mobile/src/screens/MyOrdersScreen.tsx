import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Order, OrderStatus } from '@gusto/contracts';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/auth-context';
import { api } from '../api/client';

const STATUS_LABEL: Record<OrderStatus, string> = {
    [OrderStatus.NEW]: '🆕 Placed',
    [OrderStatus.IN_PREPARATION]: '🍳 In preparation',
    [OrderStatus.ON_THE_WAY]: '🛵 On the way',
    [OrderStatus.DELIVERED]: '✅ Delivered',
    [OrderStatus.CANCELLED]: '✖️ Cancelled',
};

type Props = NativeStackScreenProps<RootStackParamList, 'MyOrders'>;

export function MyOrdersScreen({ navigation }: Props) {
    const { callWithAuth } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            setOrders(await callWithAuth((token) => api.orders.mine(token)));
        } catch {
            // leave empty
        } finally {
            setLoading(false);
        }
    }, [callWithAuth]);

    const rate = async (orderId: string, rating: number) => {
        // optimistic: mark reviewed so the stars disappear
        setOrders((os) => os.map((o) => (o.id === orderId ? { ...o, reviewed: true } : o)));
        try {
            await callWithAuth((t) => api.orders.review(t, orderId, { rating, comment: '' }));
        } catch {
            void load();
        }
    };

    useEffect(() => {
        const unsub = navigation.addListener('focus', load);
        return unsub;
    }, [navigation, load]);

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.navigate('ComingSoon')} hitSlop={10}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.title}>My orders</Text>
                <View style={{ width: 18 }} />
            </View>

            {loading ? (
                <ActivityIndicator color="#d2553a" style={{ marginTop: 40 }} />
            ) : orders.length === 0 ? (
                <Text style={styles.empty}>No orders yet. Browse home-chefs and place your first order!</Text>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(o) => o.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        const live = item.status === OrderStatus.ON_THE_WAY;
                        return (
                            <Pressable
                                style={styles.card}
                                disabled={!live}
                                onPress={() => navigation.navigate('TrackOrder', { orderId: item.id })}
                            >
                                <View style={styles.cardHead}>
                                    <Text style={styles.kitchen}>{item.kitchenName ?? 'Kitchen'}</Text>
                                    <Text style={styles.status}>{STATUS_LABEL[item.status]}</Text>
                                </View>
                                {item.items.map((i) => (
                                    <Text key={i.mealId} style={styles.line}>
                                        {i.qty}× {i.name}
                                    </Text>
                                ))}
                                <View style={styles.cardFoot}>
                                    <Text style={styles.addr} numberOfLines={1}>
                                        📍 {item.deliveryAddress}
                                    </Text>
                                    <Text style={styles.total}>₪{item.total}</Text>
                                </View>
                                {live && <Text style={styles.track}>Track delivery →</Text>}
                                {item.status === OrderStatus.DELIVERED && !item.reviewed && (
                                    <View style={styles.rateRow}>
                                        <Text style={styles.rateLbl}>Rate:</Text>
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <Pressable key={n} onPress={() => rate(item.id, n)} hitSlop={6}>
                                                <Text style={styles.star}>☆</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                                {item.status === OrderStatus.DELIVERED && item.reviewed && (
                                    <Text style={styles.rated}>★ Thanks for rating!</Text>
                                )}
                            </Pressable>
                        );
                    }}
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
    empty: { textAlign: 'center', color: '#8a8275', marginTop: 50, paddingHorizontal: 30 },
    list: { padding: 16, gap: 14 },
    card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f0e9dd', padding: 16, gap: 6 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    kitchen: { fontSize: 16, fontWeight: '800', color: '#1d1b16' },
    status: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7a4a36',
        backgroundColor: '#f6f1e8',
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    line: { color: '#44403a', fontSize: 14 },
    cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    addr: { color: '#8a8275', fontSize: 13, flex: 1 },
    total: { color: '#d2553a', fontWeight: '800', fontSize: 16 },
    track: { color: '#d2553a', fontWeight: '700', fontSize: 14, marginTop: 4 },
    rateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    rateLbl: { color: '#6b6457', fontSize: 14, marginRight: 4 },
    star: { fontSize: 26, color: '#f5a623' },
    rated: { color: '#1d7a4a', fontWeight: '600', fontSize: 14, marginTop: 6 },
});
