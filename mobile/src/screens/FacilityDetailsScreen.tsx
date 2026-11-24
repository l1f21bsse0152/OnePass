import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import ScreenTexture from '../components/ScreenTexture';
import tileDepth from '../theme/tileDepth';
import { categoryImage } from '../theme/assetImages';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/RootStackParamList';
import {
  getFacility,
  purchaseFacilityPackage,
  type Facility,
  type FacilityPackageType,
} from '../services/onepass';

type FacilityDetailsRoute = RouteProp<RootStackParamList, 'FacilityDetails'>;
type FacilityDetailsNavigation = NativeStackNavigationProp<
  RootStackParamList,
  'FacilityDetails'
>;

const categoryIcon = (category: string) => {
  const value = category.toLowerCase();
  if (value.includes('fitness') || value.includes('gym')) return 'dumbbell';
  if (value.includes('work')) return 'briefcase-outline';
  if (value.includes('library')) return 'book-open-page-variant';
  if (value.includes('wellness') || value.includes('lifestyle')) return 'spa-outline';
  return 'map-marker-outline';
};

const categoryColor = (category: string, colors: ReturnType<typeof useTheme>['theme']['colors']) => {
  const value = category.toLowerCase();
  if (value.includes('work')) return colors.warning;
  if (value.includes('library')) return colors.secondaryDark;
  if (value.includes('wellness') || value.includes('lifestyle')) return colors.success;
  return colors.primaryDark;
};

export default function FacilityDetailsScreen() {
  const route = useRoute<FacilityDetailsRoute>();
  const navigation = useNavigation<FacilityDetailsNavigation>();
  const { theme } = useTheme();
  const c = theme.colors;
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<FacilityPackageType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const purchaseKeys = useRef<Partial<Record<FacilityPackageType, string>>>({});

  const loadFacility = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFacility(await getFacility(route.params.facilityId));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load facility details.'
      );
    } finally {
      setLoading(false);
    }
  }, [route.params.facilityId]);

  useFocusEffect(
    useCallback(() => {
      void loadFacility();
    }, [loadFacility])
  );

  const handlePurchase = async (packageType: FacilityPackageType) => {
    if (!facility || buying) return;

    const idempotencyKey =
      purchaseKeys.current[packageType] ??
      `facility-package-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
    purchaseKeys.current[packageType] = idempotencyKey;

    try {
      setBuying(packageType);
      const result = await purchaseFacilityPackage(
        facility._id,
        packageType,
        idempotencyKey
      );
      delete purchaseKeys.current[packageType];
      Alert.alert(
        'Package activated',
        `${result.subscription.hoursIncluded} hours are available for ${facility.name}.`
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to purchase this facility package.'
      );
    } finally {
      setBuying(null);
    }
  };

  const openLocation = async () => {
    if (!facility) return;
    const hasCoordinates =
      typeof facility.latitude === 'number' &&
      typeof facility.longitude === 'number';
    const query = hasCoordinates
      ? `${facility.latitude},${facility.longitude}`
      : `${facility.name}, ${facility.address}, ${facility.city}`;

    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      );
    } catch (openError) {
      Alert.alert(
        'Unable to open map',
        openError instanceof Error
          ? openError.message
          : 'Please try opening this location again.'
      );
    }
  };

  const accent = facility ? categoryColor(facility.category, c) : c.primaryDark;
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
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
    headerTitle: { color: c.text, fontSize: 20, fontWeight: '800' },
    content: { padding: 20, paddingBottom: 26, gap: 16 },
    hero: {
      minHeight: 236,
      overflow: 'hidden',
      borderRadius: 25,
      padding: 21,
      justifyContent: 'space-between',
      backgroundColor: c.primaryAction,
      borderWidth: 1,
      borderColor: c.border,
      ...tileDepth,
    },
    heroImage: { ...StyleSheet.absoluteFill, opacity: 0.72 },
    heroGlow: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      top: -116,
      right: -52,
      backgroundColor: 'rgba(255,255,255,0.13)',
    },
    heroGlowSmall: {
      position: 'absolute',
      width: 130,
      height: 130,
      borderRadius: 65,
      bottom: -82,
      right: 88,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    heroIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    accessBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    accessBadgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
    heroBottom: { marginTop: 25 },
    name: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' },
    category: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 14,
      fontWeight: '700',
      marginTop: 6,
      textTransform: 'capitalize',
    },
    card: {
      padding: 18,
      borderRadius: 21,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...tileDepth,
    },
    sectionTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 10 },
    body: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 13 },
    rowText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
    ratePanel: {
      backgroundColor: c.primarySoft,
      borderRadius: 15,
      padding: 15,
      marginTop: 12,
      borderWidth: 1,
      borderColor: `${c.primaryDark}22`,
    },
    rateLabel: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    rateValue: {
      color: c.primaryDark,
      fontSize: 24,
      fontWeight: '800',
      marginTop: 4,
    },
    packageCard: {
      marginTop: 12,
      padding: 15,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...tileDepth,
    },
    packageTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    packageType: {
      alignSelf: 'flex-start',
      color: c.primaryDark,
      backgroundColor: c.primarySoft,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      borderRadius: 12,
      paddingHorizontal: 9,
      paddingVertical: 5,
      marginBottom: 8,
    },
    packageTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
    packagePrice: {
      color: c.primaryDark,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'right',
    },
    packagePriceLabel: {
      color: c.textSecondary,
      fontSize: 10,
      textAlign: 'right',
      marginTop: 2,
    },
    packageStats: {
      flexDirection: 'row',
      gap: 9,
      padding: 10,
      backgroundColor: c.surfaceSecondary,
      borderRadius: 13,
      marginTop: 12,
    },
    packageStat: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    packageStatLabel: {
      color: c.textSecondary,
      fontSize: 9,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    packageStatValue: {
      color: c.text,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 2,
    },
    button: {
      minHeight: 46,
      marginTop: 12,
      borderRadius: 23,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
    },
    buttonText: { color: c.onPrimaryAction, fontWeight: '800' },
    outlineButton: {
      minHeight: 44,
      marginTop: 13,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    outlineButtonText: { color: c.primaryDark, fontWeight: '800' },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    footerButton: {
      minHeight: 52,
      borderRadius: 15,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 9,
      ...tileDepth,
    },
    footerButtonText: {
      color: c.onPrimaryAction,
      fontSize: 15,
      fontWeight: '800',
    },
    error: {
      color: c.danger,
      backgroundColor: c.danger + '18',
      padding: 13,
      borderRadius: 12,
      lineHeight: 20,
    },
    center: { padding: 36, alignItems: 'center' },
    note: {
      color: c.textSecondary,
      backgroundColor: c.surfaceSecondary,
      padding: 14,
      borderRadius: 12,
      lineHeight: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenTexture color={c.primary} />
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={c.primaryDark} />
        </Pressable>
        <Text style={styles.headerTitle}>Facility details</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primaryDark} />
        </View>
      ) : facility ? (
        <ScrollView contentContainerStyle={styles.content}>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.hero}>
            <Image
              source={categoryImage(facility.category, facility.name)}
              resizeMode="cover"
              style={styles.heroImage}
            />
            <View pointerEvents="none" style={styles.heroGlow} />
            <View pointerEvents="none" style={styles.heroGlowSmall} />
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons
                  name={categoryIcon(facility.category)}
                  size={30}
                  color="#FFFFFF"
                />
              </View>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.name}>{facility.name}</Text>
              <Text style={styles.category}>
                {facility.category} · {facility.city}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>About this place</Text>
            <Text style={styles.body}>
              {facility.description || 'No description is available yet.'}
            </Text>
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={19}
                color={accent}
              />
              <Text style={styles.rowText}>
                {facility.address}, {facility.city}
              </Text>
            </View>
            <Pressable
              style={styles.outlineButton}
              onPress={() => void openLocation()}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="map-outline"
                size={18}
                color={c.primaryDark}
              />
              <Text style={styles.outlineButtonText}>Open in maps</Text>
            </Pressable>
          </View>

          {facility.accessEnabled === false ? (
            null
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Access cost</Text>
                <Text style={styles.body}>
                  Pay only for the time you select when confirming access.
                </Text>
                <View style={styles.ratePanel}>
                  <Text style={styles.rateLabel}>FACILITY RATE</Text>
                  <Text style={styles.rateValue}>
                    {(facility.pointsPerHour ?? facility.pointsPerVisit).toLocaleString()}
                    {' '}points
                  </Text>
                  <Text style={styles.rateLabel}>per hour</Text>
                </View>
                <View style={styles.row}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={19}
                    color={accent}
                  />
                  <Text style={styles.rowText}>
                    The exact points total is shown before you confirm your visit.
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Choose a package</Text>
                <Text style={styles.body}>
                  Packages include a set number of facility hours. They are
                  separate from universal OnePass Pass plans.
                </Text>
                {(['weekly', 'monthly'] as const).map((packageType) => {
                  const plan = facility.packages?.[packageType];
                  if (!plan) return null;
                  return (
                    <View key={packageType} style={styles.packageCard}>
                      <View style={styles.packageTopRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.packageType}>
                            {packageType} pass
                          </Text>
                          <Text style={styles.packageTitle}>
                            {packageType === 'weekly'
                              ? 'Weekly package'
                              : 'Monthly package'}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.packagePrice}>
                            {plan.pointsCost.toLocaleString()}
                          </Text>
                          <Text style={styles.packagePriceLabel}>points</Text>
                        </View>
                      </View>
                      <View style={styles.packageStats}>
                        <View style={styles.packageStat}>
                          <MaterialCommunityIcons
                            name="timer-outline"
                            size={17}
                            color={c.primaryDark}
                          />
                          <View>
                            <Text style={styles.packageStatLabel}>
                              Included time
                            </Text>
                            <Text style={styles.packageStatValue}>
                              {plan.hoursIncluded} hours
                            </Text>
                          </View>
                        </View>
                        <View style={styles.packageStat}>
                          <MaterialCommunityIcons
                            name="calendar-month-outline"
                            size={17}
                            color={c.success}
                          />
                          <View>
                            <Text style={styles.packageStatLabel}>Validity</Text>
                            <Text style={styles.packageStatValue}>
                              {plan.durationDays} days
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Pressable
                        style={styles.button}
                        onPress={() => void handlePurchase(packageType)}
                        disabled={buying !== null}
                        accessibilityRole="button"
                      >
                        {buying === packageType ? (
                          <ActivityIndicator color={c.onPrimaryAction} />
                        ) : (
                          <>
                            <MaterialCommunityIcons
                              name="package-variant-closed"
                              size={18}
                              color={c.onPrimaryAction}
                            />
                            <Text style={styles.buttonText}>Buy with points</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.content}>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
      {!loading && facility?.accessEnabled !== false && facility && (
        <View style={styles.footer}>
          <Pressable
            style={styles.footerButton}
            onPress={() =>
              navigation.navigate('MainTabs', { screen: 'Scan' })
            }
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={20}
              color={c.onPrimaryAction}
            />
            <Text style={styles.footerButtonText}>Scan QR to get access</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
