import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DeliverySlot } from '@gusto/contracts';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/auth-context';
import { api } from '../api/client';

// Mirrors the server fee engine (apps/api/src/orders/fees.ts) for an estimate;
// the API recomputes authoritatively and returns the real total.
const SERVICE_RATE = 0.05;
const DELIVERY_FEE = 15;
const VAT_RATE = 0.18;
const round2 = (n: number) => Math.round(n * 100) / 100;
const TIPS = [0, 5, 10, 15];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-07-12" + weekday 0 → "Sun, Jul 12". */
function slotDateLabel(s: DeliverySlot): string {
    const [, m, d] = s.date.split('-').map(Number);
    return `${WEEKDAYS[s.weekday]}, ${MONTHS[m - 1]} ${d}`;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

export function CheckoutScreen({ navigation, route }: Props) {
    const { callWithAuth } = useAuth();
    const { kitchenId, kitchenName, items } = route.params;

    const [address, setAddress] = useState('');
    const [tip, setTip] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Order-ahead: kitchens with weekly windows require picking a delivery slot.
    const [slots, setSlots] = useState<DeliverySlot[] | null>(null);
    const [slot, setSlot] = useState<DeliverySlot | null>(null);

    useEffect(() => {
        api.catalog
            .slots(kitchenId)
            .then(setSlots)
            .catch(() => setSlots([])); // treat as ASAP kitchen if the lookup fails
    }, [kitchenId]);

    const totals = useMemo(() => {
        const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
        const serviceFee = round2(subtotal * SERVICE_RATE);
        const vat = round2((serviceFee + DELIVERY_FEE) * VAT_RATE);
        const total = round2(subtotal + serviceFee + DELIVERY_FEE + vat + tip);
        return { subtotal, serviceFee, deliveryFee: DELIVERY_FEE, vat, total };
    }, [items, tip]);

    const placeOrder = async () => {
        if (!address.trim()) {
            setError('Please enter a delivery address.');
            return;
        }
        if (slots?.length && !slot) {
            setError('Pick a delivery window — this chef cooks to order.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await callWithAuth((token) =>
                api.orders.create(token, {
                    kitchenId,
                    items: items.map((i) => ({ dishId: i.dishId, qty: i.qty })),
                    deliveryAddress: address.trim(),
                    tip,
                    slot: slot ? { availabilityId: slot.availabilityId, date: slot.date } : undefined,
                }),
            );
            navigation.replace('MyOrders');
        } catch (e) {
            setError((e as Error).message || 'Could not place your order. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
                    <Text style={styles.back}>‹</Text>
                </Pressable>
                <Text style={styles.title}>Checkout</Text>
                <View style={{ width: 18 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body}>
                <Text style={styles.kitchen}>{kitchenName}</Text>

                <View style={styles.panel}>
                    {items.map((i) => (
                        <View key={i.dishId} style={styles.line}>
                            <Text style={styles.lineName}>
                                {i.qty}× {i.name}
                            </Text>
                            <Text style={styles.lineVal}>₪{round2(i.price * i.qty)}</Text>
                        </View>
                    ))}
                </View>

                {slots === null && <ActivityIndicator color="#d2553a" />}
                {!!slots?.length && (
                    <>
                        <Text style={styles.label}>Delivery window</Text>
                        <View style={styles.slots}>
                            {slots.map((s) => {
                                const key = `${s.availabilityId}|${s.date}`;
                                const selected = slot?.availabilityId === s.availabilityId && slot?.date === s.date;
                                const full = s.remaining <= 0;
                                return (
                                    <Pressable
                                        key={key}
                                        style={[styles.slot, selected && styles.slotOn, full && styles.slotOff]}
                                        disabled={full}
                                        onPress={() => setSlot(s)}
                                    >
                                        <Text style={[styles.slotDate, selected && styles.slotTxtOn]}>
                                            {slotDateLabel(s)}
                                        </Text>
                                        <Text style={[styles.slotTime, selected && styles.slotTxtOn]}>
                                            {s.startTime}–{s.endTime}
                                        </Text>
                                        <Text style={[styles.slotLeft, full && styles.slotLeftFull]}>
                                            {full ? 'Full' : `${s.remaining} left`}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </>
                )}

                <Text style={styles.label}>Delivery address</Text>
                <TextInput
                    style={styles.input}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Street, number, city"
                    placeholderTextColor="#bcb4a6"
                />

                <Text style={styles.label}>Tip for the chef</Text>
                <View style={styles.tips}>
                    {TIPS.map((t) => (
                        <Pressable key={t} style={[styles.tip, tip === t && styles.tipOn]} onPress={() => setTip(t)}>
                            <Text style={[styles.tipTxt, tip === t && styles.tipTxtOn]}>
                                {t === 0 ? 'None' : `₪${t}`}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.panel}>
                    <Row label="Subtotal" value={totals.subtotal} />
                    <Row label="Service fee" value={totals.serviceFee} />
                    <Row label="Delivery" value={totals.deliveryFee} />
                    <Row label="VAT" value={totals.vat} />
                    {tip > 0 && <Row label="Tip" value={tip} />}
                    <View style={styles.divider} />
                    <Row label="Total" value={totals.total} bold />
                </View>

                {error && <Text style={styles.error}>{error}</Text>}
                <Text style={styles.note}>Payment is authorized now and captured when your order is handed off.</Text>
            </ScrollView>

            <View style={styles.footer}>
                <Pressable style={[styles.pay, busy && styles.payOff]} onPress={placeOrder} disabled={busy}>
                    {busy ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.payTxt}>Place order · ₪{totals.total}</Text>
                    )}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
    return (
        <View style={styles.line}>
            <Text style={[styles.lineName, bold && styles.bold]}>{label}</Text>
            <Text style={[styles.lineVal, bold && styles.bold]}>₪{value}</Text>
        </View>
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
    body: { padding: 16, gap: 10 },
    kitchen: { fontSize: 16, fontWeight: '700', color: '#1d1b16' },
    panel: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f0e9dd', padding: 14, gap: 8 },
    line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    lineName: { color: '#44403a', fontSize: 15, flex: 1 },
    lineVal: { color: '#1d1b16', fontSize: 15, fontWeight: '600' },
    bold: { fontWeight: '800', color: '#1d1b16' },
    divider: { height: 1, backgroundColor: '#f0e9dd', marginVertical: 2 },
    label: { fontSize: 13, fontWeight: '600', color: '#44403a', marginTop: 6 },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e3ddd2',
        borderRadius: 10,
        paddingHorizontal: 13,
        paddingVertical: 11,
        fontSize: 15,
        color: '#1d1b16',
    },
    slots: { gap: 8 },
    slot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: '#e3ddd2',
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 11,
        paddingHorizontal: 13,
    },
    slotOn: { borderColor: '#d2553a', backgroundColor: '#fff0e8' },
    slotOff: { opacity: 0.5 },
    slotDate: { color: '#1d1b16', fontWeight: '700', fontSize: 14, flex: 1 },
    slotTime: { color: '#44403a', fontSize: 14 },
    slotTxtOn: { color: '#d2553a' },
    slotLeft: { color: '#8a8275', fontSize: 12, fontWeight: '600' },
    slotLeftFull: { color: '#b3261e' },
    tips: { flexDirection: 'row', gap: 8 },
    tip: {
        borderWidth: 1,
        borderColor: '#e3ddd2',
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 16,
    },
    tipOn: { borderColor: '#d2553a', backgroundColor: '#fff0e8' },
    tipTxt: { color: '#6b6457', fontWeight: '600' },
    tipTxtOn: { color: '#d2553a' },
    error: { color: '#b3261e', fontSize: 14 },
    note: { color: '#8a8275', fontSize: 13 },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#f0e9dd' },
    pay: { backgroundColor: '#d2553a', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
    payOff: { opacity: 0.5 },
    payTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
