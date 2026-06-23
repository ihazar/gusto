import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OtpChannel } from '@gusto/contracts';
import { useAuth } from '../auth/auth-context';
import { COUNTRIES, Country, isValidE164, toE164 } from '../lib/phone';

type Step = 'phone' | 'code';

export function LoginScreen() {
    const { requestOtp, verifyOtp } = useAuth();

    const [step, setStep] = useState<Step>('phone');
    const [country, setCountry] = useState<Country>(COUNTRIES[0]);
    const [national, setNational] = useState('');
    const [channel, setChannel] = useState<OtpChannel>('sms');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submittedPhone, setSubmittedPhone] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);

    const preview = toE164(country.dial, national);

    const sendCode = async () => {
        const phone = toE164(country.dial, national);
        if (!isValidE164(phone)) {
            setError('Enter a valid phone number.');
            return;
        }
        setError(null);
        setBusy(true);
        try {
            await requestOtp(phone, channel);
            setSubmittedPhone(phone);
            setStep('code');
        } catch (e) {
            setError((e as Error).message || 'Could not send a code. Check the number and try again.');
        } finally {
            setBusy(false);
        }
    };

    const verify = async () => {
        setError(null);
        setBusy(true);
        try {
            await verifyOtp(submittedPhone, code.trim());
            // success flips auth state → RootNavigator shows ComingSoon
        } catch (e) {
            setError((e as Error).message || 'That code did not work. Try again.');
        } finally {
            setBusy(false);
        }
    };

    const reset = () => {
        setCode('');
        setError(null);
        setStep('phone');
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.container}>
                    <View style={styles.brandRow}>
                        <Text style={styles.logo}>🍳</Text>
                        <Text style={styles.brand}>Gusto</Text>
                    </View>
                    <Text style={styles.tagline}>Home-cooked meals from chefs near you.</Text>

                    <View style={styles.card}>
                        {step === 'phone' ? (
                            <>
                                <Text style={styles.h2}>Log in</Text>
                                <Text style={styles.sub}>We'll send you a one-time code.</Text>

                                <View style={styles.seg}>
                                    <Pressable
                                        style={[styles.segBtn, channel === 'sms' && styles.segActive]}
                                        onPress={() => setChannel('sms')}
                                    >
                                        <Text style={[styles.segText, channel === 'sms' && styles.segTextActive]}>
                                            SMS
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.segBtn, channel === 'whatsapp' && styles.segActive]}
                                        onPress={() => setChannel('whatsapp')}
                                    >
                                        <Text style={[styles.segText, channel === 'whatsapp' && styles.segTextActive]}>
                                            WhatsApp
                                        </Text>
                                    </Pressable>
                                </View>

                                <Text style={styles.label}>Phone number</Text>
                                <View style={styles.phoneRow}>
                                    <Pressable style={styles.ccBtn} onPress={() => setPickerOpen(true)}>
                                        <Text style={styles.ccText}>
                                            {country.flag} {country.dial}
                                        </Text>
                                    </Pressable>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="54-5600700"
                                        placeholderTextColor="#bcb4a6"
                                        keyboardType="phone-pad"
                                        autoFocus
                                        value={national}
                                        onChangeText={setNational}
                                    />
                                </View>
                                {national.length > 0 && (
                                    <Text style={styles.preview}>📲 Code will be sent to {preview}</Text>
                                )}

                                <Pressable
                                    style={[styles.primary, (busy || !national) && styles.disabled]}
                                    disabled={busy || !national}
                                    onPress={sendCode}
                                >
                                    {busy ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryText}>Log in</Text>
                                    )}
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Text style={styles.h2}>Enter your code</Text>
                                <Text style={styles.sub}>
                                    Sent via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to {submittedPhone}
                                </Text>

                                <Text style={styles.label}>6-digit code</Text>
                                <TextInput
                                    style={[styles.input, styles.otp]}
                                    placeholder="------"
                                    placeholderTextColor="#cdc5b7"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                    value={code}
                                    onChangeText={setCode}
                                />

                                <Pressable
                                    style={[styles.primary, (busy || code.length < 6) && styles.disabled]}
                                    disabled={busy || code.length < 6}
                                    onPress={verify}
                                >
                                    {busy ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.primaryText}>Verify & enter</Text>
                                    )}
                                </Pressable>
                                <Pressable onPress={reset}>
                                    <Text style={styles.linkText}>Use a different number</Text>
                                </Pressable>
                            </>
                        )}

                        {error && <Text style={styles.error}>{error}</Text>}
                    </View>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select country</Text>
                        <FlatList
                            data={COUNTRIES}
                            keyExtractor={(c) => c.dial}
                            renderItem={({ item }) => (
                                <Pressable
                                    style={styles.countryRow}
                                    onPress={() => {
                                        setCountry(item);
                                        setPickerOpen(false);
                                    }}
                                >
                                    <Text style={styles.countryText}>
                                        {item.flag} {item.name}
                                    </Text>
                                    <Text style={styles.countryDial}>{item.dial}</Text>
                                </Pressable>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#faf7f2' },
    flex: { flex: 1 },
    container: { flex: 1, justifyContent: 'center', padding: 24, gap: 6 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logo: { fontSize: 30 },
    brand: { fontSize: 30, fontWeight: '800', color: '#d2553a', letterSpacing: -0.5 },
    tagline: { fontSize: 16, color: '#6b6457', marginBottom: 18 },

    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 22,
        gap: 12,
        shadowColor: '#7a3c1e',
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
        elevation: 4,
    },
    h2: { fontSize: 22, fontWeight: '700', color: '#1d1b16' },
    sub: { color: '#6b6457', fontSize: 14, marginTop: -4 },
    label: { fontSize: 13, fontWeight: '600', color: '#44403a', marginTop: 2 },

    seg: { flexDirection: 'row', backgroundColor: '#f1ece3', borderRadius: 12, padding: 4, gap: 4 },
    segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
    segActive: { backgroundColor: '#fff' },
    segText: { color: '#6b6457', fontWeight: '600', fontSize: 14 },
    segTextActive: { color: '#d2553a' },

    phoneRow: { flexDirection: 'row', gap: 8 },
    ccBtn: {
        borderWidth: 1,
        borderColor: '#e3ddd2',
        borderRadius: 12,
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
    ccText: { fontSize: 16, color: '#1d1b16' },
    input: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 17,
        borderWidth: 1,
        borderColor: '#e3ddd2',
        color: '#1d1b16',
    },
    otp: {
        flex: 0, // cancel input's flex:1 (this field is in a column, not a row)
        height: 58,
        paddingVertical: 0,
        textAlign: 'center',
        letterSpacing: 8,
        fontSize: 24,
        fontWeight: '700',
    },
    preview: { fontSize: 13, color: '#6b6457' },

    primary: { backgroundColor: '#d2553a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    disabled: { opacity: 0.55 },
    linkText: { color: '#6b6457', textAlign: 'center', fontSize: 14 },
    error: { color: '#b3261e', fontSize: 14 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingVertical: 16,
        maxHeight: '60%',
    },
    modalTitle: { fontSize: 16, fontWeight: '700', color: '#1d1b16', paddingHorizontal: 20, paddingBottom: 8 },
    countryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1ece3',
    },
    countryText: { fontSize: 16, color: '#1d1b16' },
    countryDial: { fontSize: 16, color: '#6b6457' },
});
