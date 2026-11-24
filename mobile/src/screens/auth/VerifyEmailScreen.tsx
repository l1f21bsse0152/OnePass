
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
  Alert,
  Keyboard,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ScreenTexture from '../../components/ScreenTexture';
import tileDepth from '../../theme/tileDepth';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type NavProp = NativeStackNavigationProp<
  AuthStackParamList,
  'VerifyOTP'
>;

type VerifyRouteProp = RouteProp<
  AuthStackParamList,
  'VerifyOTP'
>;

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 600;
const RESEND_SECONDS = 60;

export default function VerifyEmailScreen() {
  const { theme } = useTheme();
  const {
    verifyRegistrationOtp,
    verifyGoogleRegistrationOtp,
    resendRegistrationOtp,
  } = useAuth();

  const navigation = useNavigation<NavProp>();
  const route = useRoute<VerifyRouteProp>();

  const { email, purpose, provider } = route.params;
  const c = theme.colors;

  // Store input instances, not the TextInput component type.
  const inputRefs = useRef<Array<{ focus: () => void } | null>>([]);

  const [otp, setOtp] = useState<string[]>(
    Array(OTP_LENGTH).fill('')
  );

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expirySeconds, setExpirySeconds] = useState(
    OTP_EXPIRY_SECONDS
  );

  const [resendSeconds, setResendSeconds] = useState(
    RESEND_SECONDS
  );

  const otpValue = otp.join('');
  const isOtpComplete = otpValue.length === OTP_LENGTH;

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

    // Support pasting a complete OTP into any input box.
    if (digits.length > 1) {
      const updatedOtp = [...otp];

      for (let i = 0; i < digits.length && index + i < OTP_LENGTH; i++) {
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

  const handleKeyPress = (
    key: string,
    index: number
  ) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    setError(null);

    if (purpose !== 'registration') {
      setError(
        'Password reset verification will be connected when the password reset flow is implemented.'
      );
      return;
    }

    if (!isOtpComplete) {
      setError('Please enter all six digits of your verification code.');
      return;
    }

    if (expirySeconds <= 0) {
      setError('Your verification code has expired. Please request a new one.');
      return;
    }

    try {
      setLoading(true);
      Keyboard.dismiss();

      if (provider === 'google') {
        await verifyGoogleRegistrationOtp(email, otpValue);
        return;
      }

      await verifyRegistrationOtp(email, otpValue);

      Alert.alert(
        'Email Verified!',
        'Your OnePass account has been successfully verified. You can now sign in.',
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
        err.message || 'Verification failed. Please check your code and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || resending || loading) {
      return;
    }

    setError(null);

    try {
      setResending(true);

      await resendRegistrationOtp(email);

      setOtp(Array(OTP_LENGTH).fill(''));
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setResendSeconds(RESEND_SECONDS);
      setFocusedIndex(0);

      inputRefs.current[0]?.focus();

      Alert.alert(
        'New Code Sent',
        'A new verification code has been sent to your email address.'
      );
    } catch (err: any) {
      setError(
        err.message || 'Unable to resend the verification code. Please try again.'
      );
    } finally {
      setResending(false);
    }
  };

  const handleOpenMail = async () => {
    try {
      await Linking.openURL('mailto:');
    } catch {
      Alert.alert(
        'Unable to open email',
        'Please open your email app and check your inbox or spam folder.'
      );
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: {
      flexGrow: 1,
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    content: {
      width: '100%',
      maxWidth: 448,
    },
    topBar: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 22,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBarTitle: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      marginRight: 40,
    },
    header: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 20,
    },
    heroIcon: {
      width: 74,
      height: 74,
      borderRadius: 24,
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      ...tileDepth,
    },
    title: {
      color: c.text,
      fontSize: 26,
      lineHeight: 34,
      fontWeight: '800',
      textAlign: 'center',
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 7,
      paddingHorizontal: 10,
    },
    emailPill: {
      backgroundColor: c.primarySoft,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 7,
      marginTop: 12,
    },
    emailText: {
      color: c.primaryDark,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    card: {
      width: '100%',
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      ...tileDepth,
    },
    errorBox: {
      backgroundColor: c.danger + '18',
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 14,
      padding: 12,
      marginBottom: 18,
    },
    errorText: {
      color: c.danger,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 20,
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 7,
      marginBottom: 16,
    },
    otpInput: {
      flex: 1,
      height: 56,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      color: c.text,
      fontSize: 24,
      fontWeight: '600',
      textAlign: 'center',
      padding: 0,
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    otpInputFocused: {
      borderColor: c.primaryDark,
      backgroundColor: c.surface,
    },
    resendSection: {
      alignItems: 'center',
      marginBottom: 18,
    },
    timerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 12,
    },
    timerValue: {
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    timerWarning: {
      color: c.warning,
    },
    timerCritical: {
      color: c.danger,
    },
    resendButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    resendText: {
      color: c.primaryDark,
      fontSize: 14,
      fontWeight: '600',
    },
    resendDisabled: {
      color: c.textSecondary,
      opacity: 0.5,
    },
    button: {
      width: '100%',
      height: 52,
      backgroundColor: c.primaryAction,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      shadowColor: c.primaryAction,
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: c.onPrimaryAction,
      fontSize: 14,
      fontWeight: '600',
    },
    helpCard: {
      width: '100%',
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      padding: 15,
      marginTop: 14,
      alignItems: 'center',
    },
    helpTitle: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 4,
    },
    helpText: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginBottom: 8,
    },
    openMailButton: {
      minHeight: 36,
      borderRadius: 18,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.primarySoft,
    },
    openMailText: {
      color: c.primaryDark,
      fontSize: 12,
      fontWeight: '700',
    },
    footerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
      paddingVertical: 8,
    },
    footerText: {
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    securityNote: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 16,
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
          <View style={styles.content}>
            <View style={styles.topBar}>
              <Pressable
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={21}
                  color={c.text}
                />
              </Pressable>
              <Text style={styles.topBarTitle}>Email OTP Verification</Text>
            </View>

            <View style={styles.header}>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons
                  name="email-check-outline"
                  size={35}
                  color={c.primaryDark}
                />
              </View>
              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.subtitle}>
                We've sent a 6-digit verification code to your registered email
                address.
              </Text>
              <View style={styles.emailPill}>
                <Text style={styles.emailText}>{email}</Text>
              </View>
            </View>

            <View style={styles.card}>
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

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
                    onChangeText={(value) => handleOtpChange(value, index)}
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
                    accessibilityLabel={`Verification digit ${index + 1}`}
                    textContentType="oneTimeCode"
                  />
                ))}
              </View>

              <View style={styles.resendSection}>
                <View style={styles.timerRow}>
                  <MaterialCommunityIcons
                    name="timer-outline"
                    size={20}
                    color={c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.timerValue,
                      resendSeconds <= 20 &&
                        resendSeconds > 10 &&
                        styles.timerWarning,
                      resendSeconds <= 10 && styles.timerCritical,
                    ]}
                  >
                    {formatTime(resendSeconds)}
                  </Text>
                </View>

                {resending ? (
                  <ActivityIndicator size="small" color={c.primaryDark} />
                ) : (
                  <Pressable
                    style={styles.resendButton}
                    onPress={handleResend}
                    disabled={resendSeconds > 0 || loading}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.resendText,
                        (resendSeconds > 0 || loading) &&
                          styles.resendDisabled,
                      ]}
                    >
                      Resend Verification Code
                    </Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                style={[
                  styles.button,
                  (!isOtpComplete || loading || expirySeconds === 0) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleVerify}
                disabled={
                  !isOtpComplete ||
                  loading ||
                  resending ||
                  expirySeconds === 0
                }
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={c.onPrimaryAction} />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Verify Account</Text>
                    <MaterialCommunityIcons
                      name="email-check-outline"
                      size={19}
                      color={c.onPrimaryAction}
                    />
                  </>
                )}
              </Pressable>

              <Text style={styles.securityNote}>
                Your code expires in {formatTime(expirySeconds)}. Never share
                your verification code with anyone.
              </Text>

              <View style={styles.helpCard}>
                <Text style={styles.helpTitle}>Can't find the email?</Text>
                <Text style={styles.helpText}>
                  Check your spam folder, or open your email app to find the
                  verification message.
                </Text>
                <Pressable
                  style={styles.openMailButton}
                  onPress={() => void handleOpenMail()}
                  accessibilityRole="button"
                >
                  <MaterialCommunityIcons
                    name="open-in-new"
                    size={15}
                    color={c.primaryDark}
                  />
                  <Text style={styles.openMailText}>Open Mail</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={styles.footerButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={20}
                color={c.textSecondary}
              />
              <Text style={styles.footerText}>
                {provider === 'google' ? 'Back to Sign In' : 'Back to Register'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
