import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';

import ScreenTexture from '../components/ScreenTexture';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { MainTabParamList } from '../navigation/MainTabParamList';
import type { RootStackParamList } from '../navigation/RootStackParamList';
import tileDepth from '../theme/tileDepth';
import { categoryImage } from '../theme/assetImages';
import {
  CARD_DESIGN_STORAGE_KEY,
  DEFAULT_CARD_DESIGN,
  getCardAccent,
  getCardSkin,
  parseCardDesign,
  type CardDesignSelection,
} from '../theme/cardDesign';
import {
  getAccessHistory,
  getAllFacilities,
  getMyPassStatus,
  getTransactions,
  getWallet,
  type AccessVisit,
  type Facility,
  type WalletBalance,
  type WalletTransaction,
} from '../services/onepass';

type HomeNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  amountLabel: string;
  isCredit: boolean;
  createdAt: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<HomeNavigation>();
  const c = theme.colors;

  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [visits, setVisits] = useState<AccessVisit[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [hasActivePass, setHasActivePass] = useState(false);
  const [homeCardDesign, setHomeCardDesign] =
    useState<CardDesignSelection>(DEFAULT_CARD_DESIGN);
  const [cardDesignError, setCardDesignError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const loadHome = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrors([]);

    const results = await Promise.allSettled([
      getWallet(),
      getAllFacilities(),
      getTransactions(),
      getAccessHistory(),
      getMyPassStatus(),
    ]);

    const nextErrors: string[] = [];

    if (results[0].status === 'fulfilled') {
      setWallet(results[0].value);
    } else {
      nextErrors.push(
        results[0].reason instanceof Error
          ? results[0].reason.message
          : 'Unable to load your wallet.'
      );
    }

    if (results[1].status === 'fulfilled') {
      setFacilities(
        results[1].value
          .filter((facility) => facility.accessEnabled !== false)
      );
    } else {
      nextErrors.push(
        results[1].reason instanceof Error
          ? results[1].reason.message
          : 'Unable to load facilities.'
      );
    }

    if (results[2].status === 'fulfilled') {
      setTransactions(results[2].value.transactions);
    } else {
      nextErrors.push(
        results[2].reason instanceof Error
          ? results[2].reason.message
          : 'Unable to load wallet activity.'
      );
    }

    if (results[3].status === 'fulfilled') {
      setVisits(results[3].value.visits);
    } else {
      nextErrors.push(
        results[3].reason instanceof Error
          ? results[3].reason.message
          : 'Unable to load recent facility visits.'
      );
    }

    if (results[4].status === 'fulfilled') {
      setHasActivePass(results[4].value.hasActivePass);
    } else {
      nextErrors.push(
        results[4].reason instanceof Error
          ? results[4].reason.message
          : 'Unable to load your OnePass pass status.'
      );
    }

    setErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      SecureStore.getItemAsync(CARD_DESIGN_STORAGE_KEY)
        .then((savedDesign) => {
          if (!active) return;
          setHomeCardDesign(parseCardDesign(savedDesign));
          setCardDesignError(null);
        })
        .catch((storageError: unknown) => {
          if (!active) return;
          setCardDesignError(
            storageError instanceof Error
              ? storageError.message
              : 'Unable to load your saved card design.'
          );
        });
      void loadHome();
      return () => {
        active = false;
      };
    }, [loadHome])
  );

  const activity = useMemo(() => {
    const checkIns: ActivityItem[] = visits.map((visit) => ({
      id: `access-${visit._id}`,
      title: visit.facility.name,
      subtitle: `${visit.hoursUsed} hour(s) · ${visit.accessMethod.replace(/_/g, ' ')}`,
      amountLabel:
        visit.accessMethod === 'facility_package'
          ? `${visit.hoursUsed} h`
          : `−${visit.pointsCharged.toLocaleString()} pts`,
      isCredit: false,
      createdAt: visit.accessedAt,
    }));

    const otherTransactions: ActivityItem[] = transactions
      .filter((transaction) => transaction.source !== 'facility_access')
      .map((transaction) => ({
        id: `transaction-${transaction._id}`,
        title: transaction.description || transaction.type,
        subtitle: transaction.type,
        amountLabel:
          transaction.balanceScope === 'facility_package'
            ? 'Package use'
            : `${transaction.type === 'debit' ||
                transaction.type === 'pass_debit'
                ? '−'
                : '+'}${transaction.points.toLocaleString()} pts`,
        isCredit:
          transaction.balanceScope !== 'facility_package' &&
          transaction.balanceAfter >= transaction.balanceBefore,
        createdAt: transaction.createdAt,
      }));

    return [...checkIns, ...otherTransactions]
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime()
      )
      .slice(0, 3);
  }, [transactions, visits]);

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

  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'there';
  const homeCardSkin = getCardSkin(homeCardDesign.skinId);
  const homeCardAccent = getCardAccent(homeCardDesign.accentId);
  const initials = user?.fullName
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'OP';
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning,' : hour < 18 ? 'Good Afternoon,' : 'Good Evening,';

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingBottom: 36 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginBottom: 8,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    brandMark: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
      ...tileDepth,
    },
    brandName: { color: c.text, fontSize: 15, fontWeight: '800' },
    brandSubtitle: {
      color: c.textSecondary,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 1,
    },
    profileButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: c.primaryDark, fontSize: 13, fontWeight: '800' },
    greeting: { color: c.textSecondary, fontSize: 12, lineHeight: 16 },
    userName: {
      color: c.text,
      fontSize: 23,
      lineHeight: 29,
      fontWeight: '800',
    },
    greetingRow: {
      paddingHorizontal: 18,
      paddingTop: 2,
      paddingBottom: 8,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceSecondary,
    },
    main: {
      paddingHorizontal: 16,
      paddingTop: 8,
      gap: 20,
    },
    walletCardShell: {
      borderRadius: 20,
      ...tileDepth,
    },
    walletCard: {
      overflow: 'hidden',
      borderRadius: 20,
      backgroundColor: c.primaryAction,
      borderWidth: 1,
      borderColor: c.primaryDark,
      padding: 18,
    },
    walletAccent: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      top: -105,
      right: -80,
      backgroundColor: 'rgba(57,184,253,0.42)',
    },
    walletAccentSecondary: {
      position: 'absolute',
      width: 125,
      height: 125,
      borderRadius: 64,
      bottom: -82,
      left: 92,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    walletTexture: {
      ...StyleSheet.absoluteFill,
      overflow: 'hidden',
    },
    walletTextureLine: {
      position: 'absolute',
      left: -40,
      width: '130%',
      height: 1,
      transform: [{ rotate: '-27deg' }],
      opacity: 0.42,
    },
    walletTextureRing: {
      position: 'absolute',
      width: 140,
      height: 140,
      right: -40,
      top: -25,
      borderRadius: 70,
      borderWidth: 1,
      opacity: 0.5,
    },
    walletDesignError: {
      color: c.danger,
      fontSize: 11,
      lineHeight: 16,
    },
    walletTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    walletLabel: {
      color: '#FFFFFF',
      opacity: 0.9,
      fontSize: 14,
      lineHeight: 20,
    },
    walletBalance: {
      color: '#FFFFFF',
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '800',
      marginTop: 4,
    },
    walletPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.successAction,
      borderWidth: 1,
      borderColor: c.success,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginTop: 14,
    },
    walletPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    walletCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.2)',
    },
    walletCardFooterText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      opacity: 0.9,
    },
    section: { gap: 10 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: { color: c.text, fontSize: 20, fontWeight: '700' },
    sectionLink: { color: c.primaryDark, fontSize: 14, fontWeight: '600' },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    actionCard: {
      width: '31%',
      minHeight: 98,
      flexGrow: 1,
      flexBasis: '31%',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      padding: 12,
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...tileDepth,
    },
    actionIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 13,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionBadge: {
      color: c.warning,
      backgroundColor: c.warning + '18',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 9,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    actionTitle: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
    },
    actionStatus: {
      color: c.textSecondary,
      fontSize: 10,
      marginTop: 3,
    },
    passCard: {
      backgroundColor: c.successSoft,
      borderColor: c.success + '55',
      borderWidth: 1,
      borderRadius: 20,
      padding: 14,
      gap: 12,
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...tileDepth,
    },
    passHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    passStatusWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    passLabel: {
      color: c.success,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.7,
    },
    passTag: {
      color: c.success,
      backgroundColor: c.successSoft,
      borderRadius: 16,
      paddingHorizontal: 9,
      paddingVertical: 5,
      fontSize: 11,
      fontWeight: '600',
    },
    passTitle: { color: c.success, fontSize: 18, fontWeight: '700' },
    passDescription: {
      color: c.success,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 4,
    },
    passButton: {
      minHeight: 44,
      backgroundColor: c.successAction,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      shadowColor: c.successAction,
      shadowOpacity: 0.18,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    passButtonText: { color: c.onSuccessAction, fontSize: 14, fontWeight: '700' },
    recommendation: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderLeftWidth: 4,
      borderLeftColor: c.success,
      borderRadius: 18,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#0F172A',
      shadowOpacity: 0.04,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...tileDepth,
    },
    recommendationIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.successSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recommendationBody: { flex: 1 },
    recommendationTitle: {
      color: c.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 4,
    },
    recommendationText: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    recommendationButton: {
      alignSelf: 'flex-start',
      backgroundColor: c.successSoft,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 8,
    },
    recommendationButtonText: {
      color: c.success,
      fontSize: 12,
      fontWeight: '700',
    },
    facilityScroller: { gap: 12, paddingBottom: 4 },
    facilityCard: {
      width: 230,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...tileDepth,
    },
    facilityImage: {
      height: 94,
      backgroundColor: c.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    facilityPhoto: {
      width: '100%',
      height: '100%',
    },
    facilityBody: { padding: 12 },
    facilityName: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 6,
    },
    facilityMeta: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
    facilityCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    facilityPoints: { color: c.primaryDark, fontSize: 13, fontWeight: '700' },
    facilityArrow: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    packageScroller: { gap: 12, paddingBottom: 4 },
    packageCard: {
      width: 258,
      padding: 14,
      borderRadius: 19,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...tileDepth,
    },
    packageCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    packageIcon: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    packageTag: {
      color: c.primaryDark,
      backgroundColor: c.primarySoft,
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 5,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    packageFacilityName: {
      color: c.text,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 13,
    },
    packageFacilityMeta: {
      color: c.textSecondary,
      fontSize: 12,
      marginTop: 4,
      textTransform: 'capitalize',
    },
    packageTerms: {
      color: c.textSecondary,
      fontSize: 12,
      marginTop: 12,
    },
    packagePriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 13,
      paddingTop: 11,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    packagePrice: { color: c.primaryDark, fontSize: 15, fontWeight: '800' },
    activityCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 20,
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...tileDepth,
    },
    activityRow: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    activityInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    activityIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    activitySubtitle: { color: c.textSecondary, fontSize: 12, marginTop: 3 },
    activityPoints: { fontSize: 12, fontWeight: '700', textAlign: 'right' },
    positive: { color: c.success },
    negative: { color: c.danger },
    loading: { padding: 20, alignItems: 'center' },
    empty: {
      color: c.textSecondary,
      textAlign: 'center',
      backgroundColor: c.surface,
      padding: 20,
      borderRadius: 16,
    },
    errorBox: {
      backgroundColor: c.danger + '18',
      borderRadius: 12,
      padding: 12,
      gap: 5,
    },
    errorText: { color: c.danger, fontSize: 13, lineHeight: 18 },
  });

  const showTopUpNotice = () =>
    Alert.alert(
      'Top-up unavailable',
      'Point purchases are not enabled yet. You can spend your available points on facility access or facility packages.'
    );

  const shortcuts: {
    label: string;
    icon: IconName;
    action: () => void;
    accent: string;
  }[] = [
    {
      label: 'Discover Facilities',
      icon: 'map-search-outline',
      action: () => navigation.navigate('Explore'),
      accent: c.secondaryDark,
    },
    {
      label: 'Monthly History',
      icon: 'calendar-month-outline',
      action: () => navigation.navigate('MonthlyHistory'),
      accent: c.primaryDark,
    },
    {
      label: 'AI Assistant',
      icon: 'robot-outline',
      action: () => navigation.navigate('Assistant'),
      accent: c.primaryDark,
    },
  ];

  const categoryIcon = (category: string): IconName => {
    const normalized = category.toLowerCase();
    if (normalized.includes('fitness') || normalized.includes('gym')) return 'dumbbell';
    if (normalized.includes('pool') || normalized.includes('swim')) return 'swim';
    if (normalized.includes('work')) return 'briefcase-outline';
    return 'star-outline';
  };

  const formatActivityTime = (date: string) =>
    new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenTexture color={c.primary} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadHome(true)}
            tintColor={c.primaryDark}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons
                name="key-variant"
                size={21}
                color={c.onPrimaryAction}
              />
            </View>
            <View>
              <Text style={styles.brandName}>OnePass</Text>
              <Text style={styles.brandSubtitle}>Home</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerButton}
              onPress={toggleTheme}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            >
              <MaterialCommunityIcons
                name={isDark ? 'weather-sunny' : 'moon-waning-crescent'}
                size={20}
                color={c.primaryDark}
              />
            </Pressable>
            <Pressable
              style={styles.headerButton}
              onPress={() =>
                Alert.alert(
                  'Notifications',
                  'You are all caught up. OnePass notifications are not configured yet.'
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <MaterialCommunityIcons
                name="bell-outline"
                size={20}
                color={c.primaryDark}
              />
            </Pressable>
          <Pressable
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </Pressable>
          </View>
        </View>

        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.userName}>{firstName} 👋</Text>
        </View>

        <View style={styles.main}>
          {errors.length > 0 && (
            <View style={styles.errorBox}>
              {errors.map((message, index) => (
                <Text key={`${index}-${message}`} style={styles.errorText}>
                  {message}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.walletCardShell}>
            <Pressable
              style={[
                styles.walletCard,
                {
                  backgroundColor: homeCardSkin.color,
                  borderColor: homeCardAccent.color,
                },
              ]}
              onPress={() => navigation.navigate('Wallet')}
              accessibilityRole="button"
              accessibilityLabel="Open wallet and points balance"
            >
              <View pointerEvents="none" style={styles.walletAccent} />
              <View pointerEvents="none" style={styles.walletAccentSecondary} />
              <View pointerEvents="none" style={styles.walletTexture}>
                <View
                  style={[
                    styles.walletTextureLine,
                    { top: '24%', backgroundColor: homeCardAccent.color },
                  ]}
                />
                <View
                  style={[
                    styles.walletTextureLine,
                    { top: '51%', backgroundColor: homeCardAccent.color },
                  ]}
                />
                <View
                  style={[
                    styles.walletTextureLine,
                    { top: '78%', backgroundColor: homeCardAccent.color },
                  ]}
                />
                <View
                  style={[
                    styles.walletTextureRing,
                    { borderColor: homeCardAccent.color },
                  ]}
                />
              </View>
              <View style={styles.walletTop}>
                <View>
                  <Text
                    style={[
                      styles.walletLabel,
                      { color: homeCardSkin.textColor },
                    ]}
                  >
                    Available Balance
                  </Text>
                  {loading && !wallet ? (
                    <ActivityIndicator
                      style={{ alignSelf: 'flex-start', marginTop: 12 }}
                      color={homeCardSkin.textColor}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.walletBalance,
                        { color: homeCardSkin.textColor },
                      ]}
                    >
                      {wallet?.totalAvailablePoints.toLocaleString() ?? '—'} Points
                    </Text>
                  )}
                </View>
                <MaterialCommunityIcons
                  name="wallet-outline"
                  size={40}
                  color={homeCardSkin.textColor}
                />
              </View>
              <View
                style={[
                  styles.walletPill,
                  { backgroundColor: homeCardAccent.color, borderColor: homeCardAccent.color },
                ]}
              >
                <Text style={[styles.walletPillText, { color: '#FFFFFF' }]}>
                  {wallet
                    ? `${wallet.bonusPoints.toLocaleString()} bonus · ${wallet.purchasedPoints.toLocaleString()} purchased`
                    : 'OnePass wallet balance'}
                </Text>
              </View>
              <View
                pointerEvents="none"
                style={[
                  styles.walletCardFooter,
                  {
                    borderTopColor: `${homeCardSkin.textColor}55`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.walletCardFooterText,
                    { color: homeCardSkin.textColor },
                  ]}
                >
                  Tap to open your wallet
                </Text>
                <MaterialCommunityIcons
                  name="arrow-top-right"
                  size={17}
                  color={homeCardSkin.textColor}
                />
              </View>
            </Pressable>
          </View>
          {cardDesignError && (
            <Text style={styles.walletDesignError}>
              Card design error: {cardDesignError}
            </Text>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionGrid}>
              {shortcuts.map((shortcut) => (
                <Pressable
                  key={shortcut.label}
                  style={styles.actionCard}
                  onPress={shortcut.action}
                  accessibilityRole="button"
                >
                  <View style={styles.actionCardHeader}>
                    <View
                      style={[
                        styles.actionIconCircle,
                        { backgroundColor: `${shortcut.accent}18` },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={shortcut.icon}
                        size={21}
                        color={shortcut.accent}
                      />
                    </View>
                    <MaterialCommunityIcons
                      name="arrow-top-right"
                      size={16}
                      color={c.textSecondary}
                    />
                  </View>
                  <View>
                    <Text style={styles.actionTitle}>{shortcut.label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {hasActivePass && <View style={styles.passCard}>
            <View style={styles.passHeader}>
              <View style={styles.passStatusWrap}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={c.success}
                />
                <Text style={styles.passLabel}>PASS ACCESS</Text>
              </View>
              <Text style={styles.passTag}>Ready to use</Text>
            </View>
            <View>
              <Text style={styles.passTitle}>OnePass facility access</Text>
              <Text style={styles.passDescription}>
                Scan a facility QR token to check the visit cost and confirm
                access.
              </Text>
            </View>
            <Pressable
              style={styles.passButton}
              onPress={() => navigation.navigate('Scan')}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={18}
                color={c.onSuccessAction}
              />
              <Text style={styles.passButtonText}>Open Pass</Text>
            </Pressable>
          </View>}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Facilities</Text>
              <Pressable onPress={() => navigation.navigate('Explore')}>
                <Text style={styles.sectionLink}>View All</Text>
              </Pressable>
            </View>
            {loading && facilities.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color={c.primaryDark} />
              </View>
            ) : facilities.length === 0 ? (
              <Text style={styles.empty}>
                No active facilities are available right now.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.facilityScroller}
              >
                {facilities.slice(0, 6).map((facility) => (
                  <Pressable
                    key={facility._id}
                    style={styles.facilityCard}
                    onPress={() =>
                      navigation.navigate('FacilityDetails', {
                        facilityId: facility._id,
                      })
                    }
                    accessibilityRole="button"
                  >
                    <View style={styles.facilityImage}>
                      <Image
                        source={categoryImage(facility.category, facility.name)}
                        resizeMode="cover"
                        style={styles.facilityPhoto}
                      />
                    </View>
                    <View style={styles.facilityBody}>
                      <Text style={styles.facilityName} numberOfLines={1}>
                        {facility.name}
                      </Text>
                      <Text style={styles.facilityMeta} numberOfLines={1}>
                        {facility.category} · {facility.city}
                      </Text>
                      <View style={styles.facilityCardFooter}>
                        <Text style={styles.facilityPoints}>
                          {(facility.pointsPerHour ?? facility.pointsPerVisit)
                            .toLocaleString()} points/hour
                        </Text>
                        <View style={styles.facilityArrow}>
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color={c.primaryDark}
                          />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Facility Packages</Text>
              <Pressable onPress={() => navigation.navigate('Explore')}>
                <Text style={styles.sectionLink}>Browse facilities</Text>
              </Pressable>
            </View>
            {loading && facilities.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color={c.primaryDark} />
              </View>
            ) : facilityPackages.length === 0 ? (
              <Text style={styles.empty}>
                No facility packages are available right now.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.packageScroller}
              >
                {facilityPackages.map(
                  ({
                    facility,
                    packageType,
                    pointsCost,
                    hoursIncluded,
                    durationDays,
                  }) => (
                    <Pressable
                      key={`${facility._id}-${packageType}`}
                      style={styles.packageCard}
                      onPress={() =>
                        navigation.navigate('FacilityDetails', {
                          facilityId: facility._id,
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${packageType} package at ${facility.name}`}
                    >
                      <View style={styles.packageCardHeader}>
                        <View style={styles.packageIcon}>
                          <MaterialCommunityIcons
                            name="package-variant-closed"
                            size={20}
                            color={c.primaryDark}
                          />
                        </View>
                        <Text style={styles.packageTag}>{packageType}</Text>
                      </View>
                      <Text style={styles.packageFacilityName} numberOfLines={1}>
                        {facility.name}
                      </Text>
                      <Text style={styles.packageFacilityMeta} numberOfLines={1}>
                        {facility.category} · {facility.city}
                      </Text>
                      <Text style={styles.packageTerms}>
                        {hoursIncluded} hours · {durationDays} days
                      </Text>
                      <View style={styles.packagePriceRow}>
                        <Text style={styles.packagePrice}>
                          {pointsCost.toLocaleString()} points
                        </Text>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={20}
                          color={c.primaryDark}
                        />
                      </View>
                    </Pressable>
                  )
                )}
              </ScrollView>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <Pressable
                onPress={() => navigation.navigate('MonthlyHistory')}
              >
                <Text style={styles.sectionLink}>See All</Text>
              </Pressable>
            </View>
            {loading && activity.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color={c.primaryDark} />
              </View>
            ) : activity.length === 0 ? (
              <Text style={styles.empty}>No recent activity yet.</Text>
            ) : (
              <View style={styles.activityCard}>
                {activity.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.activityRow,
                      index === activity.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <View style={styles.activityInfo}>
                      <View style={styles.activityIcon}>
                        <MaterialCommunityIcons
                          name={
                            item.isCredit
                              ? 'wallet-plus-outline'
                              : 'map-marker-outline'
                          }
                          size={18}
                          color={c.textSecondary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.activitySubtitle}>
                          {item.subtitle} · {formatActivityTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.activityPoints,
                        item.isCredit ? styles.positive : styles.negative,
                      ]}
                    >
                      {item.amountLabel}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
