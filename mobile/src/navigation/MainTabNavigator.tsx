
import React from 'react';
import ExploreScreen from '../screens/ExploreScreen';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

function PlaceholderScreen({ title }: { title: string }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View
      style={[
        styles.placeholder,
        { backgroundColor: c.background },
      ]}
    >
      <Text style={[styles.placeholderTitle, { color: c.text }]}>
        {title}
      </Text>
      <Text style={[styles.placeholderText, { color: c.textSecondary }]}>
        This screen is coming soon.
      </Text>
    </View>
  );
}

export default function MainTabNavigator() {
  const { theme } = useTheme();
  const c = theme.colors;

  const tabIcons: Record<string, string> = {
    Home: '⌂',
    Explore: '⌖',
    Scan: '▣',
    Activity: '◷',
    Profile: '◉',
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primaryDark,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 64,
          paddingTop: 7,
          paddingBottom: 7,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 21 }}>
            {tabIcons[route.name]}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
<Tab.Screen name="Explore" component={ExploreScreen} />

      <Tab.Screen name="Scan">
        {() => <PlaceholderScreen title="Scan QR" />}
      </Tab.Screen>

      <Tab.Screen name="Activity">
        {() => <PlaceholderScreen title="Activity" />}
      </Tab.Screen>

      <Tab.Screen name="Profile">
        {() => <PlaceholderScreen title="Profile" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
  },
});
