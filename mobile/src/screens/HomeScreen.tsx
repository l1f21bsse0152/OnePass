
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../theme';

export default function HomeScreen() {
  const { isDark, theme, toggleTheme } = useTheme();
  const c = theme.colors;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xxl,
    },
    logo: {
      color: c.text,
      fontSize: 27,
      fontWeight: '800',
      letterSpacing: -1.2,
    },
    logoAccent: {
      color: c.primaryDark,
    },
    themeButton: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    themeButtonText: {
      color: c.text,
      fontWeight: '700',
      fontSize: typography.small,
    },
    greeting: {
      color: c.textSecondary,
      fontSize: typography.body,
      marginBottom: spacing.xs,
    },
    heading: {
      color: c.text,
      fontSize: typography.title,
      fontWeight: '800',
      lineHeight: 38,
      marginBottom: spacing.sm,
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: typography.body,
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    wallet: {
      backgroundColor: c.primarySoft,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: c.border,
    },
    walletTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    walletLabel: {
      color: c.textSecondary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    walletIcon: {
      backgroundColor: c.surface,
      width: 38,
      height: 38,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    walletIconText: {
      fontSize: 19,
    },
    balance: {
      color: c.text,
      fontSize: 34,
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    pointsLabel: {
      color: c.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.xl,
    },
    topUpButton: {
      backgroundColor: c.primaryDark,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    topUpText: {
      color: '#FFFFFF',
      fontSize: typography.body,
      fontWeight: '700',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      color: c.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    viewAll: {
      color: c.primaryDark,
      fontSize: typography.small,
      fontWeight: '700',
    },
    quickActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.xxl,
    },
    action: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xs,
    },
    actionIcon: {
      width: 46,
      height: 46,
      backgroundColor: c.primarySoft,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    actionIconText: {
      fontSize: 21,
    },
    actionText: {
      color: c.text,
      fontSize: typography.small,
      fontWeight: '700',
    },
    facilityCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    facilityTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    facilityIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: c.secondarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    facilityEmoji: {
      fontSize: 23,
    },
    facilityInfo: {
      flex: 1,
    },
    facilityName: {
      color: c.text,
      fontSize: typography.regular,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    facilityCategory: {
      color: c.textSecondary,
      fontSize: typography.small,
    },
    distance: {
      color: c.secondaryDark,
      fontSize: typography.small,
      fontWeight: '700',
    },
    facilityDescription: {
      color: c.textSecondary,
      fontSize: typography.body,
      lineHeight: 21,
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: c.secondarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      marginTop: spacing.md,
    },
    badgeText: {
      color: c.secondaryDark,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
  });

  const quickActions = [
    { icon: '⌗', label: 'Scan QR' },
    { icon: '+', label: 'Top Up' },
    { icon: '⌖', label: 'Explore' },
    { icon: '◷', label: 'History' },
  ];

  const facilities = [
    {
      icon: '🏋️',
      name: 'Fitness & Gym',
      category: 'Fitness facilities',
      distance: 'Nearby',
      description:
        'Discover fitness centers and gyms available through OnePass.',
      badge: 'EXPLORE FITNESS',
    },
    {
      icon: '💻',
      name: 'Workspaces',
      category: 'Co-working spaces',
      distance: 'Discover',
      description: 'Find productive workspaces and shared offices.',
      badge: 'EXPLORE WORKSPACES',
    },
    {
      icon: '☕',
      name: 'Lifestyle',
      category: 'Lifestyle facilities',
      distance: 'Discover',
      description:
        'Explore participating lifestyle and leisure facilities.',
      badge: 'EXPLORE LIFESTYLE',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>
            OnePass<Text style={styles.logoAccent}>.</Text>
          </Text>

          <Pressable
            style={styles.themeButton}
            onPress={toggleTheme}
            accessibilityRole="button"
            accessibilityLabel="Toggle color theme"
          >
            <Text style={styles.themeButtonText}>
              {isDark ? '☀ Light mode' : '☾ Dark mode'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.greeting}>WELCOME TO ONEPASS</Text>

        <Text style={styles.heading}>
          One world.{'\n'}One Pass.
        </Text>

        <Text style={styles.subtitle}>
          Your subscriptions, your facilities, your freedom.
          Everything connected in one place.
        </Text>

        <View style={styles.wallet}>
          <View style={styles.walletTop}>
            <Text style={styles.walletLabel}>
              Available balance
            </Text>

            <View style={styles.walletIcon}>
              <Text style={styles.walletIconText}>◈</Text>
            </View>
          </View>

          <Text style={styles.balance}>2,450 PTS</Text>

          <Text style={styles.pointsLabel}>
            OnePass reward points
          </Text>

          <Pressable style={styles.topUpButton}>
            <Text style={styles.topUpText}>+  Top Up Wallet</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick access</Text>
        </View>

        <View style={styles.quickActions}>
          {quickActions.map((item) => (
            <Pressable
              key={item.label}
              style={styles.action}
              accessibilityRole="button"
            >
              <View style={styles.actionIcon}>
                <Text style={styles.actionIconText}>
                  {item.icon}
                </Text>
              </View>

              <Text style={styles.actionText}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Explore facilities
          </Text>

          <Text style={styles.viewAll}>View all →</Text>
        </View>

        {facilities.map((facility) => (
          <Pressable
            key={facility.name}
            style={styles.facilityCard}
            accessibilityRole="button"
          >
            <View style={styles.facilityTop}>
              <View style={styles.facilityIcon}>
                <Text style={styles.facilityEmoji}>
                  {facility.icon}
                </Text>
              </View>

              <View style={styles.facilityInfo}>
                <Text style={styles.facilityName}>
                  {facility.name}
                </Text>

                <Text style={styles.facilityCategory}>
                  {facility.category}
                </Text>
              </View>

              <Text style={styles.distance}>
                {facility.distance}
              </Text>
            </View>

            <Text style={styles.facilityDescription}>
              {facility.description}
            </Text>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {facility.badge}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
