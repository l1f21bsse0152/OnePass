import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ScreenTexture from '../components/ScreenTexture';
import tileDepth from '../theme/tileDepth';
import type { MainTabParamList } from '../navigation/MainTabParamList';
import {
  getFacilities,
  getMonthlyHistory,
  getMyPassStatus,
  getPassPlans,
  getWallet,
  type Facility,
} from '../services/onepass';

type AssistantNavigation = BottomTabNavigationProp<
  MainTabParamList,
  'Assistant'
>;

type Message = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  createdAt: Date;
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const promptOptions: { label: string; icon: IconName }[] = [
  { label: 'Wallet balance', icon: 'wallet-outline' },
  { label: 'Available facilities', icon: 'map-search-outline' },
  { label: 'Facility packages', icon: 'package-variant-closed' },
  { label: 'My active pass', icon: 'ticket-confirmation-outline' },
  { label: 'Pass plans', icon: 'ticket-outline' },
  { label: 'Monthly activity', icon: 'calendar-month-outline' },
  { label: 'Top-up options', icon: 'wallet-plus-outline' },
  { label: 'Opening hours', icon: 'clock-outline' },
  { label: 'Workout routine', icon: 'dumbbell' },
];

const facilitySummary = (facility: Facility) => {
  const hourlyRate = facility.pointsPerHour ?? facility.pointsPerVisit;
  const packageSummary = (type: 'weekly' | 'monthly') => {
    const plan = facility.packages?.[type];
    return plan
      ? `${type}: ${plan.hoursIncluded}h/${plan.durationDays} days for ${plan.pointsCost.toLocaleString()} points`
      : `${type}: not listed`;
  };

  return [
    `• ${facility.name} (${facility.category}, ${facility.city}) — ${facility.address}.`,
    `${hourlyRate.toLocaleString()} points/hour;`,
    packageSummary('weekly'),
    packageSummary('monthly'),
  ].join(' ');
};

export default function AssistantScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<AssistantNavigation>();
  const c = theme.colors;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello ${user?.fullName?.split(' ')[0] || 'there'}! I can look up your live wallet balance, OnePass-enabled facilities and hourly rates, facility packages, active pass status, and this month's activity. Opening hours and general AI-generated advice are not connected yet.`,
      createdAt: new Date(),
    },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);

  const addMessage = (role: Message['role'], text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role,
        text,
        createdAt: new Date(),
      },
    ]);
  };

  const loadAccessFacilities = async () => {
    const city = user?.city?.trim();
    const result = await getFacilities({
      limit: 50,
      city: city || undefined,
    });
    return result.facilities.filter(
      (facility) => facility.accessEnabled !== false
    );
  };

  const handlePrompt = async (prompt: string) => {
    addMessage('user', prompt);
    setLoading(true);
    try {
      const normalizedPrompt = prompt.toLowerCase();

      if (/top.?up|add points|buy points|payment/.test(normalizedPrompt)) {
        addMessage(
          'assistant',
          'Point top-ups and payments are not enabled yet. You can use your current wallet points for hourly facility access or to buy a facility package.'
        );
      } else if (
        /monthly activity|history|transaction|activity|visit|spend|spent|purchase/.test(
          normalizedPrompt
        )
      ) {
        const history = await getMonthlyHistory();
        const recentVisits = history.visits.items.slice(0, 4);
        const recentTransactions = history.transactions.items.slice(0, 4);
        const visitSummary = recentVisits.length
          ? recentVisits
              .map(
                (visit) =>
                  `• ${visit.facility?.name ?? 'Facility visit'}: ${visit.hoursUsed}h, ${visit.pointsCharged.toLocaleString()} points, ${new Date(visit.accessedAt).toLocaleDateString()}.`
              )
              .join('\n')
          : 'No facility visits recorded this month.';
        const transactionSummary = recentTransactions.length
          ? recentTransactions
              .map(
                (transaction) =>
                  `• ${transaction.description || transaction.type}: ${
                    transaction.balanceScope === 'facility_package'
                      ? 'facility package activity'
                      : `${transaction.points.toLocaleString()} points`
                  }, ${new Date(transaction.createdAt).toLocaleDateString()}.`
              )
              .join('\n')
          : 'No wallet transactions recorded this month.';
        addMessage(
          'assistant',
          `${history.month} activity (${history.timezone}): ${history.visits.pagination.total} visit(s) and ${history.transactions.pagination.total} wallet transaction(s).\n\nRecent visits:\n${visitSummary}\n\nRecent transactions:\n${transactionSummary}`
        );
      } else if (/balance|wallet|points/.test(normalizedPrompt)) {
        const wallet = await getWallet();
        addMessage(
          'assistant',
          `Your available balance is ${wallet.totalAvailablePoints.toLocaleString()} points (${wallet.purchasedPoints.toLocaleString()} purchased and ${wallet.bonusPoints.toLocaleString()} bonus). Wallet status: ${wallet.status}.`
        );
      } else if (/pass plans|catalog/.test(normalizedPrompt)) {
        const plans = await getPassPlans();
        addMessage(
          'assistant',
          plans.length
            ? `Universal OnePass demo plans:\n${plans
                .map(
                  (plan) =>
                    `• ${plan.name}: ${plan.includedPoints.toLocaleString()} points + ${plan.bonusPoints.toLocaleString()} bonus, valid for ${plan.durationDays} days.`
                )
                .join('\n')}\n\nPurchases and payments are not enabled yet.`
            : 'No universal OnePass plans are listed right now.'
        );
      } else if (/package|weekly plan|monthly plan/.test(normalizedPrompt)) {
        const availableFacilities = (await loadAccessFacilities()).slice(0, 8);
        addMessage(
          'assistant',
          availableFacilities.length
            ? `Facility rates and package options${user?.city ? ` in ${user.city}` : ''}:\n${availableFacilities
                .map(facilitySummary)
                .join('\n')}\n\nPackage availability and prices come from each facility's current OnePass configuration.`
            : 'There are no OnePass-enabled facilities available right now.'
        );
      } else if (/pass|subscription/.test(normalizedPrompt)) {
        const status = await getMyPassStatus();
        if (status.hasActivePass) {
          addMessage(
            'assistant',
            `You have ${status.subscriptions.length} active OnePass pass(es):\n${status.subscriptions
              .map(
                (subscription) =>
                  `• ${subscription.plan.name}: ${subscription.pointsRemaining.toLocaleString()} points remaining, expires ${new Date(subscription.expiresAt).toLocaleDateString()}.`
              )
              .join('\n')}`
          );
        } else {
          const plans = await getPassPlans();
          addMessage(
            'assistant',
            plans.length
              ? `You don't have an active OnePass pass. The catalog lists ${plans.length} demo plans. Ask me about pass plans to see their included and bonus points. Purchases and payments aren't enabled yet; you can still use wallet points or buy a facility-specific package.`
              : "You don't have an active OnePass pass, and there are no pass plans listed right now."
          );
        }
      } else if (/hour|open|schedule|time/.test(normalizedPrompt)) {
        addMessage(
          'assistant',
          'Opening and closing times are not included in the facility data yet. I can show each facility’s points-per-hour rate and its weekly/monthly package details.'
        );
      } else if (/facility|venue|near|location|map/.test(normalizedPrompt)) {
        const availableFacilities = (await loadAccessFacilities()).slice(0, 8);
        addMessage(
          'assistant',
          availableFacilities.length
            ? `OnePass-enabled facilities and hourly rates${user?.city ? ` in ${user.city}` : ''}:\n${availableFacilities
                .map(facilitySummary)
                .join('\n')}\n\nOpen Discover to search the directory and see facility details.`
            : 'There are no OnePass-enabled facilities available right now.'
        );
      } else if (/workout|routine|exercise|training/.test(normalizedPrompt)) {
        addMessage(
          'assistant',
          'Personalized workout plans require an AI service, which is not connected yet. I can still find OnePass fitness facilities, hourly rates, and available packages.'
        );
      } else {
        addMessage(
          'assistant',
          'I can answer questions about your wallet balance, facilities and hourly rates, facility packages, active passes, monthly activity, and top-up availability. General AI chat is not connected yet.'
        );
      }
    } catch (requestError) {
      addMessage(
        'assistant',
        requestError instanceof Error
          ? `I couldn't retrieve that information: ${requestError.message}`
          : 'I could not retrieve that information. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text || loading) return;
    setDraft('');
    void handlePrompt(text);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surface },
    header: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { color: c.primaryDark, fontSize: 18, fontWeight: '800' },
    headerStatus: {
      color: c.textSecondary,
      fontSize: 11,
      marginTop: 3,
    },
    body: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center' },
    content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
    welcome: { alignItems: 'center', marginBottom: 20 },
    botAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    welcomeTitle: {
      color: c.primaryDark,
      fontSize: 25,
      lineHeight: 33,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 6,
    },
    welcomeText: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      maxWidth: 380,
    },
    prompts: { gap: 8, paddingHorizontal: 4, paddingBottom: 20 },
    prompt: {
      minHeight: 40,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 22,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      shadowColor: '#0F172A',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
      ...tileDepth,
    },
    promptText: { color: c.text, fontSize: 12, fontWeight: '600' },
    chat: { gap: 18, paddingBottom: 8 },
    messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    messageAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 3,
    },
    messageContent: { flex: 1, maxWidth: '88%' },
    messageBubble: {
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border + '55',
      borderRadius: 18,
      borderTopLeftRadius: 4,
      padding: 14,
      shadowColor: '#0F172A',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
      ...tileDepth,
    },
    messageText: { color: c.text, fontSize: 14, lineHeight: 21 },
    messageTime: {
      color: c.textSecondary,
      fontSize: 10,
      marginTop: 5,
      marginLeft: 4,
    },
    userMessageRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      gap: 9,
    },
    userMessageContent: { maxWidth: '82%', alignItems: 'flex-end' },
    userBubble: {
      backgroundColor: c.primaryAction,
      borderRadius: 18,
      borderTopRightRadius: 4,
      padding: 14,
      shadowColor: '#0F172A',
      shadowOpacity: 0.12,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
      ...tileDepth,
    },
    userMessageText: {
      color: c.onPrimaryAction,
      fontSize: 14,
      lineHeight: 21,
    },
    userAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 3,
    },
    typing: { paddingHorizontal: 14, paddingVertical: 12 },
    composer: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    composerInput: {
      flex: 1,
      minHeight: 48,
      maxHeight: 110,
      color: c.text,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 25,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 14,
    },
    sendButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: { opacity: 0.45 },
  });

  const formatMessageTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenTexture color={c.primary} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.iconButton}
              onPress={() => navigation.navigate('Home')}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={23}
                color={c.secondaryDark}
              />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>AI Assistant</Text>
              <Text style={styles.headerStatus}>
                Live OnePass data · AI chat not connected
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={() =>
              Alert.alert(
                'Chat history',
                'This conversation is stored only while the screen is open.'
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Chat history"
          >
            <MaterialCommunityIcons
              name="history"
              size={21}
              color={c.secondaryDark}
            />
          </Pressable>
        </View>

        <View style={styles.body}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.welcome}>
              <View style={styles.botAvatar}>
                <MaterialCommunityIcons
                  name="robot-outline"
                  size={30}
                  color={c.onPrimaryAction}
                />
              </View>
              <Text style={styles.welcomeTitle}>
                Hello {user?.fullName?.split(' ')[0] || 'there'}!
              </Text>
              <Text style={styles.welcomeText}>
                Check your wallet, find access-enabled facilities and package
                prices, review pass status, or see your monthly activity. Opening
                hours and general AI advice are not available yet.
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.prompts}
            >
              {promptOptions.map((prompt) => (
                <Pressable
                  key={prompt.label}
                  style={styles.prompt}
                  onPress={() => void handlePrompt(prompt.label)}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name={prompt.icon}
                    size={16}
                    color={c.primaryDark}
                  />
                  <Text style={styles.promptText}>{prompt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.chat}>
              {messages.map((message) =>
                message.role === 'assistant' ? (
                  <View key={message.id} style={styles.messageRow}>
                    <View style={styles.messageAvatar}>
                      <MaterialCommunityIcons
                        name="robot-outline"
                        size={18}
                        color={c.onPrimaryAction}
                      />
                    </View>
                    <View style={styles.messageContent}>
                      <View style={styles.messageBubble}>
                        <Text style={styles.messageText}>{message.text}</Text>
                      </View>
                      <Text style={styles.messageTime}>
                        {formatMessageTime(message.createdAt)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View key={message.id} style={styles.userMessageRow}>
                    <View style={styles.userMessageContent}>
                      <View style={styles.userBubble}>
                        <Text style={styles.userMessageText}>
                          {message.text}
                        </Text>
                      </View>
                      <Text style={styles.messageTime}>
                        {formatMessageTime(message.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.userAvatar}>
                      <MaterialCommunityIcons
                        name="account-outline"
                        size={18}
                        color={c.textSecondary}
                      />
                    </View>
                  </View>
                )
              )}
              {loading && (
                <View style={styles.messageRow}>
                  <View style={styles.messageAvatar}>
                    <MaterialCommunityIcons
                      name="robot-outline"
                      size={18}
                      color={c.onPrimaryAction}
                    />
                  </View>
                  <View style={[styles.messageBubble, styles.typing]}>
                    <ActivityIndicator size="small" color={c.primaryDark} />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message or ask a question..."
            placeholderTextColor={c.textSecondary}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!loading}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!draft.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!draft.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <MaterialCommunityIcons
              name="send"
              size={18}
              color={c.onPrimaryAction}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
