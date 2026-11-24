import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AccountDetailsScreen from '../screens/AccountDetailsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UpdatePasswordScreen from '../screens/UpdatePasswordScreen';
import type { ProfileStackParamList } from './ProfileStackParamList';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="AccountDetails" component={AccountDetailsScreen} />
      <Stack.Screen name="UpdatePassword" component={UpdatePasswordScreen} />
    </Stack.Navigator>
  );
}
