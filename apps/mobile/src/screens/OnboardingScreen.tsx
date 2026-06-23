import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Diet } from '@gusto/contracts';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../auth/auth-context';
import { api } from '../api/client';

const DIET_LABEL: Record<Diet, string> = {
    [Diet.VEGETARIAN]: '🥗 Vegetarian',
    [Diet.VEGAN]: '🌱 Vegan',
    [Diet.PESCATARIAN]: '🐟 Pescatarian',
    [Diet.PALEO]: '🍖 Paleo',
    [Diet.KETO]: '🥑 Keto',
    [Diet.GLUTEN_FREE]: '🌾 Gluten-free',
    [Diet.DAIRY_FREE]: '🥛 Dairy-free',
    [Diet.NUT_FREE]: '🥜 Nut-free',
    [Diet.HALAL]: '☪️ Halal',
    [Diet.KOSHER]: '✡️ Kosher',
};
const ALL_DIETS = Object.values(Diet);
const STEPS = ['About', 'Photos', 'Location', 'Dish', 'Review'];

const DEFAULT_SELFIE = 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&h=400&fit=crop';
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1600&h=500&fit=crop';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen({ navigation }: Props) {
    const { callWithAuth } = useAuth();

    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [data, setData] = useState({
        name: '',
        kitchenName: '',
        bio: '',
        selfieUrl: DEFAULT_SELFIE,
        timelineUrl: DEFAULT_COVER,
        line1: '',
        city: '',
        region: '',
        postalCode: '',
        country: 'IL',
        lat: '32.0853',
        lng: '34.7818',
    });
    const [dish, setDish] = useState({
        name: '',
        description: '',
        price: '',
        currency: 'ILS',
        imageUrl: '',
        diets: [] as Diet[],
    });

    const set = (patch: Partial<typeof data>) => setData((d) => ({ ...d, ...patch }));
    const setDishField = (patch: Partial<typeof dish>) => setDish((d) => ({ ...d, ...patch }));

    const toggleDiet = (d: Diet) =>
        setDish((s) => ({
            ...s,
            diets: s.diets.includes(d) ? s.diets.filter((x) => x !== d) : [...s.diets, d],
        }));

    const pickImage = async (apply: (uri: string) => void) => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            setError('Photo access is needed to choose an image (or paste a URL).');
            return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
        });
        if (!res.canceled && res.assets[0]) apply(res.assets[0].uri);
    };

    const canProceed = (): boolean => {
        switch (step) {
            case 0:
                return !!data.kitchenName.trim() && !!data.name.trim();
            case 2:
                return !!data.line1.trim() && !!data.city.trim() && data.country.trim().length === 2;
            case 3:
                return !dish.name.trim() || (!!dish.description.trim() && !!dish.price.trim());
            default:
                return true;
        }
    };

    const next = () => {
        if (!canProceed()) {
            setError('Please complete the highlighted fields.');
            return;
        }
        setError(null);
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
    };
    const back = () => {
        setError(null);
        setStep((s) => Math.max(s - 1, 0));
    };

    const publish = async () => {
        setBusy(true);
        setError(null);
        try {
            const meals =
                dish.name.trim() && dish.price.trim()
                    ? [
                          {
                              name: dish.name.trim(),
                              description: dish.description.trim(),
                              price: Number(dish.price),
                              currency: (dish.currency || 'ILS').toUpperCase(),
                              diets: dish.diets,
                              imageUrl: dish.imageUrl || undefined,
                              available: true,
                          },
                      ]
                    : [];
            await callWithAuth((token) =>
                api.chef.completeOnboarding(token, {
                    name: data.name.trim(),
                    kitchenName: data.kitchenName.trim(),
                    bio: data.bio.trim(),
                    selfieUrl: data.selfieUrl,
                    timelineUrl: data.timelineUrl,
                    address: {
                        line1: data.line1.trim(),
                        city: data.city.trim(),
                        region: data.region.trim() || undefined,
                        postalCode: data.postalCode.trim() || undefined,
                        country: (data.country || 'IL').toUpperCase(),
                    },
                    location: { lat: Number(data.lat), lng: Number(data.lng) },
                    meals,
                }),
            );
            navigation.replace('ChefLive', { kitchenName: data.kitchenName.trim() });
        } catch (e) {
            setError((e as Error).message || 'Could not publish your page. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const prefill = () => {
        setData({
            name: 'Maya Cohen',
            kitchenName: "Maya's Levantine Table",
            bio: 'Home-cook from Florentin. I make the mezze and slow-cooked stews I grew up on — made to order, never frozen.',
            selfieUrl: DEFAULT_SELFIE,
            timelineUrl: DEFAULT_COVER,
            line1: '14 Vital St',
            city: 'Tel Aviv-Yafo',
            region: 'Tel Aviv District',
            postalCode: '6603714',
            country: 'IL',
            lat: '32.0556',
            lng: '34.7686',
        });
        setDish({
            name: 'Green shakshuka',
            description: 'Chard, spinach, leek and feta simmered with eggs and za’atar. Comes with sourdough.',
            price: '39',
            currency: 'ILS',
            imageUrl: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=600&h=400&fit=crop',
            diets: [Diet.VEGETARIAN, Diet.KETO, Diet.NUT_FREE],
        });
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <View style={styles.brandRow}>
                    <Text style={styles.logo}>🍳</Text>
                    <Text style={styles.brand}>Become a chef</Text>
                </View>
                <Pressable onPress={prefill} hitSlop={8}>
                    <Text style={styles.sample}>Use sample</Text>
                </Pressable>
            </View>

            {/* progress */}
            <View style={styles.steps}>
                {STEPS.map((s, i) => (
                    <View key={s} style={styles.stepItem}>
                        <View style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}>
                            <Text style={[styles.dotText, i <= step && styles.dotTextOn]}>
                                {i < step ? '✓' : i + 1}
                            </Text>
                        </View>
                        <Text style={[styles.stepLbl, i === step && styles.stepLblActive]}>{s}</Text>
                    </View>
                ))}
            </View>

            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    {step === 0 && (
                        <>
                            <Text style={styles.label}>Kitchen name</Text>
                            <TextInput
                                style={styles.input}
                                value={data.kitchenName}
                                onChangeText={(t) => set({ kitchenName: t })}
                                placeholder="e.g. Maya’s Levantine Table"
                                placeholderTextColor="#bcb4a6"
                            />
                            <Text style={styles.label}>Your name</Text>
                            <TextInput
                                style={styles.input}
                                value={data.name}
                                onChangeText={(t) => set({ name: t })}
                                placeholder="e.g. Maya Cohen"
                                placeholderTextColor="#bcb4a6"
                            />
                            <Text style={styles.label}>Bio</Text>
                            <TextInput
                                style={[styles.input, styles.textarea]}
                                value={data.bio}
                                onChangeText={(t) => set({ bio: t })}
                                placeholder="Tell customers about your cooking…"
                                placeholderTextColor="#bcb4a6"
                                multiline
                            />
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <Text style={styles.hint}>Add a profile photo and a cover, or keep the defaults.</Text>
                            <Text style={styles.label}>Profile photo</Text>
                            <View style={styles.photoRow}>
                                <Image source={{ uri: data.selfieUrl }} style={styles.avatar} />
                                <Pressable
                                    style={styles.pickBtn}
                                    onPress={() => pickImage((uri) => set({ selfieUrl: uri }))}
                                >
                                    <Text style={styles.pickText}>Choose photo</Text>
                                </Pressable>
                            </View>
                            <Text style={styles.label}>Cover photo</Text>
                            <Image source={{ uri: data.timelineUrl }} style={styles.cover} />
                            <Pressable
                                style={styles.pickBtn}
                                onPress={() => pickImage((uri) => set({ timelineUrl: uri }))}
                            >
                                <Text style={styles.pickText}>Choose cover</Text>
                            </Pressable>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <Text style={styles.hint}>We use your kitchen’s location to match nearby customers.</Text>
                            <Text style={styles.label}>Street address</Text>
                            <TextInput
                                style={styles.input}
                                value={data.line1}
                                onChangeText={(t) => set({ line1: t })}
                                placeholder="14 Vital St"
                                placeholderTextColor="#bcb4a6"
                            />
                            <View style={styles.row}>
                                <View style={styles.col}>
                                    <Text style={styles.label}>City</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={data.city}
                                        onChangeText={(t) => set({ city: t })}
                                        placeholder="Tel Aviv-Yafo"
                                        placeholderTextColor="#bcb4a6"
                                    />
                                </View>
                                <View style={styles.colNarrow}>
                                    <Text style={styles.label}>Country</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={data.country}
                                        onChangeText={(t) => set({ country: t.toUpperCase().slice(0, 2) })}
                                        placeholder="IL"
                                        placeholderTextColor="#bcb4a6"
                                        autoCapitalize="characters"
                                        maxLength={2}
                                    />
                                </View>
                            </View>
                            <View style={styles.row}>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Latitude</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={data.lat}
                                        onChangeText={(t) => set({ lat: t })}
                                        keyboardType="numbers-and-punctuation"
                                    />
                                </View>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Longitude</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={data.lng}
                                        onChangeText={(t) => set({ lng: t })}
                                        keyboardType="numbers-and-punctuation"
                                    />
                                </View>
                            </View>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <Text style={styles.hint}>Add your first dish now, or skip and add it later.</Text>
                            <Text style={styles.label}>Dish name</Text>
                            <TextInput
                                style={styles.input}
                                value={dish.name}
                                onChangeText={(t) => setDishField({ name: t })}
                                placeholder="e.g. Green shakshuka"
                                placeholderTextColor="#bcb4a6"
                            />
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textarea]}
                                value={dish.description}
                                onChangeText={(t) => setDishField({ description: t })}
                                placeholder="What’s in it, how it’s served…"
                                placeholderTextColor="#bcb4a6"
                                multiline
                            />
                            <View style={styles.row}>
                                <View style={styles.colNarrow}>
                                    <Text style={styles.label}>Currency</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={dish.currency}
                                        onChangeText={(t) => setDishField({ currency: t.toUpperCase().slice(0, 3) })}
                                        autoCapitalize="characters"
                                        maxLength={3}
                                    />
                                </View>
                                <View style={styles.col}>
                                    <Text style={styles.label}>Price</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={dish.price}
                                        onChangeText={(t) => setDishField({ price: t })}
                                        placeholder="39"
                                        placeholderTextColor="#bcb4a6"
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>
                            <Text style={styles.label}>Diets</Text>
                            <View style={styles.chips}>
                                {ALL_DIETS.map((d) => (
                                    <Pressable
                                        key={d}
                                        style={[styles.chip, dish.diets.includes(d) && styles.chipOn]}
                                        onPress={() => toggleDiet(d)}
                                    >
                                        <Text style={[styles.chipText, dish.diets.includes(d) && styles.chipTextOn]}>
                                            {DIET_LABEL[d]}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                            <Text style={styles.label}>Photo</Text>
                            <View style={styles.photoRow}>
                                {dish.imageUrl ? (
                                    <Image source={{ uri: dish.imageUrl }} style={styles.thumb} />
                                ) : (
                                    <View style={[styles.thumb, styles.thumbEmpty]}>
                                        <Text style={styles.thumbEmptyText}>No photo</Text>
                                    </View>
                                )}
                                <Pressable
                                    style={styles.pickBtn}
                                    onPress={() => pickImage((uri) => setDishField({ imageUrl: uri }))}
                                >
                                    <Text style={styles.pickText}>Choose photo</Text>
                                </Pressable>
                            </View>
                        </>
                    )}

                    {step === 4 && (
                        <>
                            <View style={styles.preview}>
                                <Image source={{ uri: data.timelineUrl }} style={styles.pvCover} />
                                <View style={styles.pvBar}>
                                    <Text style={styles.pvName} numberOfLines={1}>
                                        {data.kitchenName || 'Your kitchen'}
                                    </Text>
                                    <Text style={styles.pvBy} numberOfLines={1}>
                                        by {data.name || 'you'} · {data.city || '—'}
                                    </Text>
                                </View>
                                <Image source={{ uri: data.selfieUrl }} style={styles.pvAvatar} />
                            </View>
                            <SummaryRow label="Kitchen" value={data.kitchenName || '—'} />
                            <SummaryRow label="Chef" value={data.name || '—'} />
                            <SummaryRow
                                label="Address"
                                value={[data.line1, data.city, data.country].filter(Boolean).join(', ') || '—'}
                            />
                            <SummaryRow label="First dish" value={dish.name.trim() ? dish.name : 'None yet'} />
                            <Text style={styles.hint}>
                                Publishing makes your page live and starts accepting orders.
                            </Text>
                        </>
                    )}

                    {error && <Text style={styles.error}>{error}</Text>}
                </ScrollView>

                <View style={styles.nav}>
                    {step > 0 ? (
                        <Pressable style={styles.ghost} onPress={back}>
                            <Text style={styles.ghostText}>← Back</Text>
                        </Pressable>
                    ) : (
                        <View style={styles.flex} />
                    )}
                    {step < STEPS.length - 1 ? (
                        <Pressable style={[styles.primary, !canProceed() && styles.primaryOff]} onPress={next}>
                            <Text style={styles.primaryText}>Continue →</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            style={[styles.primary, busy && styles.primaryOff]}
                            onPress={publish}
                            disabled={busy}
                        >
                            {busy ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryText}>Publish my page 🎉</Text>
                            )}
                        </Pressable>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{label}</Text>
            <Text style={styles.sumValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#faf7f2' },
    flex: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logo: { fontSize: 22 },
    brand: { fontSize: 20, fontWeight: '800', color: '#d2553a' },
    sample: { color: '#6b6457', fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' },

    steps: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10 },
    stepItem: { flex: 1, alignItems: 'center', gap: 4 },
    dot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#f1ece3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotActive: { backgroundColor: '#d2553a' },
    dotDone: { backgroundColor: '#e6f4ec' },
    dotText: { color: '#8a8275', fontWeight: '700', fontSize: 13 },
    dotTextOn: { color: '#fff' },
    stepLbl: { fontSize: 11, color: '#b6ab99', fontWeight: '600' },
    stepLblActive: { color: '#44403a' },

    body: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
    label: { fontSize: 13, fontWeight: '600', color: '#44403a', marginTop: 8 },
    hint: { color: '#6b6457', fontSize: 14, marginBottom: 2 },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e3ddd2',
        borderRadius: 10,
        paddingHorizontal: 13,
        paddingVertical: 11,
        fontSize: 16,
        color: '#1d1b16',
    },
    textarea: { height: 88, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },
    colNarrow: { width: 110 },

    photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#f1ece3' },
    cover: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#f1ece3' },
    thumb: { width: 84, height: 64, borderRadius: 10, backgroundColor: '#f1ece3' },
    thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
    thumbEmptyText: { color: '#b6ab99', fontSize: 12 },
    pickBtn: {
        borderWidth: 1,
        borderColor: '#e3ddd2',
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignSelf: 'flex-start',
    },
    pickText: { color: '#7a4a36', fontWeight: '600' },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        borderWidth: 1,
        borderColor: '#ecdfd0',
        backgroundColor: '#fff',
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 12,
    },
    chipOn: { backgroundColor: '#fff0e8', borderColor: '#d2553a' },
    chipText: { color: '#7a4a36', fontWeight: '600', fontSize: 13 },
    chipTextOn: { color: '#d2553a' },

    preview: {
        position: 'relative',
        borderWidth: 1,
        borderColor: '#f0e9dd',
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#fff',
    },
    pvCover: { width: '100%', height: 110, backgroundColor: '#f1ece3' },
    // Text stays on the white bar; paddingLeft clears the overlapping avatar.
    pvBar: { paddingLeft: 80, paddingRight: 14, paddingTop: 8, paddingBottom: 12 },
    pvAvatar: {
        position: 'absolute',
        left: 14,
        top: 82,
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: '#fff',
        backgroundColor: '#e9e2d6',
    },
    pvName: { fontSize: 16, fontWeight: '700', color: '#1d1b16' },
    pvBy: { color: '#6b6457', fontSize: 13 },
    sumRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#f3eee5',
        gap: 16,
    },
    sumLabel: { color: '#8a8275', fontSize: 14 },
    sumValue: { fontWeight: '600', color: '#1d1b16', flexShrink: 1, textAlign: 'right' },

    error: { color: '#b3261e', fontSize: 14, marginTop: 12 },

    nav: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 6,
        borderTopWidth: 1,
        borderTopColor: '#f0e9dd',
    },
    ghost: {
        borderWidth: 1,
        borderColor: '#e3ddd2',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 18,
    },
    ghostText: { color: '#6b6457', fontWeight: '600' },
    primary: {
        flex: 1,
        backgroundColor: '#d2553a',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryOff: { opacity: 0.5 },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
