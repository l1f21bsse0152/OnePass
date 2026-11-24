import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import ScreenTexture from '../components/ScreenTexture';
import tileDepth from '../theme/tileDepth';
import type { MainTabParamList } from '../navigation/MainTabParamList';
import type { RootStackParamList } from '../navigation/RootStackParamList';
import type { WalletStackParamList } from '../navigation/WalletStackParamList';
import {
  getAllFacilities,
  getTransactions,
  getPassPlans,
  getWallet,
  type Facility,
  type PassPlan,
  type WalletBalance,
  type WalletTransaction,
} from '../services/onepass';

type WalletNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<WalletStackParamList, 'WalletHome'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList, 'Wallet'>,
    NativeStackNavigationProp<RootStackParamList>
  >
>;

const transactionFilters = ['All', 'Access', 'Packages', 'Wallet'] as const;
type TransactionFilter = (typeof transactionFilters)[number];
type PackageCategory = 'weekly' | 'monthly' | 'onepass';

const matchesFilter = (
  item: WalletTransaction,
  filter: TransactionFilter
) => {
  if (filter === 'All') return true;
  if (filter === 'Access') {
    return (
      item.source === 'facility_access' ||
      item.source === 'onepass_pass' ||
      item.type === 'debit' ||
      item.type === 'pass_debit' ||
      item.type === 'package_access'
    );
  }
  if (filter === 'Packages') {
    return (
      item.source === 'package_purchase' ||
      item.source === 'facility_package' ||
      item.balanceScope === 'facility_package'
    );
  }
  return (
    item.balanceScope !== 'facility_package' &&
    item.balanceScope !== 'onepass_pass' &&
    item.source !== 'facility_access' &&
    item.source !== 'onepass_pass' &&
    item.source !== 'facility_package' &&
    item.source !== 'package_purchase'
  );
};

export default function WalletScreen() {
  const navigation = useNavigation<WalletNavigation>();
  const { theme, isDark } = useTheme();
  const c = theme.colors;
  const packageAccents: Record<PackageCategory, string> = isDark
    ? {
        weekly: '#55D98A',
        monthly: '#66D6E4',
        onepass: '#B49AFF',
      }
    : {
        weekly: '#168A55',
        monthly: c.primaryDark,
        onepass: '#7656B2',
      };
  const packageCardColors: Record<PackageCategory, string> = isDark
    ? {
        weekly: '#173C2A',
        monthly: '#18344B',
        onepass: '#32264E',
      }
    : {
        weekly: '#DDF6E8',
        monthly: '#E1F0FC',
        onepass: '#F0E8FF',
      };
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [passPlans, setPassPlans] = useState<PassPlan[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [transactionFilter, setTransactionFilter] =
    useState<TransactionFilter>('All');
  const [packageCategory, setPackageCategory] =
    useState<PackageCategory>('weekly');

  const loadWallet = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [balanceResult, historyResult, plansResult, facilitiesResult] =
        await Promise.allSettled([
          getWallet(),
          getTransactions(),
          getPassPlans(),
          getAllFacilities(),
        ]);

      const requestErrors: string[] = [];
      if (balanceResult.status === 'fulfilled') {
        setWallet(balanceResult.value);
      } else {
        requestErrors.push(
          balanceResult.reason instanceof Error
            ? balanceResult.reason.message
            : 'Unable to load wallet balance.'
        );
      }
      if (historyResult.status === 'fulfilled') {
        setTransactions(historyResult.value.transactions);
      } else {
        requestErrors.push(
          historyResult.reason instanceof Error
            ? historyResult.reason.message
            : 'Unable to load wallet transactions.'
        );
      }
      if (plansResult.status === 'fulfilled') {
        setPassPlans(plansResult.value);
      } else {
        requestErrors.push(
          plansResult.reason instanceof Error
            ? plansResult.reason.message
            : 'Unable to load OnePass plans.'
        );
      }
      setError(requestErrors.length > 0 ? requestErrors.join('\n') : null);

      if (facilitiesResult.status === 'fulfilled') {
        setFacilities(
          facilitiesResult.value.filter(
            (facility) => facility.accessEnabled !== false
          )
        );
        setFacilityError(null);
      } else {
        setFacilityError(
          facilitiesResult.reason instanceof Error
            ? facilitiesResult.reason.message
            : 'Unable to load facility packages.'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet])
  );

  const filteredTransactions = useMemo(
    () => transactions.filter((item) => matchesFilter(item, transactionFilter)),
    [transactions, transactionFilter]
  );
  const facilityPackages = useMemo(
    () =>
      facilities.flatMap((facility) =>
        (['weekly', 'monthly'] as const).flatMap((packageType) => {
          const packageConfig = facility.packages?.[packageType];
          return packageConfig
            ? [{ facility, packageType, ...packageConfig }]
            : [];
        })
      ),
    [facilities]
  );
  const visibleFacilityPackages = useMemo(
    () =>
      facilityPackages.filter(
        (facilityPackage) => facilityPackage.packageType === packageCategory
      ),
    [facilityPackages, packageCategory]
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 20, paddingBottom: 36 },
    title: { color: c.text, fontSize: 29, fontWeight: '800' },
    subtitle: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 5,
      marginBottom: 19,
    },
    balanceShell: {
      marginBottom: 20,
      borderRadius: 24,
      ...tileDepth,
    },
    balanceCard: {
      overflow: 'hidden',
      backgroundColor: c.primaryAction,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      padding: 21,
    },
    balanceGlow: {
      position: 'absolute',
      top: -95,
      right: -54,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    balanceGlowSmall: {
      position: 'absolute',
      bottom: -96,
      left: 150,
      width: 165,
      height: 165,
      borderRadius: 83,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    balanceTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    balanceLabel: {
      color: 'rgba(255,255,255,0.82)',
      fontSize: 13,
      fontWeight: '700',
    },
    walletIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    balanceValue: {
      color: '#FFFFFF',
      fontSize: 38,
      fontWeight: '800',
      marginTop: 8,
      letterSpacing: 0.2,
    },
    balanceUnit: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 13,
      marginTop: 1,
    },
    balances: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 21,
    },
    balanceDetail: {
      flex: 1,
      padding: 12,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.13)',
    },
    detailLabel: {
      color: 'rgba(255,255,255,0.74)',
      fontSize: 11,
      fontWeight: '600',
    },
    detailValue: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 15,
      marginTop: 5,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 11,
      marginBottom: 20,
    },
    actionTile: {
      flexBasis: '48%',
      flexGrow: 1,
      minHeight: 82,
      padding: 11,
      borderRadius: 17,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      ...tileDepth,
    },
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    actionTitle: { color: c.text, fontSize: 13, fontWeight: '800' },
    actionSubtitle: {
      color: c.textSecondary,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 4,
    },
    notice: {
      color: c.textSecondary,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 14,
      lineHeight: 20,
      marginBottom: 20,
      fontSize: 13,
    },
    packageOfferCard: {
      padding: 17,
      borderRadius: 18,
      backgroundColor: isDark ? '#202124' : c.surface,
      borderWidth: 1,
      borderColor: isDark ? '#363A40' : c.border,
      marginBottom: 13,
      ...tileDepth,
    },
    packageBrandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    packageBrandIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    packageBrand: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.2,
    },
    packageType: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    packageTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '900',
      marginTop: 16,
    },
    packageSubtitle: {
      color: c.text,
      fontSize: 17,
      lineHeight: 23,
      fontWeight: '800',
      marginTop: 5,
    },
    packagePrice: {
      color: c.text,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '900',
      marginTop: 10,
    },
    packagePriceUnit: {
      color: isDark ? '#B8BDC5' : c.textSecondary,
      fontWeight: '700',
    },
    packageDivider: {
      height: 1,
      backgroundColor: isDark ? '#44474C' : c.border,
      marginVertical: 17,
    },
    packageBenefits: { gap: 7, marginBottom: 18 },
    packageBenefit: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    packageBenefitBullet: {
      color: c.text,
      fontSize: 18,
      lineHeight: 23,
      fontWeight: '800',
    },
    packageBenefitText: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      lineHeight: 22,
    },
    packageAction: {
      minHeight: 49,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    packageActionText: {
      color: isDark ? '#07130B' : '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center',
    },
    packageUnavailable: {
      minHeight: 49,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: isDark ? '#767B83' : c.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    packageUnavailableText: {
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'center',
    },
    packageSelectorRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 15,
    },
    packageSelector: {
      flex: 1,
      minHeight: 62,
      paddingHorizontal: 7,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      ...tileDepth,
    },
    packageSelectorText: {
      color: c.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      textAlign: 'center',
    },
    refreshButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      ...tileDepth,
    },
    refreshText: { color: c.primaryDark, fontWeight: '700', fontSize: 12 },
    filterRow: { gap: 8, paddingBottom: 12 },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    filterChipActive: {
      borderColor: c.primaryAction,
      backgroundColor: c.primaryAction,
    },
    filterText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    filterTextActive: { color: c.onPrimaryAction },
    transaction: {
      backgroundColor: c.surface,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      ...tileDepth,
    },
    transactionIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceSecondary,
    },
    transactionCopy: { flex: 1 },
    transactionDescription: {
      color: c.text,
      fontSize: 13,
      fontWeight: '700',
    },
    transactionMeta: {
      color: c.textSecondary,
      fontSize: 11,
      marginTop: 4,
      textTransform: 'capitalize',
    },
    transactionPoints: { color: c.text, fontSize: 14, fontWeight: '800' },
    empty: {
      color: c.textSecondary,
      textAlign: 'center',
      backgroundColor: c.surface,
      padding: 22,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: c.border,
    },
    error: {
      color: c.danger,
      backgroundColor: c.danger + '18',
      borderRadius: 12,
      padding: 13,
      marginBottom: 15,
      lineHeight: 20,
    },
    center: { padding: 30, alignItems: 'center' },
    infoCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 22,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      ...tileDepth,
    },
    infoText: { flex: 1, color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  });

  const dateLabel = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const showTopUpNotice = () =>
    Alert.alert(
      'Top-up unavailable',
      'Point purchases are not enabled yet. You can spend your available points on facility access or facility packages.'
    );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenTexture color={c.primary} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>My Wallet</Text>
        <Text style={styles.subtitle}>
          Your OnePass points, passes, and recent activity.
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={c.primaryDark} />
          </View>
        ) : (
          <>
            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.balanceShell}>
              <View style={styles.balanceCard}>
                <View pointerEvents="none" style={styles.balanceGlow} />
                <View pointerEvents="none" style={styles.balanceGlowSmall} />
                <View style={styles.balanceTop}>
                  <Text style={styles.balanceLabel}>Available balance</Text>
                  <View style={styles.walletIcon}>
                    <MaterialCommunityIcons
                      name="wallet-outline"
                      size={22}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
                <Text style={styles.balanceValue}>
                  {wallet?.totalAvailablePoints.toLocaleString() ?? '--'}
                </Text>
                <Text style={styles.balanceUnit}>OnePass points</Text>
                <View style={styles.balances}>
                  <View style={styles.balanceDetail}>
                    <Text style={styles.detailLabel}>Purchased points</Text>
                    <Text style={styles.detailValue}>
                      {wallet?.purchasedPoints.toLocaleString() ?? '--'}
                    </Text>
                  </View>
                  <View style={styles.balanceDetail}>
                    <Text style={styles.detailLabel}>Bonus points</Text>
                    <Text style={styles.detailValue}>
                      {wallet?.bonusPoints.toLocaleString() ?? '--'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Quick actions</Text>
            </View>
            <View style={styles.actionGrid}>
              <Pressable
                style={styles.actionTile}
                onPress={showTopUpNotice}
                accessibilityRole="button"
              >
                <View style={styles.actionIcon}>
                  <MaterialCommunityIcons
                    name="plus-circle-outline"
                    size={21}
                    color={c.primaryDark}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Top up points</Text>
                  <Text style={styles.actionSubtitle}>Not available yet</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.actionTile}
                onPress={() => navigation.navigate('ActivePass')}
                accessibilityRole="button"
              >
                <View style={styles.actionIcon}>
                  <MaterialCommunityIcons
                    name="ticket-confirmation-outline"
                    size={21}
                    color={c.primaryDark}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Active pass</Text>
                  <Text style={styles.actionSubtitle}>View status</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.actionTile}
                onPress={() => navigation.navigate('CardDesign')}
                accessibilityRole="button"
              >
                <View style={styles.actionIcon}>
                  <MaterialCommunityIcons
                    name="card-account-details-outline"
                    size={21}
                    color={c.primaryDark}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Card Design</Text>
                  <Text style={styles.actionSubtitle}>Customize your card</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.actionTile}
                onPress={() => navigation.navigate('MonthlyHistory')}
                accessibilityRole="button"
              >
                <View style={styles.actionIcon}>
                  <MaterialCommunityIcons
                    name="chart-box-outline"
                    size={21}
                    color={c.primaryDark}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>Monthly history</Text>
                  <Text style={styles.actionSubtitle}>Access and points</Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.infoCard}>
              <MaterialCommunityIcons
                name="information-outline"
                size={21}
                color={c.primaryDark}
              />
              <Text style={styles.infoText}>
                Wallet points are used for hourly facility access. Facility
                package hours and universal pass points are tracked separately.
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Packages</Text>
            </View>
            <View style={styles.packageSelectorRow}>
              {(
                [
                  {
                    category: 'weekly',
                    label: 'Weekly',
                    icon: 'calendar-week',
                  },
                  {
                    category: 'monthly',
                    label: 'Monthly',
                    icon: 'calendar-month',
                  },
                  {
                    category: 'onepass',
                    label: 'OnePass packages',
                    icon: 'ticket-confirmation-outline',
                  },
                ] as const
              ).map(({ category, label, icon }) => {
                const selected = packageCategory === category;
                return (
                  <Pressable
                    key={category}
                    style={[
                      styles.packageSelector,
                      selected && {
                        borderColor: packageAccents[category],
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setPackageCategory(category)}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} package plans`}
                    accessibilityState={{ selected }}
                  >
                    <MaterialCommunityIcons
                      name={icon}
                      size={19}
                      color={
                        selected ? packageAccents[category] : c.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.packageSelectorText,
                        selected && {
                          color: packageAccents[category],
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {packageCategory === 'onepass' ? (
              <>
                <Text style={styles.notice}>
                  OnePass plans are shown for reference. Purchase is not
                  available yet.
                </Text>
                {passPlans.length === 0 ? (
                  <Text style={styles.empty}>
                    No OnePass packages are available right now.
                  </Text>
                ) : (
                  passPlans.map((plan) => (
                    <View
                      key={plan._id}
                      style={[
                        styles.packageOfferCard,
                        {
                          backgroundColor: packageCardColors.onepass,
                          borderColor: `${packageAccents.onepass}55`,
                        },
                      ]}
                    >
                      <View style={styles.packageBrandRow}>
                        <View
                          style={[
                            styles.packageBrandIcon,
                            {
                              backgroundColor: `${packageAccents.onepass}24`,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="infinity"
                            size={20}
                            color={packageAccents.onepass}
                          />
                        </View>
                        <Text style={styles.packageBrand}>OnePass</Text>
                        <Text
                          style={[
                            styles.packageType,
                            { color: packageAccents.onepass },
                          ]}
                        >
                          Universal pass
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.packageTitle,
                          { color: packageAccents.onepass },
                        ]}
                      >
                        {plan.name}
                      </Text>
                      <Text style={styles.packagePrice}>
                        {plan.durationDays} days
                        <Text style={styles.packagePriceUnit}>
                          {' '}
                          · OnePass access
                        </Text>
                      </Text>
                      <View style={styles.packageDivider} />
                      <View style={styles.packageBenefits}>
                        <View style={styles.packageBenefit}>
                          <Text style={styles.packageBenefitBullet}>•</Text>
                          <Text style={styles.packageBenefitText}>
                            {plan.includedPoints.toLocaleString()} included
                            points
                          </Text>
                        </View>
                        <View style={styles.packageBenefit}>
                          <Text style={styles.packageBenefitBullet}>•</Text>
                          <Text style={styles.packageBenefitText}>
                            {plan.bonusPoints.toLocaleString()} bonus points
                          </Text>
                        </View>
                      </View>
                      <View style={styles.packageUnavailable}>
                        <Text style={styles.packageUnavailableText}>
                          Purchases are not available yet
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            ) : facilityError ? (
              <Text style={styles.error}>{facilityError}</Text>
            ) : visibleFacilityPackages.length === 0 ? (
              <Text style={styles.empty}>
                No {packageCategory} facility packages are available right now.
              </Text>
            ) : (
              visibleFacilityPackages.map(
                ({
                  facility,
                  packageType,
                  pointsCost,
                  hoursIncluded,
                  durationDays,
                }) => (
                  <Pressable
                    key={`${facility._id}-${packageType}`}
                    style={[
                      styles.packageOfferCard,
                      {
                        backgroundColor: packageCardColors[packageType],
                        borderColor: `${packageAccents[packageType]}55`,
                      },
                    ]}
                    onPress={() =>
                      navigation.navigate('FacilityDetails', {
                        facilityId: facility._id,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${packageType} package at ${facility.name}`}
                  >
                    <View style={styles.packageBrandRow}>
                      <View
                        style={[
                          styles.packageBrandIcon,
                          {
                            backgroundColor: `${packageAccents[packageType]}24`,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="infinity"
                          size={20}
                          color={packageAccents[packageType]}
                        />
                      </View>
                      <Text style={styles.packageBrand}>OnePass</Text>
                      <Text
                        style={[
                          styles.packageType,
                          { color: packageAccents[packageType] },
                        ]}
                      >
                        Facility package
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.packageTitle,
                        { color: packageAccents[packageType] },
                      ]}
                    >
                      {packageType === 'weekly' ? 'Weekly' : 'Monthly'}
                    </Text>
                    <Text style={styles.packageSubtitle}>
                      {facility.name}
                    </Text>
                    <Text style={styles.packagePrice}>
                      {pointsCost.toLocaleString()} points
                      <Text style={styles.packagePriceUnit}>
                        {' '}
                        / {durationDays} days
                      </Text>
                    </Text>
                    <View style={styles.packageDivider} />
                    <View style={styles.packageBenefits}>
                      <View style={styles.packageBenefit}>
                        <Text style={styles.packageBenefitBullet}>•</Text>
                        <Text style={styles.packageBenefitText}>
                          {hoursIncluded} hours of facility access
                        </Text>
                      </View>
                      <View style={styles.packageBenefit}>
                        <Text style={styles.packageBenefitBullet}>•</Text>
                        <Text style={styles.packageBenefitText}>
                          {facility.category} · {facility.city}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.packageAction,
                        { backgroundColor: packageAccents[packageType] },
                      ]}
                    >
                      <Text style={styles.packageActionText}>
                        View facility details
                      </Text>
                    </View>
                  </Pressable>
                )
              )
            )}

            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Text style={styles.sectionTitle}>Transactions</Text>
              <Pressable
                style={styles.refreshButton}
                onPress={() => void loadWallet(true)}
                disabled={refreshing}
                accessibilityRole="button"
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={15}
                  color={c.primaryDark}
                />
                <Text style={styles.refreshText}>
                  {refreshing ? 'Loading…' : 'Refresh'}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {transactionFilters.map((filter) => {
                const active = transactionFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    style={[
                      styles.filterChip,
                      active && styles.filterChipActive,
                    ]}
                    onPress={() => setTransactionFilter(filter)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        active && styles.filterTextActive,
                      ]}
                    >
                      {filter}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {filteredTransactions.length === 0 ? (
              <Text style={styles.empty}>
                {transactions.length === 0
                  ? 'No wallet transactions yet.'
                  : `No ${transactionFilter.toLowerCase()} transactions yet.`}
              </Text>
            ) : (
              filteredTransactions.map((item) => {
                const isDebit = item.balanceAfter < item.balanceBefore;
                return (
                  <View key={item._id} style={styles.transaction}>
                    <View style={styles.transactionIcon}>
                      <MaterialCommunityIcons
                        name={
                          isDebit
                            ? 'arrow-top-right'
                            : 'arrow-bottom-left'
                        }
                        size={18}
                        color={isDebit ? c.warning : c.success}
                      />
                    </View>
                    <View style={styles.transactionCopy}>
                      <Text style={styles.transactionDescription}>
                        {item.description || item.type}
                      </Text>
                      <Text style={styles.transactionMeta}>
                        {dateLabel(item.createdAt)} · {item.status}
                      </Text>
                    </View>
                    <Text style={styles.transactionPoints}>
                      {item.balanceScope === 'facility_package'
                        ? 'Package'
                        : `${isDebit ? '−' : '+'}${item.points.toLocaleString()}`}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
