import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/auth-context';

type Step = 'phone' | 'code';

export function LoginScreen() {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    try {
      await requestOtp(phone.trim());
      setStep('code');
    } catch {
      Alert.alert('Hmm', 'Could not send a code. Check the number and try again.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await verifyOtp(phone.trim(), code.trim());
    } catch {
      Alert.alert('Invalid code', 'That code did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Hearth</Text>
      <Text style={styles.sub}>Home-cooked meals, near you</Text>

      {step === 'phone' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="+14155552671"
            keyboardType="phone-pad"
            autoFocus
            value={phone}
            onChangeText={setPhone}
          />
          <Pressable style={styles.button} disabled={busy} onPress={sendCode}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send code</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.hint}>Enter the 6-digit code sent to {phone}</Text>
          <TextInput
            style={styles.input}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            value={code}
            onChangeText={setCode}
          />
          <Pressable style={styles.button} disabled={busy} onPress={verify}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & continue</Text>}
          </Pressable>
          <Pressable onPress={() => setStep('phone')}>
            <Text style={styles.link}>Use a different number</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, gap: 12, backgroundColor: '#faf7f2' },
  brand: { fontSize: 40, fontWeight: '800', color: '#d2553a' },
  sub: { fontSize: 16, color: '#6b6457', marginBottom: 16 },
  hint: { color: '#6b6457' },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 18, borderWidth: 1, borderColor: '#e7e1d6' },
  button: { backgroundColor: '#d2553a', borderRadius: 12, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: '#6b6457', textAlign: 'center', marginTop: 4 },
});
