import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DeliveryStatus, OrderTracking } from '@gusto/contracts';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/auth-context';
import { api } from '../api/client';

const DELIVERY_COPY: Record<DeliveryStatus, string> = {
    [DeliveryStatus.PENDING]: 'Finding a Gus courier…',
    [DeliveryStatus.ASSIGNED]: 'Gus is heading to the kitchen',
    [DeliveryStatus.PICKED_UP]: 'Gus is on the way to you',
    [DeliveryStatus.DELIVERED]: 'Delivered — enjoy! 🎉',
    [DeliveryStatus.CANCELLED]: 'Delivery cancelled',
};

type Props = NativeStackScreenProps<RootStackParamList, 'TrackOrder'>;

export function TrackOrderScreen({ navigation, route }: Props) {
    const { callWithAuth } = useAuth();
    const { orderId } = route.params;
    const [tracking, setTracking] = useState<OrderTracking | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const tick = async () => {
            try {
                const t = await callWithAuth((tok) => api.orders.tracking(tok, orderId));
                if (active) setTracking(t);
            } catch {
                // keep last
            } finally {
                if (active) setLoading(false);
            }
        };
        void tick();
        const id = setInterval(tick, 5000); // simulated GPS; WS realtime deferred
        return () => {
            active = false;
            clearInterval(id);
        };
    }, [callWithAuth, orderId]);

    const d = tracking?.delivery;
    const progress = d?.progress ?? 0;

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.title}>Track order</Text>
                <View style={{ width: 18 }} />
            </View>

            {loading ? (
                <ActivityIndicator color="#d2553a" style={{ marginTop: 40 }} />
            ) : !d ? (
                <Text style={styles.empty}>
                    {tracking?.orderStatus === 'CANCELLED'
                        ? 'This order was cancelled.'
                        : 'Your order is being prepared. Tracking starts once it’s handed to Gus.'}
                </Text>
            ) : (
                <View style={styles.body}>
                    <Text style={styles.status}>{DELIVERY_COPY[d.status]}</Text>
                    {d.status === DeliveryStatus.PICKED_UP && d.etaMinutes !== undefined && (
                        <Text style={styles.eta}>ETA ~{d.etaMinutes} min</Text>
                    )}

                    {/* schematic route: kitchen → Gus → home */}
                    <View style={styles.route}>
                        <View style={styles.track} />
                        <View style={[styles.trackFill, { width: `${Math.round(progress * 100)}%` }]} />
                        <Text style={styles.pin}>🍳</Text>
                        <Text style={[styles.gus, { left: `${Math.round(progress * 100)}%` }]}>🛵</Text>
                        <Text style={[styles.pin, styles.pinRight]}>🏠</Text>
                    </View>

                    <View style={styles.labels}>
                        <Text style={styles.lbl}>Kitchen</Text>
                        <Text style={styles.lbl}>You</Text>
                    </View>

                    {!!d.courierName && <Text style={styles.courier}>Your courier: {d.courierName}</Text>}
                </View>
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
    body: { padding: 24, gap: 12 },
    status: { fontSize: 22, fontWeight: '800', color: '#1d1b16', textAlign: 'center', marginTop: 20 },
    eta: { fontSize: 16, color: '#d2553a', fontWeight: '700', textAlign: 'center' },
    route: { height: 60, justifyContent: 'center', marginTop: 30, marginHorizontal: 10 },
    track: { position: 'absolute', left: 16, right: 16, height: 4, borderRadius: 2, backgroundColor: '#ece4d7' },
    trackFill: { position: 'absolute', left: 16, height: 4, borderRadius: 2, backgroundColor: '#d2553a' },
    pin: { position: 'absolute', left: 0, fontSize: 26 },
    pinRight: { left: undefined, right: 0 },
    gus: { position: 'absolute', fontSize: 28, marginLeft: -6 },
    labels: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 10 },
    lbl: { color: '#8a8275', fontSize: 13 },
    courier: { textAlign: 'center', color: '#6b6457', marginTop: 16, fontSize: 15 },
});
