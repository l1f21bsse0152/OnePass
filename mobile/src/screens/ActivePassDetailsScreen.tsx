import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ScreenTexture from '../components/ScreenTexture';
import { useTheme } from '../context/ThemeContext';
import type { MainTabParamList } from '../navigation/MainTabParamList';
import type { WalletStackParamList } from '../navigation/WalletStackParamList';
import {
  getMyPassStatus,
  type PassStatus,
} from '../services/onepass';
import tileDepth from '../theme/tileDepth';

type ActivePassNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<WalletStackParamList, 'ActivePass'>,
  BottomTabNavigationProp<MainTabParamList, 'Wallet'>
>;

const remainingTime = (expiresAt: string) => {
  const milliseconds = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const days = Math.floor(milliseconds / 86_400_000);
  const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);

  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} left`;
  return 'Expires soon';
};

export default function ActivePassDetailsScreen() {
  const navigation = useNavigation<ActivePassNavigation>();
  const { theme } = useTheme();
  const c = theme.colors;
  const [status, setStatus] = useState<PassStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPass = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await getMyPassStatus());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load your active pass.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPass();
    }, [loadPass])
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceSecondary,
    },
    title: { color: c.text, fontSize: 20, fontWeight: '800' },
    content: { padding: 20, paddingBottom: 36, gap: 16 },
    statusCard: {
      alignItems: 'center',
      padding: 17,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.success + '44',
      ...tileDepth,
    },
    statusLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusTitle: {
      color: c.success,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    statusSubtitle: {
      color: c.textSecondary,
      fontSize: 13,
      marginTop: 5,
      textAlign: 'center',
    },
    passShell: {
      borderRadius: 22,
      shadowColor: c.primaryDark,
      shadowOpacity: 0.24,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 9 },
      elevation: 7,
    },
    passCard: {
      overflow: 'hidden',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      backgroundColor: c.primaryAction,
      padding: 20,
    },
    passGlow: {
      position: 'absolute',
      width: 190,
      height: 190,
      borderRadius: 95,
      top: -105,
      right: -56,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    passGlowSmall: {
      position: 'absolute',
      width: 112,
      height: 112,
      borderRadius: 56,
      bottom: -73,
      left: 110,
      backgroundColor: 'rgba(255,255,255,0.09)',
    },
    passTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    eyebrow: {
      color: 'rgba(255,255,255,0.76)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    planName: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '800',
      marginTop: 7,
      flexShrink: 1,
    },
    passIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pointsBlock: { marginTop: 26 },
    pointsLabel: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 12,
      fontWeight: '600',
    },
    pointsValue: {
      color: '#FFFFFF',
      fontSize: 34,
      lineHeight: 42,
      fontWeight: '800',
      marginTop: 3,
    },
    progressTrack: {
      height: 7,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.22)',
      overflow: 'hidden',
      marginTop: 10,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
    },
    passMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.22)',
    },
    passMetaLabel: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 11,
      marginBottom: 4,
    },
    passMetaValue: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    sectionCard: {
      padding: 17,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      ...tileDepth,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 10,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      marginTop: 9,
    },
    detailIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    detailText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      paddingTop: 5,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: c.primaryAction,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      ...tileDepth,
    },
    primaryButtonText: {
      color: c.onPrimaryAction,
      fontSize: 15,
      fontWeight: '800',
    },
    emptyCard: {
      padding: 22,
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...tileDepth,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
      marginBottom: 14,
    },
    emptyTitle: {
      color: c.text,
      fontSize: 19,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyText: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 16,
    },
    error: {
      color: c.danger,
      backgroundColor: c.danger + '18',
      borderRadius: 12,
      padding: 13,
      lineHeight: 20,
    },
    center: { padding: 40, alignItems: 'center' },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenTexture color={c.primary} />
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to wallet"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={c.primaryDark}
          />
        </Pressable>
        <Text style={styles.title}>My Active Pass</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primaryDark} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? (
            <View>
              <Text style={styles.error}>{error}</Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => void loadPass()}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : status?.hasActivePass ? (
            <>
              <View style={styles.statusCard}>
                <View style={styles.statusLine}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={21}
                    color={c.success}
                  />
                  <Text style={styles.statusTitle}>Pass active</Text>
                </View>
                <Text style={styles.statusSubtitle}>
                  Your pass points can be used at OnePass-enabled facilities.
                </Text>
              </View>

              {status.subscriptions.map((subscription) => {
                const totalPoints =
                  subscription.plan.includedPoints +
                  subscription.plan.bonusPoints;
                const remainingPercent = Math.min(
                  100,
                  Math.max(
                    0,
                    totalPoints > 0
                      ? (subscription.pointsRemaining / totalPoints) * 100
                      : 0
                  )
                );

                return (
                  <View
                    key={subscription._id}
                    style={styles.passShell}
                  >
                    <View style={styles.passCard}>
                      <View pointerEvents="none" style={styles.passGlow} />
                      <View pointerEvents="none" style={styles.passGlowSmall} />
                      <View style={styles.passTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.eyebrow}>Active membership</Text>
                          <Text style={styles.planName}>
                            {subscription.plan.name}
                          </Text>
                        </View>
                        <View style={styles.passIcon}>
                          <MaterialCommunityIcons
                            name="ticket-confirmation-outline"
                            size={25}
                            color="#FFFFFF"
                          />
                        </View>
                      </View>

                      <View style={styles.pointsBlock}>
                        <Text style={styles.pointsLabel}>
                          Pass points remaining
                        </Text>
                        <Text style={styles.pointsValue}>
                          {subscription.pointsRemaining.toLocaleString()}
                        </Text>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${remainingPercent}%` },
                            ]}
                          />
                        </View>
                      </View>

                      <View style={styles.passMetaRow}>
                        <View>
                          <Text style={styles.passMetaLabel}>PASS TYPE</Text>
                          <Text style={styles.passMetaValue}>
                            {subscription.plan.duration}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.passMetaLabel}>EXPIRES</Text>
                          <Text style={styles.passMetaValue}>
                            {new Date(subscription.expiresAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.passMetaLabel}>TIME LEFT</Text>
                          <Text style={styles.passMetaValue}>
                            {remainingTime(subscription.expiresAt)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>How to use your pass</Text>
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <MaterialCommunityIcons
                      name="qrcode-scan"
                      size={18}
                      color={c.primaryDark}
                    />
                  </View>
                  <Text style={styles.detailText}>
                    Scan a facility QR code to view the hourly cost and choose
                    your pass as the access method.
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <MaterialCommunityIcons
                      name="chart-donut"
                      size={18}
                      color={c.primaryDark}
                    />
                  </View>
                  <Text style={styles.detailText}>
                    Points are deducted according to the facility rate and the
                    number of hours you confirm.
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.primaryButton}
                onPress={() => navigation.navigate('Scan')}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={20}
                  color={c.onPrimaryAction}
                />
                <Text style={styles.primaryButtonText}>Scan facility QR</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <MaterialCommunityIcons
                  name="ticket-outline"
                  size={30}
                  color={c.primaryDark}
                />
              </View>
              <Text style={styles.emptyTitle}>No active universal pass</Text>
              <Text style={styles.emptyText}>
                Universal pass plans are currently display-only. You can still
                access facilities using wallet points or an active facility
                package.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Back to wallet</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
