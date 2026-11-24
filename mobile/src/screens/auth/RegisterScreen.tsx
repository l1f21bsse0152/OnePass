import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ScreenTexture from '../../components/ScreenTexture';
import tileDepth from '../../theme/tileDepth';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const { register } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation<NavProp>();
  const c = theme.colors;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { googleLoading, startGoogleSignIn } = useGoogleSignIn(setError);

  const passwordRules = {
    length: password.length >= 8 && password.length <= 72,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const strengthLevel = Object.values(passwordRules).filter(Boolean).length;

  const allPasswordRulesPassed =
    passwordRules.length &&
    passwordRules.uppercase &&
    passwordRules.lowercase &&
    passwordRules.number;

  const handleRegister = async () => {
    setError(null);

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setError('Full name must contain between 2 and 80 characters.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
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

    if (!acceptedTerms) {
      setError('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    try {
      setLoading(true);
      const result = await register(
        normalizedName,
        normalizedEmail,
        password
      );

      navigation.navigate('VerifyOTP', {
        email: result.email || normalizedEmail,
        purpose: 'registration',
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    decorationTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 250,
      backgroundColor: c.primarySoft,
    },
    decorationRight: {
      position: 'absolute',
      top: -70,
      right: -70,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: c.primarySoft,
    },
    scroll: {
      flexGrow: 1,
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 40,
    },
    content: {
      width: '100%',
      maxWidth: 480,
    },
    topBar: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
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
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
      marginRight: 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: 22,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: c.primarySoft,
      marginBottom: 12,
    },
    brandMark: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandName: {
      color: c.primaryDark,
      fontSize: 12,
      lineHeight: 18,
      letterSpacing: 0.8,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    heading: {
      color: c.text,
      fontSize: 27,
      lineHeight: 34,
      fontWeight: '800',
      marginBottom: 4,
      textAlign: 'center',
    },
    subtitle: {
      maxWidth: 320,
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
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
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.danger,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      color: c.danger,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    field: {
      marginBottom: 16,
    },
    label: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    inputShell: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      paddingLeft: 12,
      paddingRight: 12,
    },
    input: {
      flex: 1,
      minHeight: 48,
      color: c.text,
      fontSize: 16,
      paddingVertical: 10,
    },
    eyeButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    strength: {
      marginTop: 4,
    },
    strengthBars: {
      flexDirection: 'row',
      gap: 4,
      height: 4,
      width: '100%',
      marginBottom: 4,
    },
    strengthBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
    },
    strengthBarActive: {
      backgroundColor: c.primaryAction,
    },
    strengthLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    strengthLabel: {
      color: c.textSecondary,
      fontSize: 10,
      lineHeight: 16,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 8,
      marginBottom: 16,
      gap: 12,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    checkboxSelected: {
      borderColor: c.primaryAction,
      backgroundColor: c.primaryAction,
    },
    termsText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    termsLink: {
      color: c.primaryDark,
    },
    button: {
      height: 52,
      borderRadius: 26,
      backgroundColor: c.primaryAction,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      overflow: 'hidden',
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
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: c.border,
    },
    dividerText: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    socialButton: {
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    socialText: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 32,
    },
    footerText: {
      color: c.textSecondary,
      fontSize: 14,
    },
    footerLink: {
      color: c.primaryDark,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 4,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScreenTexture color={c.primary} />
      <View style={styles.decorationTop} />
      <View style={styles.decorationRight} />
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
              <Text style={styles.topBarTitle}>Register</Text>
            </View>

            <View style={styles.header}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <MaterialCommunityIcons
                    name="credit-card-outline"
                    size={19}
                    color={c.onPrimaryAction}
                  />
                </View>
                <Text style={styles.brandName}>OnePass ID</Text>
              </View>

              <Text style={styles.heading}>Create Your OnePass</Text>
              <Text style={styles.subtitle}>
                One account for discovering facilities and managing your access.
              </Text>
            </View>

            <View style={styles.card}>
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputShell}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={18}
                    color={c.textSecondary}
                    style={{ width: 20, marginRight: 8, textAlign: 'center' }}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor={c.textSecondary}
                    value={fullName}
                    onChangeText={(value) => {
                      setFullName(value);
                      setError(null);
                    }}
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoComplete="name"
                    maxLength={80}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputShell}>
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={18}
                    color={c.textSecondary}
                    style={{ width: 20, marginRight: 8, textAlign: 'center' }}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="example@email.com"
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
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputShell}>
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={18}
                    color={c.textSecondary}
                    style={{ width: 20, marginRight: 8, textAlign: 'center' }}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a secure password"
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
                    maxLength={72}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((current) => !current)}
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

                <View style={styles.strength}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        style={[
                          styles.strengthBar,
                          level <= strengthLevel &&
                            styles.strengthBarActive,
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.strengthLabels}>
                    <Text style={styles.strengthLabel}>8+ chars</Text>
                    <Text style={styles.strengthLabel}>Uppercase</Text>
                    <Text style={styles.strengthLabel}>Lowercase</Text>
                    <Text style={styles.strengthLabel}>Number</Text>
                  </View>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputShell}>
                  <MaterialCommunityIcons
                    name="lock-check-outline"
                    size={18}
                    color={c.textSecondary}
                    style={{ width: 20, marginRight: 8, textAlign: 'center' }}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter your password"
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
                    maxLength={72}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
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
              </View>

              <Pressable
                style={styles.termsRow}
                onPress={() => setAcceptedTerms((current) => !current)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptedTerms && styles.checkboxSelected,
                  ]}
                >
                  {acceptedTerms && (
                    <MaterialCommunityIcons
                      name="check"
                      size={14}
                      color="#FFFFFF"
                    />
                  )}
                </View>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text>{' '}
                  and <Text style={styles.termsLink}>Privacy Policy</Text>.
                </Text>
              </Pressable>

              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={c.onPrimaryAction} />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Create Account</Text>
                    <MaterialCommunityIcons
                      name="account-plus-outline"
                      size={19}
                      color={c.onPrimaryAction}
                    />
                  </>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={[
                  styles.socialButton,
                  googleLoading && { opacity: 0.6 },
                ]}
                onPress={startGoogleSignIn}
                disabled={googleLoading}
                accessibilityRole="button"
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={c.primaryDark} />
                ) : (
                  <>
                    <FontAwesome name="google" size={17} color="#4285F4" />
                    <Text style={styles.socialText}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>
                  Already have an account?
                </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.footerLink}>Sign In</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
