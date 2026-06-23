import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Courier, CourierEarnings, DeliveryJob, DeliveryStatus, Vehicle } from '@gusto/contracts';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/auth-context';
import { api } from '../api/client';

const VEHICLES: { v: Vehicle; label: string }[] = [
    { v: Vehicle.BIKE, label: '🚲 Bike' },
    { v: Vehicle.SCOOTER, label: '🛵 Scooter' },
    { v: Vehicle.CAR, label: '🚗 Car' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Courier'>;

export function CourierScreen({ navigation }: Props) {
    const { callWithAuth } = useAuth();
    const [courier, setCourier] = useState<Courier | null>(null);
    const [jobs, setJobs] = useState<DeliveryJob[]>([]);
    const [earnings, setEarnings] = useState<CourierEarnings | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [c, j, e] = await Promise.all([
                callWithAuth((t) => api.courier.me(t)),
                callWithAuth((t) => api.courier.jobs(t)),
                callWithAuth((t) => api.courier.earnings(t)),
            ]);
            setCourier(c);
            setJobs(j);
            setEarnings(e);
        } finally {
            setLoading(false);
        }
    }, [callWithAuth]);

    useEffect(() => {
        const unsub = navigation.addListener('focus', load);
        return unsub;
    }, [navigation, load]);

    const update = async (patch: Partial<Pick<Courier, 'online' | 'vehicle'>>) => {
        const c = await callWithAuth((t) => api.courier.update(t, patch));
        setCourier(c);
        setJobs(await callWithAuth((t) => api.courier.jobs(t)));
    };

    const act = async (job: DeliveryJob) => {
        setBusy(true);
        try {
            const fn =
                job.status === DeliveryStatus.PENDING
                    ? api.courier.accept
                    : job.status === DeliveryStatus.ASSIGNED
                      ? api.courier.pickup
                      : api.courier.deliver;
            setJobs(await callWithAuth((t) => fn(t, job.id)));
            setEarnings(await callWithAuth((t) => api.courier.earnings(t)));
        } catch {
            void load(); // refresh on conflict (e.g. job already taken)
        } finally {
            setBusy(false);
        }
    };

    const actionLabel = (s: DeliveryStatus) =>
        s === DeliveryStatus.PENDING ? 'Accept delivery' : s === DeliveryStatus.ASSIGNED ? 'Picked up' : 'Delivered';

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.navigate('ComingSoon')} hitSlop={10}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.title}>🛵 Drive with Gus</Text>
                <View style={{ width: 18 }} />
            </View>

            {loading || !courier ? (
                <ActivityIndicator color="#d2553a" style={{ marginTop: 40 }} />
            ) : (
                <ScrollView contentContainerStyle={styles.body}>
                    <View style={styles.onlineRow}>
                        <View>
                            <Text style={styles.onlineLabel}>
                                {courier.online ? 'You’re online' : 'You’re offline'}
                            </Text>
                            <Text style={styles.onlineSub}>
                                {courier.online ? 'Receiving delivery offers' : 'Go online to get deliveries'}
                            </Text>
                        </View>
                        <Switch
                            value={courier.online}
                            onValueChange={(v) => update({ online: v })}
                            trackColor={{ true: '#d2553a' }}
                        />
                    </View>

                    <View style={styles.vehicles}>
                        {VEHICLES.map(({ v, label }) => (
                            <Pressable
                                key={v}
                                style={[styles.veh, courier.vehicle === v && styles.vehOn]}
                                onPress={() => update({ vehicle: v })}
                            >
                                <Text style={[styles.vehTxt, courier.vehicle === v && styles.vehTxtOn]}>{label}</Text>
                            </Pressable>
                        ))}
                    </View>

                    {earnings && (
                        <View style={styles.earnings}>
                            <Text style={styles.earnVal}>
                                ₪{earnings.total} · {earnings.deliveredCount} deliveries
                            </Text>
                            <Text style={styles.earnLbl}>Your earnings</Text>
                        </View>
                    )}

                    <Text style={styles.section}>Deliveries</Text>
                    {jobs.length === 0 ? (
                        <Text style={styles.empty}>
                            {courier.online ? 'No deliveries available right now.' : 'Go online to see deliveries.'}
                        </Text>
                    ) : (
                        jobs.map((job) => (
                            <View key={job.id} style={styles.job}>
                                <View style={styles.jobHead}>
                                    <Text style={styles.jobFee}>₪{job.fee}</Text>
                                    <Text style={styles.jobMeta}>
                                        {job.distanceKm} km · {job.itemCount} {job.itemCount === 1 ? 'item' : 'items'}
                                    </Text>
                                </View>
                                <Text style={styles.jobLine}>📦 Pick up · {job.pickup.name}</Text>
                                <Text style={styles.jobLine}>🏠 Drop off · {job.dropoff.address}</Text>
                                <Pressable
                                    style={[styles.action, busy && styles.actionOff]}
                                    disabled={busy}
                                    onPress={() => act(job)}
                                >
                                    <Text style={styles.actionTxt}>{actionLabel(job.status)}</Text>
                                </Pressable>
                            </View>
                        ))
                    )}
                </ScrollView>
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
    body: { padding: 16, gap: 14 },
    onlineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#f0e9dd',
        borderRadius: 14,
        padding: 16,
    },
    onlineLabel: { fontSize: 16, fontWeight: '800', color: '#1d1b16' },
    onlineSub: { color: '#8a8275', fontSize: 13, marginTop: 2 },
    vehicles: { flexDirection: 'row', gap: 8 },
    veh: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e3ddd2',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 11,
        alignItems: 'center',
    },
    vehOn: { borderColor: '#d2553a', backgroundColor: '#fff0e8' },
    vehTxt: { color: '#6b6457', fontWeight: '600' },
    vehTxtOn: { color: '#d2553a' },
    earnings: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0e9dd', borderRadius: 14, padding: 16 },
    earnVal: { fontSize: 20, fontWeight: '800', color: '#1d1b16' },
    earnLbl: { color: '#8a8275', fontSize: 13, marginTop: 2 },
    section: { fontSize: 16, fontWeight: '800', color: '#1d1b16', marginTop: 4 },
    empty: { color: '#8a8275', textAlign: 'center', marginTop: 16 },
    job: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0e9dd', borderRadius: 14, padding: 14, gap: 6 },
    jobHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    jobFee: { fontSize: 18, fontWeight: '800', color: '#d2553a' },
    jobMeta: { color: '#8a8275', fontSize: 13 },
    jobLine: { color: '#44403a', fontSize: 14 },
    action: { backgroundColor: '#d2553a', borderRadius: 11, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
    actionOff: { opacity: 0.5 },
    actionTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
