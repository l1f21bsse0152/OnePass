const googleSignInPlugin = '@react-native-google-signin/google-signin';

module.exports = ({ config }) => {
  const plugins = (config.plugins || []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== googleSignInPlugin;
  });
  const googleIosUrlScheme =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

  if (googleIosUrlScheme) {
    plugins.push([
      googleSignInPlugin,
      { iosUrlScheme: googleIosUrlScheme },
    ]);
  }

  return {
    ...config,
    scheme: config.scheme || 'onepass',
    android: {
      ...config.android,
      ...(process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME
        ? { package: process.env.EXPO_PUBLIC_ANDROID_PACKAGE_NAME }
        : {}),
    },
    ios: {
      ...config.ios,
      ...(process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER
        ? { bundleIdentifier: process.env.EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER }
        : {}),
    },
    plugins,
  };
};
