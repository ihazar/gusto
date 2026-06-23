import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KitchenDetail, Meal } from '@gusto/contracts';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/auth-context';
import { api } from '../api/client';

const symbol = (c: string) => (c === 'ILS' ? '₪' : c === 'USD' ? '$' : c === 'EUR' ? '€' : `${c} `);

type Props = NativeStackScreenProps<RootStackParamList, 'KitchenDetail'>;

export function KitchenDetailScreen({ navigation, route }: Props) {
    const { accessToken } = useAuth();
    const { id } = route.params;
    const [kitchen, setKitchen] = useState<KitchenDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [fav, setFav] = useState(false);
    const [cart, setCart] = useState<Record<string, number>>({});

    useEffect(() => {
        const run = async () => {
            try {
                const k = await api.catalog.get(id, accessToken ?? undefined);
                setKitchen(k);
                setFav(!!k.favorited);
            } finally {
                setLoading(false);
            }
        };
        void run();
    }, [id, accessToken]);

    const cur = kitchen?.meals[0]?.currency ?? 'ILS';
    const { count, subtotal, items } = useMemo(() => {
        let count = 0;
        let subtotal = 0;
        const items: { dishId: string; name: string; price: number; qty: number }[] = [];
        for (const m of kitchen?.meals ?? []) {
            const qty = cart[m.id] ?? 0;
            if (qty > 0) {
                count += qty;
                subtotal += qty * m.price;
                items.push({ dishId: m.id, name: m.name, price: m.price, qty });
            }
        }
        return { count, subtotal, items };
    }, [cart, kitchen]);

    const setQty = (dishId: string, delta: number) =>
        setCart((c) => ({ ...c, [dishId]: Math.max(0, (c[dishId] ?? 0) + delta) }));

    const toggleFav = async () => {
        if (!accessToken) return;
        const next = !fav;
        setFav(next);
        try {
            if (next) await api.favorites.add(accessToken, id);
            else await api.favorites.remove(accessToken, id);
        } catch {
            setFav(!next);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safe}>
                <ActivityIndicator color="#d2553a" style={{ marginTop: 60 }} />
            </SafeAreaView>
        );
    }
    if (!kitchen) {
        return (
            <SafeAreaView style={styles.safe}>
                <Text style={styles.empty}>Kitchen not found.</Text>
            </SafeAreaView>
        );
    }

    const addr = [kitchen.address.line1, kitchen.address.city, kitchen.address.country].filter(Boolean).join(', ');

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView contentContainerStyle={{ paddingBottom: count > 0 ? 90 : 40 }}>
                <View>
                    <Image source={{ uri: kitchen.timelineUrl }} style={styles.cover} />
                    <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
                        <Text style={styles.backTxt}>‹</Text>
                    </Pressable>
                    {accessToken && (
                        <Pressable style={styles.favBtn} onPress={toggleFav} hitSlop={10}>
                            <Text style={[styles.favTxt, fav && styles.favOn]}>{fav ? '♥' : '♡'}</Text>
                        </Pressable>
                    )}
                </View>

                <View style={styles.profileRow}>
                    <Image source={{ uri: kitchen.selfieUrl }} style={styles.avatar} />
                    <View style={styles.who}>
                        <Text style={styles.kitchen}>
                            {kitchen.kitchenName} {kitchen.verified ? '✔' : ''}
                        </Text>
                        <Text style={styles.byline}>
                            by {kitchen.name} · {kitchen.address.city}
                            {kitchen.distanceKm !== undefined ? ` · ${kitchen.distanceKm} km` : ''}
                        </Text>
                    </View>
                </View>

                {!!kitchen.bio && <Text style={styles.bio}>{kitchen.bio}</Text>}
                <Text style={styles.addr}>📍 {addr}</Text>
                {!kitchen.acceptingOrders && <Text style={styles.paused}>⛔ Not taking orders right now</Text>}

                <Text style={styles.menuTitle}>On the menu</Text>
                {kitchen.meals.length === 0 ? (
                    <Text style={styles.empty}>No dishes available right now.</Text>
                ) : (
                    kitchen.meals.map((m) => (
                        <DishCard
                            key={m.id}
                            meal={m}
                            qty={cart[m.id] ?? 0}
                            canOrder={kitchen.acceptingOrders}
                            onAdd={() => setQty(m.id, 1)}
                            onRemove={() => setQty(m.id, -1)}
                        />
                    ))
                )}
            </ScrollView>

            {count > 0 && (
                <Pressable
                    style={styles.checkoutBar}
                    onPress={() =>
                        navigation.navigate('Checkout', { kitchenId: id, kitchenName: kitchen.kitchenName, items })
                    }
                >
                    <Text style={styles.checkoutText}>
                        Checkout · {count} {count === 1 ? 'item' : 'items'}
                    </Text>
                    <Text style={styles.checkoutText}>
                        {symbol(cur)}
                        {subtotal}
                    </Text>
                </Pressable>
            )}
        </SafeAreaView>
    );
}

function DishCard({
    meal,
    qty,
    canOrder,
    onAdd,
    onRemove,
}: {
    meal: Meal;
    qty: number;
    canOrder: boolean;
    onAdd: () => void;
    onRemove: () => void;
}) {
    return (
        <View style={styles.dish}>
            {meal.imageUrl ? <Image source={{ uri: meal.imageUrl }} style={styles.dishImg} /> : null}
            <View style={styles.dishBody}>
                <View style={styles.dishHead}>
                    <Text style={styles.dishName}>{meal.name}</Text>
                    <Text style={styles.dishPrice}>
                        {symbol(meal.currency)}
                        {meal.price}
                    </Text>
                </View>
                <Text style={styles.dishDesc}>{meal.description}</Text>
                <View style={styles.badges}>
                    {meal.kosher && <Text style={styles.kosher}>✡️ Kosher</Text>}
                    {meal.prepMinutes ? <Text style={styles.tag}>⏱ {meal.prepMinutes}m</Text> : null}
                    {meal.diets.map((d) => (
                        <Text key={d} style={styles.diet}>
                            {d.replace(/_/g, ' ').toLowerCase()}
                        </Text>
                    ))}
                </View>
                {!!meal.allergens?.length && (
                    <Text style={styles.allergens}>
                        Contains: {meal.allergens.map((a) => a.toLowerCase().replace(/_/g, ' ')).join(', ')}
                    </Text>
                )}
                {canOrder && (
                    <View style={styles.stepper}>
                        {qty > 0 ? (
                            <>
                                <Pressable style={styles.stepBtn} onPress={onRemove}>
                                    <Text style={styles.stepTxt}>−</Text>
                                </Pressable>
                                <Text style={styles.qty}>{qty}</Text>
                                <Pressable style={styles.stepBtn} onPress={onAdd}>
                                    <Text style={styles.stepTxt}>+</Text>
                                </Pressable>
                            </>
                        ) : (
                            <Pressable style={styles.addBtn} onPress={onAdd}>
                                <Text style={styles.addTxt}>Add</Text>
                            </Pressable>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#faf7f2' },
    empty: { textAlign: 'center', color: '#8a8275', marginTop: 30 },
    cover: { width: '100%', height: 200, backgroundColor: '#f1ece3' },
    backBtn: {
        position: 'absolute',
        top: 12,
        left: 12,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backTxt: { fontSize: 28, color: '#1d1b16', lineHeight: 30 },
    favBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    favTxt: { fontSize: 20, color: '#6b6457' },
    favOn: { color: '#d2553a' },
    profileRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingHorizontal: 18, marginTop: -34 },
    avatar: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 4,
        borderColor: '#fff',
        backgroundColor: '#e9e2d6',
    },
    who: { flex: 1, paddingBottom: 6 },
    kitchen: { fontSize: 20, fontWeight: '800', color: '#1d1b16' },
    byline: { color: '#6b6457', fontSize: 14, marginTop: 2 },
    bio: { color: '#44403a', fontSize: 15, lineHeight: 22, paddingHorizontal: 18, marginTop: 14 },
    addr: { color: '#6b6457', fontSize: 13, paddingHorizontal: 18, marginTop: 8 },
    paused: { color: '#b3261e', fontSize: 13, paddingHorizontal: 18, marginTop: 8, fontWeight: '600' },
    menuTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1d1b16',
        paddingHorizontal: 18,
        marginTop: 24,
        marginBottom: 8,
    },
    dish: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f0e9dd',
        overflow: 'hidden',
        marginHorizontal: 16,
        marginBottom: 14,
    },
    dishImg: { width: '100%', height: 140, backgroundColor: '#f1ece3' },
    dishBody: { padding: 14, gap: 8 },
    dishHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    dishName: { fontSize: 17, fontWeight: '700', color: '#1d1b16', flex: 1 },
    dishPrice: { color: '#d2553a', fontWeight: '800', fontSize: 16 },
    dishDesc: { color: '#6b6457', fontSize: 14, lineHeight: 20 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    kosher: {
        backgroundColor: '#eef3ff',
        color: '#3a57d2',
        borderRadius: 999,
        paddingVertical: 3,
        paddingHorizontal: 9,
        fontSize: 12,
        fontWeight: '600',
    },
    tag: {
        backgroundColor: '#f1ece3',
        color: '#6b6457',
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
    allergens: { color: '#8a8275', fontSize: 12, fontStyle: 'italic' },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
    stepBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#f1ece3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepTxt: { fontSize: 22, color: '#d2553a', lineHeight: 24 },
    qty: { fontSize: 16, fontWeight: '700', minWidth: 18, textAlign: 'center' },
    addBtn: {
        backgroundColor: '#fff0e8',
        borderWidth: 1,
        borderColor: '#d2553a',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 18,
        alignSelf: 'flex-start',
    },
    addTxt: { color: '#d2553a', fontWeight: '700' },
    checkoutBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 20,
        backgroundColor: '#d2553a',
        borderRadius: 14,
        paddingVertical: 15,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    checkoutText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
