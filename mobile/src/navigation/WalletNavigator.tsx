import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ActivePassDetailsScreen from '../screens/ActivePassDetailsScreen';
import CardDesignScreen from '../screens/CardDesignScreen';
import WalletScreen from '../screens/WalletScreen';
import type { WalletStackParamList } from './WalletStackParamList';

const Stack = createNativeStackNavigator<WalletStackParamList>();

export default function WalletNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="WalletHome" component={WalletScreen} />
      <Stack.Screen name="ActivePass" component={ActivePassDetailsScreen} />
      <Stack.Screen name="CardDesign" component={CardDesignScreen} />
    </Stack.Navigator>
  );
}
