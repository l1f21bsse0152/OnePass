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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import ScreenTexture from '../components/ScreenTexture';
import tileDepth from '../theme/tileDepth';
import { useTheme } from '../context/ThemeContext';
import type { MainTabParamList } from '../navigation/MainTabParamList';
import {
  getMonthlyHistory,
  type AccessVisit,
  type MonthlyHistory,
  type WalletTransaction,
} from '../services/onepass';

type MonthlyHistoryNavigation = BottomTabNavigationProp<
  MainTabParamList,
  'MonthlyHistory'
>;

export default function MonthlyHistoryScreen() {
  const navigation = useNavigation<MonthlyHistoryNavigation>();
  const { theme } = useTheme();
  const c = theme.colors;
  const [history, setHistory] = useState<MonthlyHistory | null>(null);
  const [visits, setVisits] = useState<AccessVisit[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (nextPage = 1) => {
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const result = await getMonthlyHistory(undefined, nextPage);
      setHistory(result);
      setVisits((current) =>
        nextPage === 1
          ? result.visits.items
          : [...current, ...result.visits.items]
      );
      setTransactions((current) =>
        nextPage === 1
          ? result.transactions.items
          : [...current, ...result.transactions.items]
      );
      setPage(nextPage);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load monthly history.'
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

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
    title: { color: c.text, fontSize: 21, fontWeight: '800' },
    content: { padding: 22, paddingBottom: 40, gap: 12 },
    month: { color: c.textSecondary, fontSize: 14, marginBottom: 6 },
    sectionTitle: { color: c.text, fontSize: 19, fontWeight: '800', marginTop: 8 },
    card: {
      padding: 15,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      ...tileDepth,
    },
    details: { flex: 1 },
    itemTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    meta: { color: c.textSecondary, fontSize: 12, marginTop: 5 },
    points: { color: c.text, fontSize: 14, fontWeight: '800' },
    empty: {
      color: c.textSecondary,
      textAlign: 'center',
      padding: 20,
      borderRadius: 14,
      backgroundColor: c.surface,
      ...tileDepth,
    },
    error: { color: c.danger, padding: 12, lineHeight: 20 },
    center: { padding: 30, alignItems: 'center' },
    more: {
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      ...tileDepth,
    },
    moreText: { color: c.primaryDark, fontWeight: '800' },
  });

  const dateLabel = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const transactionLabel = (item: WalletTransaction) => {
    if (item.balanceScope === 'facility_package') return 'Facility package hours used';
    if (item.balanceScope === 'onepass_pass') return 'OnePass Pass points used';
    return item.type === 'debit' ? 'Points used' : 'Points added';
  };

  const hasMore =
    Boolean(history) &&
    (page < history!.visits.pagination.pages ||
      page < history!.transactions.pagination.pages);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        <Text style={styles.title}>Monthly history</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primaryDark} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error && <Text style={styles.error}>{error}</Text>}
          {history && (
            <Text style={styles.month}>
              {history.month} · {history.timezone}
            </Text>
          )}

          <Text style={styles.sectionTitle}>Facility visits</Text>
          {visits.length === 0 ? (
            <Text style={styles.empty}>No facility visits this month.</Text>
          ) : (
            visits.map((visit) => (
              <View key={visit._id} style={styles.card}>
                <View style={styles.details}>
                  <Text style={styles.itemTitle}>
                    {visit.facility?.name ?? 'Facility visit'}
                  </Text>
                  <Text style={styles.meta}>
                    {visit.hoursUsed} hour{visit.hoursUsed === 1 ? '' : 's'} ·{' '}
                    {visit.accessMethod.replace(/_/g, ' ')} ·{' '}
                    {dateLabel(visit.accessedAt)}
                  </Text>
                </View>
                <Text style={styles.points}>
                  {visit.accessMethod === 'facility_package'
                    ? 'Package'
                    : `${visit.pointsCharged.toLocaleString()} pts`}
                </Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Wallet and package activity</Text>
          {transactions.length === 0 ? (
            <Text style={styles.empty}>No wallet or package activity this month.</Text>
          ) : (
            transactions.map((item) => (
              <View key={item._id} style={styles.card}>
                <View style={styles.details}>
                  <Text style={styles.itemTitle}>
                    {item.description || transactionLabel(item)}
                  </Text>
                  <Text style={styles.meta}>
                    {transactionLabel(item)} · {dateLabel(item.createdAt)}
                  </Text>
                </View>
                <Text style={styles.points}>
                  {item.balanceScope === 'facility_package'
                    ? 'Package'
                    : `${item.type === 'debit' || item.type === 'pass_debit' ? '−' : '+'}${item.points.toLocaleString()} pts`}
                </Text>
              </View>
            ))
          )}

          {hasMore && (
            <Pressable
              style={styles.more}
              onPress={() => void loadHistory(page + 1)}
              disabled={loadingMore}
              accessibilityRole="button"
            >
              {loadingMore ? (
                <ActivityIndicator color={c.primaryDark} />
              ) : (
                <Text style={styles.moreText}>Load more</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
