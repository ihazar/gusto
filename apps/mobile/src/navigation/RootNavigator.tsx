import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/auth-context';
import { LoginScreen } from '../screens/LoginScreen';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ChefLiveScreen } from '../screens/ChefLiveScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { KitchenDetailScreen } from '../screens/KitchenDetailScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { MyOrdersScreen } from '../screens/MyOrdersScreen';

export type CartLine = { dishId: string; name: string; price: number; qty: number };

export type RootStackParamList = {
    Login: undefined;
    ComingSoon: undefined;
    Onboarding: undefined;
    ChefLive: { kitchenName: string } | undefined;
    Discover: undefined;
    KitchenDetail: { id: string; name: string };
    Checkout: { kitchenId: string; kitchenName: string; items: CartLine[] };
    MyOrders: undefined;
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
                <>
                    <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
                    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                    <Stack.Screen name="ChefLive" component={ChefLiveScreen} />
                    <Stack.Screen name="Discover" component={DiscoverScreen} />
                    <Stack.Screen name="KitchenDetail" component={KitchenDetailScreen} />
                    <Stack.Screen name="Checkout" component={CheckoutScreen} />
                    <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
                </>
            ) : (
                <Stack.Screen name="Login" component={LoginScreen} />
            )}
        </Stack.Navigator>
    );
}
