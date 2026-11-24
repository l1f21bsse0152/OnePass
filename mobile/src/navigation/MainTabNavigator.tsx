import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ActivePassScreen from '../screens/ActivePassScreen';
import AssistantScreen from '../screens/AssistantScreen';
import ExploreScreen from '../screens/ExploreScreen';
import HomeScreen from '../screens/HomeScreen';
import MonthlyHistoryScreen from '../screens/MonthlyHistoryScreen';
import ProfileNavigator from './ProfileNavigator';
import WalletNavigator from './WalletNavigator';
import { useTheme } from '../context/ThemeContext';
import type { MainTabParamList } from './MainTabParamList';

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const tabIcons: Partial<Record<keyof MainTabParamList, IconName>> = {
  Home: 'home-outline',
  Explore: 'map-search-outline',
  Wallet: 'wallet-outline',
  Profile: 'account-circle-outline',
  Assistant: 'robot-outline',
};

const tabLabels: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Explore: 'Discover',
  Scan: 'Scan',
  Wallet: 'Wallet',
  Profile: 'Profile',
  Assistant: 'Assistant',
  MonthlyHistory: 'Monthly History',
};

function QrScannerIcon({
  backgroundColor,
  borderColor,
}: {
  backgroundColor: string;
  borderColor: string;
}) {
  return (
    <View style={[styles.scanButton, { backgroundColor, borderColor }]}>
      <MaterialCommunityIcons
        name="qrcode-scan"
        size={27}
        color="#FFFFFF"
      />
    </View>
  );
}

export default function MainTabNavigator() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const hiddenRoute = ['Assistant', 'MonthlyHistory'].includes(route.name);

        return {
          headerShown: false,
          tabBarActiveTintColor: c.primaryDark,
          tabBarInactiveTintColor: c.textSecondary,
          tabBarStyle: {
            backgroundColor: c.surface,
            borderTopColor: c.border,
            borderTopWidth: 0,
            borderRadius: 24,
            flexDirection: 'row',
            height: 72,
            marginHorizontal: 12,
            marginBottom: 8,
            paddingTop: 7,
            paddingBottom: 6,
            shadowColor: '#0F172A',
            shadowOpacity: 0,
            shadowRadius: 0,
            shadowOffset: { width: 0, height: 6 },
            elevation: 0,
            ...(hiddenRoute ? { display: 'none' as const } : {}),
          },
          tabBarItemStyle: {
            flexBasis: 0,
            flexGrow: 1,
            flexShrink: 1,
            width: 0,
            minWidth: 0,
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarIconStyle: {
            alignSelf: 'center',
            alignItems: 'center',
          },
          tabBarLabelPosition: 'below-icon',
          tabBarLabel: tabLabels[route.name],
          tabBarLabelStyle: {
            width: '100%',
            minWidth: 0,
            flexShrink: 1,
            fontSize: 10,
            fontWeight: '700',
            textAlign: 'center',
          },
          tabBarIcon: ({ color }) =>
            route.name === 'Scan' ? (
              <QrScannerIcon
                backgroundColor={c.primaryAction}
                borderColor={c.surface}
              />
            ) : (
              <MaterialCommunityIcons
                name={tabIcons[route.name] ?? 'help-circle-outline'}
                size={22}
                color={color}
              />
            ),
          ...(hiddenRoute
            ? {
                tabBarButton: () => null,
                tabBarItemStyle: { display: 'none' as const },
              }
            : {}),
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen
        name="Scan"
        component={ActivePassScreen}
        options={{ tabBarAccessibilityLabel: 'Scan a facility QR code' }}
      />
      <Tab.Screen name="Wallet" component={WalletNavigator} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="MonthlyHistory"
        component={MonthlyHistoryScreen}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  scanButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -10 }],
    borderWidth: 3,
    shadowColor: '#00174B',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0,
  },
});
