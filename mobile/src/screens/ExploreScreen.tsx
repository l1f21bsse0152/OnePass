
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../theme';

const categories = [
  'All',
  'Fitness',
  'Workspaces',
  'Lifestyle',
];

const facilities = [
  {
    id: '1',
    name: 'Premium Fitness Club',
    category: 'Fitness',
    location: 'Gulberg, Lahore',
    description: 'Modern gym facilities and fitness equipment.',
    icon: '🏋️',
    points: '150 PTS',
  },
  {
    id: '2',
    name: 'The WorkHub',
    category: 'Workspaces',
    location: 'DHA, Lahore',
    description: 'Flexible co-working and productivity spaces.',
    icon: '💻',
    points: '100 PTS',
  },
  {
    id: '3',
    name: 'Lifestyle Lounge',
    category: 'Lifestyle',
    location: 'Johar Town, Lahore',
    description: 'Relax, unwind and enjoy lifestyle experiences.',
    icon: '☕',
    points: '120 PTS',
  },
  {
    id: '4',
    name: 'Active Zone',
    category: 'Fitness',
    location: 'Model Town, Lahore',
    description: 'Training, strength and cardio facilities.',
    icon: '💪',
    points: '180 PTS',
  },
];

export default function ExploreScreen() {
  const { theme } = useTheme();
  const c = theme.colors;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredFacilities = useMemo(() => {
    return facilities.filter((facility) => {
      const matchesCategory =
        selectedCategory === 'All' ||
        facility.category === selectedCategory;

      const searchText = search.trim().toLowerCase();

      const matchesSearch =
        facility.name.toLowerCase().includes(searchText) ||
        facility.location.toLowerCase().includes(searchText) ||
        facility.category.toLowerCase().includes(searchText);

      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory]);

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
    heading: {
      color: c.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: typography.body,
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
    },
    searchIcon: {
      fontSize: 18,
      marginRight: spacing.md,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      fontSize: typography.body,
      paddingVertical: spacing.lg,
    },
    sectionTitle: {
      color: c.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
      marginBottom: spacing.md,
    },
    categoryList: {
      gap: spacing.sm,
      paddingBottom: spacing.xl,
    },
    categoryButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    categoryActive: {
      backgroundColor: c.primaryDark,
      borderColor: c.primaryDark,
    },
    categoryText: {
      color: c.textSecondary,
      fontSize: typography.small,
      fontWeight: '700',
    },
    categoryTextActive: {
      color: '#FFFFFF',
    },
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    resultsCount: {
      color: c.textSecondary,
      fontSize: typography.small,
    },
    facilityCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    facilityIcon: {
      width: 54,
      height: 54,
      borderRadius: radius.md,
      backgroundColor: c.secondarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    facilityEmoji: {
      fontSize: 26,
    },
    facilityInfo: {
      flex: 1,
    },
    facilityName: {
      color: c.text,
      fontSize: typography.regular,
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    facilityCategory: {
      color: c.secondaryDark,
      fontSize: typography.small,
      fontWeight: '700',
    },
    location: {
      color: c.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.md,
    },
    description: {
      color: c.textSecondary,
      fontSize: typography.body,
      lineHeight: 21,
      marginBottom: spacing.lg,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: spacing.md,
    },
    points: {
      color: c.primaryDark,
      fontSize: typography.small,
      fontWeight: '800',
    },
    details: {
      color: c.secondaryDark,
      fontSize: typography.small,
      fontWeight: '800',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
    },
    emptyIcon: {
      fontSize: 38,
      marginBottom: spacing.md,
    },
    emptyTitle: {
      color: c.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    emptyText: {
      color: c.textSecondary,
      fontSize: typography.body,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Text style={styles.heading}>Explore</Text>

        <Text style={styles.subtitle}>
          Discover facilities and experiences available through OnePass.
        </Text>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search facilities or locations"
            placeholderTextColor={c.textSecondary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.sectionTitle}>Categories</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((category) => {
            const active = selectedCategory === category;

            return (
              <Pressable
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[
                  styles.categoryButton,
                  active && styles.categoryActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    active && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>
            Available facilities
          </Text>
          <Text style={styles.resultsCount}>
            {filteredFacilities.length} results
          </Text>
        </View>

        {filteredFacilities.length > 0 ? (
          filteredFacilities.map((facility) => (
            <Pressable
              key={facility.id}
              style={styles.facilityCard}
            >
              <View style={styles.cardTop}>
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
              </View>

              <Text style={styles.location}>
                📍 {facility.location}
              </Text>

              <Text style={styles.description}>
                {facility.description}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={styles.points}>
                  {facility.points} / visit
                </Text>
                <Text style={styles.details}>
                  VIEW DETAILS →
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyTitle}>
              No facilities found
            </Text>
            <Text style={styles.emptyText}>
              Try another search or choose a different category.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
