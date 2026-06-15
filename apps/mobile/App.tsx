import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/auth/auth-context';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <NavigationContainer>
                    <StatusBar style="dark" />
                    <RootNavigator />
                </NavigationContainer>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
