import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  useNavigation,
  type CompositeNavigationProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ScreenTexture from '../components/ScreenTexture';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { MainTabParamList } from '../navigation/MainTabParamList';
import type { ProfileStackParamList } from '../navigation/ProfileStackParamList';
import tileDepth from '../theme/tileDepth';
import { API_ORIGIN } from '../services/api';
import { uploadProfilePhoto } from '../services/onepass';

type ProfileNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>,
  BottomTabNavigationProp<MainTabParamList>
>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const { user, token, logout, refreshProfile } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const c = theme.colors;
  const [photoUploading, setPhotoUploading] = React.useState(false);

  const initials = (user?.fullName ?? 'OnePass')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const emailVerified = Boolean(user?.isEmailVerified);
  const profilePhotoUri = user?.profilePhotoUrl
    ? `${user.profilePhotoUrl.startsWith('http') ? '' : API_ORIGIN}${user.profilePhotoUrl}${user.profilePhotoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(user.updatedAt ?? '')}`
    : null;

  const chooseProfilePhoto = async () => {
    setPhotoUploading(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow access to your photo library to choose a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
      });
      if (result.canceled) return;

      const photo = result.assets[0];
      if (!photo) {
        Alert.alert('No photo selected', 'Choose an image and try again.');
        return;
      }

      const maxDimension = 1600;
      const resizeActions =
        photo.width > maxDimension
          ? [{ resize: { width: maxDimension } }]
          : photo.height > maxDimension
            ? [{ resize: { height: maxDimension } }]
            : [];
      const normalizedPhoto = await ImageManipulator.manipulateAsync(
        photo.uri,
        resizeActions,
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      await uploadProfilePhoto({
        uri: normalizedPhoto.uri,
      });
      await refreshProfile();
      Alert.alert('Profile picture updated', 'Your new picture is saved.');
    } catch (uploadError) {
      Alert.alert(
        'Unable to update profile picture',
        uploadError instanceof Error
          ? uploadError.message
          : 'Please choose another photo and try again.'
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    brandMark: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primaryDark,
      ...tileDepth,
    },
    brandName: { color: c.primaryDark, fontSize: 18, fontWeight: '900' },
    pageTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
    statusBanner: {
      minHeight: 43,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 14,
    },
    statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusText: { color: c.text, fontSize: 12, fontWeight: '700' },
    statusLabel: {
      color: emailVerified ? c.success : c.warning,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    accountTile: {
      padding: 15,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 14,
      ...tileDepth,
    },
    accountTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.border,
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarEditBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 23,
      height: 23,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primaryAction,
      borderWidth: 2,
      borderColor: c.surface,
    },
    initials: { color: c.primaryDark, fontSize: 20, fontWeight: '800' },
    accountCopy: { flex: 1, minWidth: 0 },
    accountName: { color: c.text, fontSize: 17, fontWeight: '800' },
    accountEmail: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
    accountMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 7,
      marginTop: 13,
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
    },
    metaText: {
      color: c.primaryDark,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    tileFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    tileFooterText: { color: c.primaryDark, fontSize: 12, fontWeight: '800' },
    sectionHeadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginHorizontal: 3,
      marginBottom: 10,
    },
    sectionTitle: { color: c.text, fontSize: 15, fontWeight: '900' },
    menuCard: {
      overflow: 'hidden',
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 21,
      ...tileDepth,
    },
    menuButton: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    menuIcon: {
      width: 41,
      height: 41,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    menuCopy: { flex: 1, minWidth: 0 },
    menuTitle: { color: c.text, fontSize: 13, fontWeight: '800' },
    menuSubtitle: {
      color: c.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 4,
    },
    divider: { height: 1, marginLeft: 67, backgroundColor: c.border },
    modeToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 3,
      borderRadius: 18,
      backgroundColor: c.surfaceSecondary,
    },
    modeButton: {
      width: 35,
      height: 31,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeButtonSelected: {
      backgroundColor: c.surface,
      ...tileDepth,
    },
    credentialCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 13,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 22,
      ...tileDepth,
    },
    credentialIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    credentialCopy: { flex: 1, minWidth: 0 },
    credentialLabel: {
      color: c.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    credentialValue: {
      color: c.primaryDark,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 5,
    },
    credentialNote: {
      color: c.textSecondary,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
    logoutButton: {
      minHeight: 53,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: c.danger + '55',
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 9,
      ...tileDepth,
    },
    logoutText: { color: c.danger, fontSize: 13, fontWeight: '900' },
    footer: { alignItems: 'center', marginTop: 17 },
    footerText: {
      color: c.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
  });

  const confirmLogout = () =>
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);

  const renderMenuItem = (
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'],
    title: string,
    subtitle: string,
    onPress: () => void
  ) => (
    <Pressable
      style={({ pressed }) => [
        styles.menuButton,
        pressed && { backgroundColor: c.surfaceSecondary },
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons name={icon} size={21} color={c.primaryDark} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={21}
        color={c.textSecondary}
      />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenTexture color={c.primary} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons name="infinity" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>OnePass</Text>
          </View>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>

        <View style={styles.statusBanner}>
          <View style={styles.statusLeft}>
            <MaterialCommunityIcons
              name={emailVerified ? 'cloud-check-outline' : 'email-alert-outline'}
              size={18}
              color={emailVerified ? c.success : c.warning}
            />
            <Text style={styles.statusText}>
              {emailVerified ? 'Your account is up to date' : 'Verify your account email'}
            </Text>
          </View>
          <Text style={styles.statusLabel}>
            {emailVerified ? 'VERIFIED' : 'ACTION NEEDED'}
          </Text>
        </View>

        <View style={styles.accountTile}>
          <View style={styles.accountTop}>
            <Pressable
              style={styles.avatar}
              onPress={() => void chooseProfilePhoto()}
              disabled={photoUploading}
              accessibilityRole="button"
              accessibilityLabel="Change profile picture"
            >
              {profilePhotoUri ? (
                <Image
                  source={{
                    uri: profilePhotoUri,
                    headers: token
                      ? { Authorization: `Bearer ${token}` }
                      : undefined,
                  }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.initials}>{initials}</Text>
              )}
              <View style={styles.avatarEditBadge}>
                {photoUploading ? (
                  <ActivityIndicator size="small" color={c.onPrimaryAction} />
                ) : (
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={12}
                    color={c.onPrimaryAction}
                  />
                )}
              </View>
            </Pressable>
            <Pressable
              style={styles.accountCopy}
              onPress={() => navigation.navigate('AccountDetails')}
              accessibilityRole="button"
              accessibilityLabel="View and update account details"
            >
              <Text style={styles.accountName} numberOfLines={1}>
                {user?.fullName ?? 'OnePass user'}
              </Text>
              <Text style={styles.accountEmail} numberOfLines={1}>
                {user?.email ?? '—'}
              </Text>
              <View style={styles.accountMetaRow}>
                <View style={styles.metaPill}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={13}
                    color={c.primaryDark}
                  />
                  <Text style={styles.metaText}>User</Text>
                </View>
                <View style={styles.metaPill}>
                  <MaterialCommunityIcons
                    name={emailVerified ? 'check-circle-outline' : 'email-outline'}
                    size={13}
                    color={c.primaryDark}
                  />
                  <Text style={styles.metaText}>
                    {emailVerified ? 'Email verified' : 'Email pending'}
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>
          <Pressable
            style={styles.tileFooter}
            onPress={() => navigation.navigate('AccountDetails')}
            accessibilityRole="button"
            accessibilityLabel="View all account details"
          >
            <Text style={styles.tileFooterText}>View all account details</Text>
            <MaterialCommunityIcons
              name="arrow-top-right"
              size={17}
              color={c.primaryDark}
            />
          </Pressable>
        </View>

        <View style={styles.sectionHeadingRow}>
          <MaterialCommunityIcons
            name="tune-variant"
            size={18}
            color={c.primaryDark}
          />
          <Text style={styles.sectionTitle}>Account &amp; Preferences</Text>
        </View>
        <View style={styles.menuCard}>
          {renderMenuItem(
            'account-edit-outline',
            'Personal information',
            'Manage name, contact, and emergency details',
            () => navigation.navigate('AccountDetails')
          )}
          <View style={styles.divider} />
          <View style={styles.menuButton}>
            <View style={styles.menuIcon}>
              <MaterialCommunityIcons
                name={isDark ? 'weather-night' : 'white-balance-sunny'}
                size={21}
                color={c.primaryDark}
              />
            </View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>App appearance</Text>
              <Text style={styles.menuSubtitle}>
                Choose light or dark mode
              </Text>
            </View>
            <View style={styles.modeToggle}>
              <Pressable
                style={[
                  styles.modeButton,
                  !isDark && styles.modeButtonSelected,
                ]}
                onPress={() => isDark && toggleTheme()}
                accessibilityRole="button"
                accessibilityLabel="Light appearance"
                accessibilityState={{ selected: !isDark }}
              >
                <MaterialCommunityIcons
                  name="white-balance-sunny"
                  size={16}
                  color={!isDark ? c.primaryDark : c.textSecondary}
                />
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  isDark && styles.modeButtonSelected,
                ]}
                onPress={() => !isDark && toggleTheme()}
                accessibilityRole="button"
                accessibilityLabel="Dark appearance"
                accessibilityState={{ selected: isDark }}
              >
                <MaterialCommunityIcons
                  name="weather-night"
                  size={16}
                  color={isDark ? c.primaryDark : c.textSecondary}
                />
              </Pressable>
            </View>
          </View>
          <View style={styles.divider} />
          {renderMenuItem(
            'lock-reset',
            'Security & password',
            'Update your password with email verification',
            () => navigation.navigate('UpdatePassword')
          )}
          <View style={styles.divider} />
          {renderMenuItem(
            'robot-outline',
            'OnePass Assistant',
            'Get help with passes, points, and facilities',
            () => navigation.navigate('Assistant')
          )}
        </View>

        <View style={styles.sectionHeadingRow}>
          <MaterialCommunityIcons
            name="shield-account-outline"
            size={18}
            color={c.primaryDark}
          />
          <Text style={styles.sectionTitle}>Credentials &amp; Data</Text>
        </View>
        <View style={styles.credentialCard}>
          <View style={styles.credentialIcon}>
            <MaterialCommunityIcons
              name="fingerprint"
              size={21}
              color={c.primaryDark}
            />
          </View>
          <View style={styles.credentialCopy}>
            <Text style={styles.credentialLabel}>OnePass account ID</Text>
            <Text style={styles.credentialValue} numberOfLines={1}>
              {user?.id ?? '—'}
            </Text>
            <Text style={styles.credentialNote}>
              Your account identifier is managed by OnePass.
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && { opacity: 0.82 },
          ]}
          onPress={confirmLogout}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="logout" size={18} color={c.danger} />
          <Text style={styles.logoutText}>Sign out of OnePass</Text>
        </Pressable>
        <View style={styles.footer}>
          <Text style={styles.footerText}>ONEPASS · ACCOUNT SETTINGS</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
