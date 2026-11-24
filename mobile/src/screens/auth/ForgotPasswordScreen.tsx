
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ScreenTexture from '../../components/ScreenTexture';
import tileDepth from '../../theme/tileDepth';
import { spacing, radius, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type NavProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const { forgotPassword } = useAuth();
  const navigation = useNavigation<NavProp>();
  const c = theme.colors;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      Keyboard.dismiss();

      await forgotPassword(normalizedEmail);

      navigation.navigate('ResetPassword', {
        email: normalizedEmail,
      });
    } catch (err: any) {
      setError(
        err.message || 'Unable to process your request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    topBar: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: {
      flex: 1,
      color: c.text,
      fontSize: typography.regular,
      fontWeight: '700',
      textAlign: 'center',
      marginRight: 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    heroIcon: {
      width: 76,
      height: 76,
      borderRadius: 24,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      ...tileDepth,
    },
    brandBadge: {
      backgroundColor: c.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      marginBottom: spacing.md,
    },
    brandBadgeText: {
      color: c.primaryDark,
      fontSize: typography.small,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    title: {
      color: c.text,
      fontSize: 28,
      fontWeight: '800',
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: typography.body,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 340,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...tileDepth,
    },
    errorBox: {
      backgroundColor: c.danger + '18',
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    errorText: {
      color: c.danger,
      fontSize: typography.body,
      fontWeight: '600',
      lineHeight: 20,
    },
    label: {
      color: c.text,
      fontSize: typography.small,
      fontWeight: '700',
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      flex: 1,
      minHeight: 48,
      color: c.text,
      fontSize: typography.body,
      paddingVertical: spacing.sm,
    },
    inputShell: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    inputIcon: {
      marginRight: spacing.sm,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    infoText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: typography.small,
      lineHeight: 20,
      marginLeft: spacing.sm,
    },
    button: {
      backgroundColor: c.primaryAction,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: spacing.md + 2,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
      shadowColor: c.primaryDark,
      shadowOpacity: 0.18,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    buttonDisabled: {
      opacity: 0.65,
    },
    buttonText: {
      color: c.onPrimaryAction,
      fontSize: typography.regular,
      fontWeight: '800',
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    footerText: {
      color: c.textSecondary,
      fontSize: typography.body,
    },
    footerLink: {
      color: c.primaryDark,
      fontSize: typography.body,
      fontWeight: '800',
      marginLeft: spacing.xs,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScreenTexture color={c.primary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={21}
                color={c.text}
              />
            </Pressable>
            <Text style={styles.topBarTitle}>Forgot Password</Text>
          </View>

          <View style={styles.header}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons
                name="lock-reset"
                size={38}
                color={c.primaryDark}
              />
            </View>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>ACCOUNT RECOVERY</Text>
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter the email linked to your OnePass account and we'll send a
              secure reset code.
            </Text>
          </View>

          <View style={styles.card}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Email Address</Text>

            <View style={styles.inputShell}>
              <MaterialCommunityIcons
                name="email-outline"
                size={19}
                color={c.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor={c.textSecondary}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                editable={!loading}
              />
            </View>

            <View style={styles.infoBox}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={19}
                color={c.primaryDark}
              />
              <Text style={styles.infoText}>
                If an eligible account exists, a six-digit code will be sent to
                its registered email address.
              </Text>
            </View>

            <Pressable
              style={[
                styles.button,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Send Reset Code</Text>
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={18}
                    color={c.onPrimaryAction}
                  />
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Remember your password?
            </Text>

            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
