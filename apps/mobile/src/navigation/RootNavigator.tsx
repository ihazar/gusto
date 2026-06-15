import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/auth-context';
import { LoginScreen } from '../screens/LoginScreen';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';

export type RootStackParamList = {
    Login: undefined;
    ComingSoon: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#faf7f2' }}>
                <ActivityIndicator color="#d2553a" />
            </View>
        );
    }

    return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            {user ? (
                <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
            ) : (
                <Stack.Screen name="Login" component={LoginScreen} />
            )}
        </Stack.Navigator>
    );
}
