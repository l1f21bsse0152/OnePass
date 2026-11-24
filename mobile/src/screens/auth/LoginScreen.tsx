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

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ScreenTexture from '../../components/ScreenTexture';
import tileDepth from '../../theme/tileDepth';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;
type LoginField = 'email' | 'password';

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const navigation = useNavigation<NavProp>();
  const c = theme.colors;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<LoginField | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { googleLoading, startGoogleSignIn } = useGoogleSignIn(setError);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
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
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    content: {
      width: '100%',
      maxWidth: 440,
      alignItems: 'center',
    },
    header: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 22,
    },
    brandIcon: {
      width: 64,
      height: 64,
      borderRadius: 19,
      backgroundColor: c.primaryAction,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      ...tileDepth,
    },
    brandBadge: {
      backgroundColor: c.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 14,
      marginBottom: 11,
    },
    brandBadgeText: {
      color: c.primaryDark,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    heading: {
      color: c.text,
      fontSize: 27,
      lineHeight: 34,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 5,
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      paddingHorizontal: 12,
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
    form: {
      gap: 16,
    },
    inputGroup: {
      position: 'relative',
      justifyContent: 'center',
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
    },
    inputGroupFocused: {
      borderRadius: 13,
      borderColor: c.primaryDark,
      shadowColor: c.primaryDark,
      shadowOpacity: 0.14,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 0 },
      elevation: 2,
    },
    input: {
      width: '100%',
      height: 52,
      backgroundColor: 'transparent',
      borderWidth: 0,
      color: c.text,
      fontSize: 16,
      paddingLeft: 48,
      paddingRight: 48,
      paddingTop: 16,
      paddingBottom: 4,
      zIndex: 1,
    },
    floatingLabel: {
      position: 'absolute',
      left: 48,
      top: 17,
      zIndex: 2,
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    floatingLabelActive: {
      top: 6,
      color: c.primaryDark,
      fontSize: 10,
      lineHeight: 12,
    },
    passwordToggle: {
      position: 'absolute',
      right: 12,
      width: 32,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
    },
    formOptions: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    forgotButton: {
      paddingVertical: 6,
      paddingLeft: 8,
    },
    forgotText: {
      color: c.primaryDark,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
    },
    errorBox: {
      backgroundColor: c.danger + '18',
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      color: c.danger,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    signInButton: {
      width: '100%',
      height: 52,
      borderRadius: 26,
      backgroundColor: c.primaryAction,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
      shadowColor: c.primaryDark,
      shadowOpacity: 0.18,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    signInButtonDisabled: {
      opacity: 0.65,
    },
    signInText: {
      color: c.onPrimaryAction,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    divider: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
      lineHeight: 16,
      fontWeight: '600',
    },
    socialButton: {
      width: '100%',
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    socialText: {
      color: c.text,
      fontSize: 14,
      fontWeight: '500',
    },
    securityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 24,
      paddingHorizontal: 6,
    },
    securityText: {
      color: c.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      flexShrink: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 32,
    },
    footerText: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    footerLink: {
      color: c.primaryDark,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      marginLeft: 5,
    },
  });

  const emailLabelActive = focusedField === 'email' || email.length > 0;
  const passwordLabelActive =
    focusedField === 'password' || password.length > 0;

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
            <View style={styles.header}>
              <View style={styles.brandIcon}>
                <MaterialCommunityIcons
                  name="credit-card-outline"
                  size={31}
                  color={c.onPrimaryAction}
                />
              </View>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>OnePass</Text>
              </View>
              <Text style={styles.heading}>Welcome Back, User</Text>
              <Text style={styles.subtitle}>
                Sign in to discover facilities and manage your OnePass access.
              </Text>
            </View>

            <View style={styles.card}>
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>
                    <MaterialCommunityIcons
                      name="alert-outline"
                      size={16}
                      color={c.danger}
                    />{' '}
                    {error}
                  </Text>
                </View>
              )}

              <View style={styles.form}>
                <View
                  style={[
                    styles.inputGroup,
                    focusedField === 'email' && styles.inputGroupFocused,
                  ]}
                >
                  <MaterialCommunityIcons
                    pointerEvents="none"
                    name="email-outline"
                    size={19}
                    color={
                      focusedField === 'email' ? c.primaryDark : c.textSecondary
                    }
                    style={{ position: 'absolute', left: 15, zIndex: 2 }}
                  />
                  <TextInput
                    style={[
                      styles.input,
                    ]}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setError(null);
                    }}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    placeholder=" "
                    accessibilityLabel="Email Address"
                    editable={!loading}
                    returnKeyType="next"
                  />
                  <Text
                    pointerEvents="none"
                    style={[
                      styles.floatingLabel,
                      emailLabelActive && styles.floatingLabelActive,
                    ]}
                  >
                    Email Address
                  </Text>
                </View>

                <View
                  style={[
                    styles.inputGroup,
                    focusedField === 'password' && styles.inputGroupFocused,
                  ]}
                >
                  <MaterialCommunityIcons
                    pointerEvents="none"
                    name="lock-outline"
                    size={19}
                    color={
                      focusedField === 'password'
                        ? c.primaryDark
                        : c.textSecondary
                    }
                    style={{ position: 'absolute', left: 15, zIndex: 2 }}
                  />
                  <TextInput
                    style={[
                      styles.input,
                    ]}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setError(null);
                    }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    placeholder=" "
                    accessibilityLabel="Password"
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleLogin()}
                  />
                  <Text
                    pointerEvents="none"
                    style={[
                      styles.floatingLabel,
                      passwordLabelActive && styles.floatingLabelActive,
                    ]}
                  >
                    Password
                  </Text>
                  <Pressable
                    style={styles.passwordToggle}
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
              </View>

              <View style={styles.formOptions}>
                <Pressable
                  style={styles.forgotButton}
                  onPress={() => navigation.navigate('ForgotPassword')}
                  accessibilityRole="button"
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.signInButton,
                  loading && styles.signInButtonDisabled,
                ]}
                onPress={() => void handleLogin()}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={c.onPrimaryAction} />
                ) : (
                  <>
                    <Text style={styles.signInText}>Sign In</Text>
                    <MaterialCommunityIcons
                      name="login"
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
                    <Text style={styles.socialText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.securityNote}>
                <MaterialCommunityIcons
                  name="shield-lock-outline"
                  size={16}
                  color={c.primaryDark}
                />
                <Text style={styles.securityText}>
                  Your information is protected with secure encryption.
                </Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <Pressable
                onPress={() => navigation.navigate('Register')}
                accessibilityRole="button"
              >
                <Text style={styles.footerLink}>Create Account</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
