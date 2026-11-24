
import React, { useEffect, useRef, useState } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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
  'ResetPassword'
>;

type ResetRouteProp = RouteProp<
  AuthStackParamList,
  'ResetPassword'
>;

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 600;
const RESEND_SECONDS = 60;

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const { resetPassword, forgotPassword } = useAuth();

  const navigation = useNavigation<NavProp>();
  const route = useRoute<ResetRouteProp>();

  const { email } = route.params;
  const c = theme.colors;

  const [otp, setOtp] = useState<string[]>(
    Array(OTP_LENGTH).fill('')
  );
  const [focusedIndex, setFocusedIndex] = useState(0);

  const [expirySeconds, setExpirySeconds] = useState(
    OTP_EXPIRY_SECONDS
  );
  const [resendSeconds, setResendSeconds] = useState(
    RESEND_SECONDS
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Corrected ref type: stores the focus method of each OTP input.
  const inputRefs = useRef<
    Array<{ focus: () => void } | null>
  >([]);

  const otpValue = otp.join('');
  const isOtpComplete = otpValue.length === OTP_LENGTH;

  const passwordRules = {
    length: password.length >= 8 && password.length <= 72,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const allPasswordRulesPassed =
    passwordRules.length &&
    passwordRules.uppercase &&
    passwordRules.lowercase &&
    passwordRules.number;
  const strengthLevel = Object.values(passwordRules).filter(Boolean).length;
  const strengthLabel =
    strengthLevel <= 1
      ? 'Weak'
      : strengthLevel === 2
        ? 'Fair'
        : strengthLevel === 3
          ? 'Good'
          : 'Strong';

  useEffect(() => {
    const interval = setInterval(() => {
      setExpirySeconds((previous) => Math.max(0, previous - 1));
      setResendSeconds((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  };

  const handleOtpChange = (value: string, index: number) => {
    setError(null);

    const digits = value.replace(/\D/g, '');

    if (!digits) {
      const updatedOtp = [...otp];
      updatedOtp[index] = '';
      setOtp(updatedOtp);
      return;
    }

    // Supports pasting a complete or partial OTP.
    if (digits.length > 1) {
      const updatedOtp = [...otp];

      for (
        let i = 0;
        i < digits.length && index + i < OTP_LENGTH;
        i++
      ) {
        updatedOtp[index + i] = digits[i];
      }

      setOtp(updatedOtp);

      const nextIndex = Math.min(
        index + digits.length,
        OTP_LENGTH - 1
      );

      inputRefs.current[nextIndex]?.focus();

      if (updatedOtp.every((digit) => digit !== '')) {
        Keyboard.dismiss();
      }

      return;
    }

    const updatedOtp = [...otp];
    updatedOtp[index] = digits[0];
    setOtp(updatedOtp);

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || resending || loading) {
      return;
    }

    setError(null);

    try {
      setResending(true);

      await forgotPassword(email);

      setOtp(Array(OTP_LENGTH).fill(''));
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setResendSeconds(RESEND_SECONDS);
      setFocusedIndex(0);

      inputRefs.current[0]?.focus();

      Alert.alert(
        'Request Processed',
        'If an eligible account exists, a new password reset code has been requested.'
      );
    } catch (err: any) {
      setError(
        err.message || 'Unable to request another code. Please try again.'
      );
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);

    if (!isOtpComplete) {
      setError('Please enter all six digits of your reset code.');
      return;
    }

    if (expirySeconds <= 0) {
      setError('Your reset code has expired. Please request a new one.');
      return;
    }

    if (!allPasswordRulesPassed) {
      setError('Please meet all password requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      Keyboard.dismiss();

      await resetPassword({
        email,
        otp: otpValue,
        newPassword: password,
        confirmPassword,
      });

      Alert.alert(
        'Password Reset Successful',
        'Your OnePass password has been updated. You can now sign in using your new password.',
        [
          {
            text: 'Continue to Sign In',
            onPress: () => navigation.replace('Login'),
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      setError(
        err.message || 'Unable to reset your password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderRequirement = (passed: boolean, label: string) => (
    <View style={styles.requirementRow} key={label}>
      <Text
        style={{
          color: passed ? c.success : c.textSecondary,
          fontWeight: '800',
        }}
      >
        {passed ? '✓' : '○'}
      </Text>

      <Text
        style={[
          styles.requirementText,
          { color: passed ? c.success : c.textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    topBar: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.lg,
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
      marginBottom: spacing.lg,
    },
    heroIcon: {
      width: 70,
      height: 70,
      borderRadius: 22,
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      ...tileDepth,
    },
    brandBadge: {
      backgroundColor: c.primarySoft,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      marginBottom: spacing.sm,
    },
    brandBadgeText: {
      color: c.primaryDark,
      fontSize: typography.small,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    title: {
      color: c.text,
      fontSize: 26,
      fontWeight: '800',
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: typography.body,
      lineHeight: 21,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    emailText: {
      color: c.primaryDark,
      fontWeight: '800',
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
    sectionTitle: {
      color: c.text,
      fontSize: typography.regular,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    helperText: {
      color: c.textSecondary,
      fontSize: typography.body,
      lineHeight: 21,
      marginBottom: spacing.lg,
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    otpInput: {
      width: '14%',
      height: 56,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.lg,
      color: c.text,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
      padding: 0,
    },
    otpInputFocused: {
      borderColor: c.primaryDark,
      backgroundColor: c.primarySoft,
    },
    timerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    timerLabel: {
      color: c.textSecondary,
      fontSize: typography.small,
    },
    timerValue: {
      color: c.primaryDark,
      fontSize: typography.small,
      fontWeight: '800',
    },
    expiredText: {
      color: c.danger,
    },
    resendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.xl,
      flexWrap: 'wrap',
    },
    footerText: {
      color: c.textSecondary,
      fontSize: typography.body,
    },
    resendLink: {
      color: c.primaryDark,
      fontSize: typography.body,
      fontWeight: '800',
      marginLeft: spacing.xs,
    },
    resendDisabled: {
      color: c.textSecondary,
    },
    label: {
      color: c.text,
      fontSize: typography.small,
      fontWeight: '700',
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      marginBottom: spacing.lg,
    },
    passwordInput: {
      flex: 1,
      color: c.text,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: typography.body,
    },
    visibilityButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    requirements: {
      backgroundColor: c.surfaceSecondary,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: -spacing.sm,
      marginBottom: spacing.lg,
    },
    strengthHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    strengthValue: {
      color: c.primaryDark,
      fontSize: typography.small,
      fontWeight: '800',
    },
    strengthBars: {
      flexDirection: 'row',
      gap: 5,
      marginBottom: spacing.md,
    },
    strengthBar: {
      flex: 1,
      height: 5,
      borderRadius: radius.full,
      backgroundColor: c.border,
    },
    strengthBarActive: {
      backgroundColor: c.primaryAction,
    },
    requirementsTitle: {
      color: c.text,
      fontSize: typography.small,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    requirementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    requirementText: {
      fontSize: typography.small,
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
      opacity: 0.55,
    },
    buttonText: {
      color: c.onPrimaryAction,
      fontSize: typography.regular,
      fontWeight: '800',
    },
    securityNote: {
      color: c.textSecondary,
      fontSize: typography.small,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: spacing.lg,
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
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={21}
                color={c.text}
              />
            </Pressable>
            <Text style={styles.topBarTitle}>Reset Password</Text>
          </View>

          <View style={styles.header}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons
                name="lock-reset"
                size={34}
                color={c.primaryDark}
              />
            </View>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>ACCOUNT RECOVERY</Text>
            </View>
            <Text style={styles.title}>Set a New Password</Text>
            <Text style={styles.subtitle}>
              Enter the six-digit code sent to{' '}
              <Text style={styles.emailText}>{email}</Text>
            </Text>
          </View>

          <View style={styles.card}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              Verification Code
            </Text>

            <Text style={styles.helperText}>
              Enter the password reset code from your email.
            </Text>

            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpInput,
                    focusedIndex === index && styles.otpInputFocused,
                  ]}
                  value={digit}
                  onChangeText={(value) =>
                    handleOtpChange(value, index)
                  }
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, index)
                  }
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => {
                    if (focusedIndex === index) {
                      setFocusedIndex(-1);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                  autoCorrect={false}
                  editable={!loading && !resending}
                  accessibilityLabel={`Reset code digit ${index + 1}`}
                  textContentType="oneTimeCode"
                />
              ))}
            </View>

            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>
                Code expires in
              </Text>

              <Text
                style={[
                  styles.timerValue,
                  expirySeconds === 0 && styles.expiredText,
                ]}
              >
                {formatTime(expirySeconds)}
              </Text>
            </View>

            <View style={styles.resendRow}>
              <Text style={styles.footerText}>
                Didn't receive the code?
              </Text>

              {resending ? (
                <ActivityIndicator
                  size="small"
                  color={c.primaryDark}
                  style={{ marginLeft: spacing.sm }}
                />
              ) : (
                <Pressable
                  onPress={handleResend}
                  disabled={resendSeconds > 0 || loading}
                >
                  <Text
                    style={[
                      styles.resendLink,
                      (resendSeconds > 0 || loading) &&
                        styles.resendDisabled,
                    ]}
                  >
                    {resendSeconds > 0
                      ? `Resend in ${formatTime(resendSeconds)}`
                      : 'Resend Code'}
                  </Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.label}>New Password</Text>

            <View style={styles.passwordRow}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={19}
                color={c.textSecondary}
                style={{ marginLeft: spacing.md }}
              />
              <TextInput
                style={styles.passwordInput}
                placeholder="Create a new password"
                placeholderTextColor={c.textSecondary}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                editable={!loading}
                maxLength={72}
              />

              <Pressable
                style={styles.visibilityButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={c.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.requirements}>
              <View style={styles.strengthHeader}>
                <Text style={styles.requirementsTitle}>Password strength</Text>
                <Text style={styles.strengthValue}>{strengthLabel}</Text>
              </View>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.strengthBar,
                      level <= strengthLevel && styles.strengthBarActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.requirementsTitle}>
                Use 8–72 characters with:
              </Text>

              {renderRequirement(
                passwordRules.length,
                '8–72 characters'
              )}
              {renderRequirement(
                passwordRules.uppercase,
                'One uppercase letter'
              )}
              {renderRequirement(
                passwordRules.lowercase,
                'One lowercase letter'
              )}
              {renderRequirement(
                passwordRules.number,
                'One number'
              )}
            </View>

            <Text style={styles.label}>Confirm New Password</Text>

            <View style={styles.passwordRow}>
              <MaterialCommunityIcons
                name="lock-check-outline"
                size={19}
                color={c.textSecondary}
                style={{ marginLeft: spacing.md }}
              />
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm your new password"
                placeholderTextColor={c.textSecondary}
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setError(null);
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                editable={!loading}
                maxLength={72}
              />

              <Pressable
                style={styles.visibilityButton}
                onPress={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={
                  showConfirmPassword
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
              >
                <MaterialCommunityIcons
                  name={
                    showConfirmPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={20}
                  color={c.textSecondary}
                />
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.button,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={loading || resending}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Reset Password</Text>
                  <MaterialCommunityIcons
                    name="lock-reset"
                    size={18}
                    color={c.onPrimaryAction}
                  />
                </>
              )}
            </Pressable>

            <Text style={styles.securityNote}>
              Never share your password reset code with anyone.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
