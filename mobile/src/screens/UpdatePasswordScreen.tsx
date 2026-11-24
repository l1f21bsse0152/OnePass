import React, { useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ScreenTexture from '../components/ScreenTexture';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ProfileStackParamList } from '../navigation/ProfileStackParamList';
import {
  changePasswordWithOTP,
  requestPasswordChangeOTP,
} from '../services/onepass';
import tileDepth from '../theme/tileDepth';

type UpdatePasswordNavigation = NativeStackNavigationProp<
  ProfileStackParamList,
  'UpdatePassword'
>;

export default function UpdatePasswordScreen() {
  const navigation = useNavigation<UpdatePasswordNavigation>();
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const c = theme.colors;
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setTimeout(
      () => setResendSeconds((seconds) => seconds - 1),
      1000
    );
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 22, paddingBottom: 38 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 17,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    title: { color: c.text, fontSize: 24, fontWeight: '800' },
    subtitle: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 20,
    },
    emailCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 17,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 19,
      ...tileDepth,
    },
    emailIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    emailTextWrap: { flex: 1 },
    emailLabel: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    emailValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 4,
    },
    formCard: {
      padding: 18,
      borderRadius: 19,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      ...tileDepth,
    },
    label: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 7,
      marginTop: 14,
    },
    input: {
      minHeight: 49,
      color: c.text,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 15,
    },
    hint: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 9,
    },
    button: {
      minHeight: 50,
      borderRadius: 13,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 9,
      paddingHorizontal: 14,
      marginTop: 18,
      ...tileDepth,
    },
    buttonDisabled: { opacity: 0.55 },
    buttonText: {
      color: c.onPrimaryAction,
      fontSize: 14,
      fontWeight: '800',
    },
    resendButton: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      marginTop: 5,
    },
    resendText: {
      color: c.primaryDark,
      fontSize: 13,
      fontWeight: '800',
    },
    error: {
      color: c.danger,
      backgroundColor: c.danger + '18',
      borderRadius: 12,
      padding: 13,
      lineHeight: 20,
      marginBottom: 14,
    },
  });

  const handleRequestCode = async () => {
    setError(null);
    setSendingCode(true);
    try {
      await requestPasswordChangeOTP();
      setCodeSent(true);
      setResendSeconds(60);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to send a verification code.'
      );
    } finally {
      setSendingCode(false);
    }
  };

  const handleUpdatePassword = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      setError('Password must contain between 8 and 72 characters.');
      return;
    }
    if (
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setError('Password needs uppercase, lowercase, and numeric characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      const response = await changePasswordWithOTP({
        otp,
        newPassword,
        confirmPassword,
      });
      Alert.alert(
        'Password updated',
        response.message || 'Please sign in again with your new password.',
        [{ text: 'Sign in', onPress: () => void logout() }]
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update your password.'
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenTexture color={c.primary} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topBar}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back to profile"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={21}
                color={c.primaryDark}
              />
            </Pressable>
            <Text style={styles.title}>Update password</Text>
          </View>
          <Text style={styles.subtitle}>
            Verify your identity with a one-time code sent to the email saved on
            your OnePass account.
          </Text>

          <View style={styles.emailCard}>
            <View style={styles.emailIcon}>
              <MaterialCommunityIcons
                name="email-outline"
                size={22}
                color={c.primaryDark}
              />
            </View>
            <View style={styles.emailTextWrap}>
              <Text style={styles.emailLabel}>Verification email</Text>
              <Text style={styles.emailValue}>{user?.email ?? '—'}</Text>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.formCard}>
            {codeSent && (
              <>
                <Text style={styles.label}>Email verification code</Text>
                <TextInput
                  style={styles.input}
                  value={otp}
                  onChangeText={(value) =>
                    setOtp(value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={c.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                />
                <Text style={styles.hint}>
                  The code is valid for 10 minutes. Check your inbox and spam
                  folder if it does not appear.
                </Text>
                <Pressable
                  style={styles.resendButton}
                  onPress={() => void handleRequestCode()}
                  disabled={sendingCode || resendSeconds > 0}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.resendText,
                      resendSeconds > 0 && { opacity: 0.55 },
                    ]}
                  >
                    {resendSeconds > 0
                      ? `Resend code in ${resendSeconds}s`
                      : 'Resend code'}
                  </Text>
                </Pressable>

                <Text style={styles.label}>New password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={c.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  maxLength={72}
                />
                <Text style={styles.label}>Confirm new password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={c.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  maxLength={72}
                />
                <Text style={styles.hint}>
                  Use 8–72 characters with uppercase, lowercase, and a number.
                </Text>
                <Pressable
                  style={[
                    styles.button,
                    updatingPassword && styles.buttonDisabled,
                  ]}
                  onPress={() => void handleUpdatePassword()}
                  disabled={updatingPassword}
                  accessibilityRole="button"
                >
                  {updatingPassword ? (
                    <ActivityIndicator color={c.onPrimaryAction} />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="lock-reset"
                        size={19}
                        color={c.onPrimaryAction}
                      />
                      <Text style={styles.buttonText}>
                        Verify code and update password
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            {!codeSent && (
              <Pressable
                style={[
                  styles.button,
                  sendingCode && styles.buttonDisabled,
                ]}
                onPress={() => void handleRequestCode()}
                disabled={sendingCode || !user?.email}
                accessibilityRole="button"
              >
                {sendingCode ? (
                  <ActivityIndicator color={c.onPrimaryAction} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="email-outline"
                      size={19}
                      color={c.onPrimaryAction}
                    />
                    <Text style={styles.buttonText}>Send verification code</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
