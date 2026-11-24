import React, { useCallback, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';

import ScreenTexture from '../components/ScreenTexture';
import tileDepth from '../theme/tileDepth';
import { categoryImage } from '../theme/assetImages';
import { useTheme } from '../context/ThemeContext';
import type { MainTabParamList } from '../navigation/MainTabParamList';
import type { RootStackParamList } from '../navigation/RootStackParamList';
import {
  getFacilities,
  type Facility,
} from '../services/onepass';

type ExploreNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Explore'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const categories = [
  { label: 'All', value: '', icon: 'view-grid-outline' },
  { label: 'Fitness', value: 'fitness', icon: 'dumbbell' },
  { label: 'Workspaces', value: 'workspaces', icon: 'briefcase-outline' },
  { label: 'Lifestyle', value: 'lifestyle', icon: 'spa-outline' },
  {
    label: 'Libraries',
    value: 'libraries',
    icon: 'book-open-page-variant',
  },
] as const;

const facilityIcon = (category: string): IconName => {
  const value = category.toLowerCase();
  if (value.includes('fitness') || value.includes('gym')) return 'dumbbell';
  if (value.includes('work')) return 'briefcase-outline';
  if (value.includes('library')) return 'book-open-page-variant';
  if (value.includes('wellness') || value.includes('lifestyle')) return 'spa-outline';
  if (value.includes('pool') || value.includes('swim')) return 'swim';
  return 'map-marker-outline';
};

export default function ExploreScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<ExploreNavigation>();
  const c = theme.colors;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFacilities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getFacilities({
        search: search.trim(),
        category: selectedCategory,
      });
      setFacilities(result.facilities);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load facilities.'
      );
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        void loadFacilities();
      }, 350);
      return () => clearTimeout(timer);
    }, [loadFacilities])
  );

  const openFacility = (id: string) => {
    navigation.navigate('FacilityDetails', { facilityId: id });
  };

  const openFacilityOnMap = async (
    facility: Pick<
      Facility,
      'name' | 'address' | 'city' | 'latitude' | 'longitude'
    >
  ) => {
    const address = facility.address.trim();
    const hasCoordinates =
      typeof facility.latitude === 'number' &&
      typeof facility.longitude === 'number';

    if (!hasCoordinates && !address) {
      Alert.alert(
        'Location unavailable',
        'This facility has no address or map coordinates.'
      );
      return;
    }

    const query = hasCoordinates
      ? `${facility.latitude},${facility.longitude}`
      : [facility.name.trim(), address, facility.city.trim()]
          .filter(Boolean)
          .join(', ');
    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      );
    } catch (requestError) {
      Alert.alert(
        'Unable to open Google Maps',
        requestError instanceof Error
          ? requestError.message
          : 'Please try opening the facility location again.'
      );
    }
  };

  const cityOptions = Array.from(
    new Set(facilities.map((facility) => facility.city.trim()).filter(Boolean))
  ).sort((first, second) => first.localeCompare(second));
  const visibleFacilities = selectedCity
    ? facilities.filter((facility) => facility.city.trim() === selectedCity)
    : facilities;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },
    title: { color: c.text, fontSize: 28, fontWeight: '800' },
    subtitle: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 5,
      marginBottom: 16,
    },
    searchShell: {
      minHeight: 50,
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 17,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      marginBottom: 16,
      ...tileDepth,
    },
    searchIcon: { marginRight: 9 },
    search: {
      flex: 1,
      minHeight: 48,
      color: c.text,
      paddingVertical: 8,
      fontSize: 14,
    },
    clearSearch: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categories: { gap: 8, paddingBottom: 18 },
    cityFilters: { gap: 8, paddingBottom: 18 },
    cityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    cityChipActive: {
      backgroundColor: c.primarySoft,
      borderColor: c.primaryDark,
    },
    cityChipText: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
    cityChipTextActive: { color: c.primaryDark },
    category: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      ...tileDepth,
    },
    categoryActive: {
      backgroundColor: c.primaryAction,
      borderColor: c.primaryAction,
    },
    categoryText: { color: c.textSecondary, fontWeight: '700' },
    categoryTextActive: { color: c.onPrimaryAction },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    resultTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
    count: { color: c.textSecondary, fontSize: 13 },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 21,
      padding: 13,
      marginBottom: 12,
      ...tileDepth,
    },
    facilityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      marginBottom: 10,
    },
    facilityIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: c.surfaceSecondary,
    },
    facilityPhoto: { width: '100%', height: '100%' },
    facilityHeading: { flex: 1, minWidth: 0 },
    categoryLabel: {
      color: c.primaryDark,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    facilityName: { color: c.text, fontSize: 16, fontWeight: '800' },
    accessBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 13,
      paddingHorizontal: 7,
      paddingVertical: 5,
      backgroundColor: c.successSoft,
    },
    directoryBadge: { backgroundColor: c.surfaceSecondary },
    accessBadgeText: {
      color: c.success,
      fontSize: 9,
      fontWeight: '800',
    },
    directoryBadgeText: { color: c.textSecondary },
    description: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 10,
    },
    facilityMetrics: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      borderRadius: 13,
      paddingHorizontal: 11,
      paddingVertical: 8,
      backgroundColor: c.surfaceSecondary,
    },
    metricLocation: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
    metricText: { color: c.textSecondary, fontSize: 12, flexShrink: 1 },
    points: { color: c.primaryDark, fontWeight: '800', fontSize: 12 },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 9,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 12,
      marginTop: 12,
    },
    locationText: {
      flex: 1,
      color: c.primaryDark,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    attribution: {
      color: c.textSecondary,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 12,
    },
    detailsLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    details: { color: c.primaryDark, fontWeight: '700' },
    error: {
      color: c.danger,
      backgroundColor: c.danger + '18',
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
      lineHeight: 20,
    },
    empty: {
      color: c.textSecondary,
      textAlign: 'center',
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 24,
      shadowColor: '#0F172A',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenTexture color={c.primary} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Discover Facilities</Text>
        <Text style={styles.subtitle}>
          Explore OnePass-enabled facilities and directory listings, with
          detailed information and map locations.
        </Text>

        <View style={styles.searchShell}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={c.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.search}
          placeholder="Search facilities, city, or category"
          placeholderTextColor={c.textSecondary}
          value={search}
          onChangeText={(value) => {
            setSearch(value);
            setSelectedCity('');
          }}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable
            style={styles.clearSearch}
            onPress={() => setSearch('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={c.textSecondary}
            />
          </Pressable>
        )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {categories.map((category) => {
            const active = selectedCategory === category.value;
            return (
              <Pressable
                key={category.label}
                style={[styles.category, active && styles.categoryActive]}
                onPress={() => {
                  setSelectedCategory(category.value);
                  setSelectedCity('');
                }}
              >
                <MaterialCommunityIcons
                  name={category.icon}
                  size={16}
                  color={active ? c.onPrimaryAction : c.primaryDark}
                />
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {cityOptions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityFilters}
          >
            {['', ...cityOptions].map((city) => {
              const active = selectedCity === city;
              return (
                <Pressable
                  key={city || 'all-cities'}
                  style={[
                    styles.cityChip,
                    active && styles.cityChipActive,
                  ]}
                  onPress={() => setSelectedCity(city)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <MaterialCommunityIcons
                    name={city ? 'map-marker-outline' : 'earth'}
                    size={15}
                    color={active ? c.primaryDark : c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.cityChipText,
                      active && styles.cityChipTextActive,
                    ]}
                  >
                    {city || 'All cities'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>Matching facilities</Text>
          <Text style={styles.count}>
            {visibleFacilities.length}{' '}
            {visibleFacilities.length === 1 ? 'result' : 'results'}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            style={{ marginTop: 30 }}
            color={c.primaryDark}
            size="large"
          />
        ) : visibleFacilities.length === 0 ? (
          <Text style={styles.empty}>
            No facilities match your current filters.
          </Text>
        ) : (
          visibleFacilities.map((facility) => (
            <View key={facility._id} style={styles.card}>
              <Pressable
                onPress={() => void openFacility(facility._id)}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${facility.name}`}
              >
                <View style={styles.facilityHeader}>
                  <View style={styles.facilityIcon}>
                    <Image
                      source={categoryImage(facility.category, facility.name)}
                      resizeMode="cover"
                      style={styles.facilityPhoto}
                    />
                  </View>
                  <View style={styles.facilityHeading}>
                    <Text style={styles.categoryLabel} numberOfLines={1}>
                      {facility.category}
                    </Text>
                    <Text style={styles.facilityName} numberOfLines={1}>
                      {facility.name}
                    </Text>
                  </View>
                </View>
                <Text style={styles.description}>
                  {facility.description || facility.address}
                </Text>
                <View style={styles.facilityMetrics}>
                  <View style={styles.metricLocation}>
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={16}
                      color={c.textSecondary}
                    />
                    <Text style={styles.metricText} numberOfLines={1}>
                      {facility.city}
                    </Text>
                  </View>
                  <Text style={styles.points}>
                    {facility.accessEnabled === false
                      ? ''
                      : `${(
                          facility.pointsPerHour ?? facility.pointsPerVisit
                        ).toLocaleString()} pts / hr`}
                  </Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.details}>View details & packages</Text>
                  <View style={styles.detailsLink}>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={17}
                      color={c.primaryDark}
                    />
                  </View>
                </View>
              </Pressable>
              <Pressable
                style={styles.locationButton}
                onPress={() => void openFacilityOnMap(facility)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${facility.name} location in Google Maps`}
              >
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={19}
                  color={c.primaryDark}
                />
                <Text style={styles.locationText}>
                  {facility.address}, {facility.city} · Open in Google Maps
                </Text>
              </Pressable>
            </View>
          ))
        )}
        <Text style={styles.attribution}>
          Location data © OpenStreetMap contributors
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
