import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import type { AuthStackParamList } from '../navigation/AuthNavigator';

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
let googleSignInConfigured = false;

type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;

export function useGoogleSignIn(onError: (message: string) => void) {
  const navigation = useNavigation<AuthNavigation>();
  const { googleSignIn } = useAuth();
  const [loading, setLoading] = useState(false);

  const startGoogleSignIn = useCallback(async () => {
    onError('');

    if (Platform.OS === 'web') {
      onError('Google sign-in is available in the iOS and Android apps.');
      return;
    }

    if (Constants.appOwnership === AppOwnership.Expo) {
      onError(
        'Google sign-in requires an Expo development build and cannot run in Expo Go.'
      );
      return;
    }

    if (!GOOGLE_WEB_CLIENT_ID) {
      onError(
        'Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env.'
      );
      return;
    }

    try {
      setLoading(true);
      const { GoogleSignin } = await import(
        '@react-native-google-signin/google-signin'
      );

      if (!googleSignInConfigured) {
        GoogleSignin.configure({
          ...(GOOGLE_WEB_CLIENT_ID
            ? { webClientId: GOOGLE_WEB_CLIENT_ID }
            : {}),
          ...(GOOGLE_IOS_CLIENT_ID
            ? { iosClientId: GOOGLE_IOS_CLIENT_ID }
            : {}),
        });
        googleSignInConfigured = true;
      }

      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (response.type !== 'success') {
        return;
      }

      const idToken = response.data.idToken;

      if (!idToken) {
        throw new Error(
          'Google did not return an ID token. Check the Web Client ID configuration.'
        );
      }

      const result = await googleSignIn(idToken);

      if (result.requiresOtp) {
        navigation.navigate('VerifyOTP', {
          email: result.email,
          purpose: 'registration',
          provider: 'google',
        });
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Unable to sign in with Google. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [googleSignIn, navigation, onError]);

  return { googleLoading: loading, startGoogleSignIn };
}
