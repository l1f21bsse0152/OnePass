import { afterEach, describe, expect, it, vi } from 'vitest';
import appConfig from '../app.config.js';

const configWithPlugins = () => ({
  scheme: undefined,
  plugins: ['expo-secure-store', ['expo-camera', { cameraPermission: 'Allow camera' }]],
});

describe('Expo app configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps Expo plugins and supplies the OnePass scheme by default', () => {
    const result = appConfig({ config: configWithPlugins() });

    expect(result.scheme).toBe('onepass');
    expect(result.plugins).toEqual(configWithPlugins().plugins);
  });

  it('adds Google sign-in configuration when an iOS URL scheme is provided', () => {
    vi.stubEnv(
      'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME',
      'com.googleusercontent.apps.test'
    );

    const result = appConfig({ config: { plugins: ['expo-secure-store'] } });

    expect(result.plugins).toEqual([
      'expo-secure-store',
      [
        '@react-native-google-signin/google-signin',
        { iosUrlScheme: 'com.googleusercontent.apps.test' },
      ],
    ]);
  });
});
