
import React from 'react';
import {
  View,
  ActivityIndicator,
  Pressable,
  Text,
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isTravelerRole } from '../utils/mobileRoleAccess';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import FacilityDetailsScreen from '../screens/FacilityDetailsScreen';
import type { RootStackParamList } from './RootStackParamList';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RoleRestrictedScreen({ onSignOut }: { onSignOut: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: c.background,
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
        }}
      >
        <MaterialCommunityIcons
          name="web"
          size={48}
          color={c.primaryDark}
        />
        <Text
          style={{
            color: c.text,
            fontSize: 22,
            fontWeight: '800',
            textAlign: 'center',
            marginTop: 18,
          }}
        >
          Use the web dashboard
        </Text>
        <Text
          style={{
            color: c.textSecondary,
            fontSize: 14,
            lineHeight: 21,
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          The OnePass mobile app is for user accounts. Admin and facility
          accounts should use their web dashboard.
        </Text>
        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          style={{
            minHeight: 46,
            paddingHorizontal: 24,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.primaryAction,
            marginTop: 24,
          }}
        >
          <Text style={{ color: c.onPrimaryAction, fontWeight: '800' }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function RootNavigator() {
  const { user, isLoading, logout } = useAuth();
  const { theme } = useTheme();

  // Wait until the saved session has been checked.
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
        />
      </View>
    );
  }

  // Authenticated users enter the main application.
  if (isTravelerRole(user?.role)) {
    return (
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen
          name="FacilityDetails"
          component={FacilityDetailsScreen}
        />
      </Stack.Navigator>
    );
  }

  if (user) {
    return <RoleRestrictedScreen onSignOut={() => void logout()} />;
  }

  // Unauthenticated users enter the authentication flow.
  return <AuthNavigator />;
}
