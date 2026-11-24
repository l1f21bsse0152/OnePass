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
import tileDepth from '../theme/tileDepth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { ProfileStackParamList } from '../navigation/ProfileStackParamList';
import { updateProfile } from '../services/onepass';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export default function AccountDetailsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileStackParamList, 'AccountDetails'>>();
  const { user, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const c = theme.colors;

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [country, setCountry] = useState(user?.country ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [bloodGroup, setBloodGroup] = useState(user?.bloodGroup ?? '');
  const [emergencyContactName, setEmergencyContactName] = useState(
    user?.emergencyContact?.name ?? ''
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    user?.emergencyContact?.phoneNumber ?? ''
  );
  const [emergencyContactRelationship, setEmergencyContactRelationship] =
    useState(user?.emergencyContact?.relationship ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setPhoneNumber(user?.phoneNumber ?? '');
    setCity(user?.city ?? '');
    setCountry(user?.country ?? '');
    setDateOfBirth(user?.dateOfBirth ?? '');
    setBloodGroup(user?.bloodGroup ?? '');
    setEmergencyContactName(user?.emergencyContact?.name ?? '');
    setEmergencyContactPhone(user?.emergencyContact?.phoneNumber ?? '');
    setEmergencyContactRelationship(
      user?.emergencyContact?.relationship ?? ''
    );
  }, [user]);

  const handleSaveProfile = async () => {
    const normalizedName = fullName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setError('Name must contain between 2 and 80 characters.');
      return;
    }

    const normalizedPhone = phoneNumber.trim();
    const normalizedEmergencyPhone = emergencyContactPhone.trim();
    const normalizedDob = dateOfBirth.trim();
    const phonePattern = /^\+?[0-9()\-\s]{7,25}$/;

    if (
      normalizedPhone &&
      (!phonePattern.test(normalizedPhone) ||
        normalizedPhone.replace(/\D/g, '').length < 7 ||
        normalizedPhone.replace(/\D/g, '').length > 15)
    ) {
      setError('Enter a valid phone number.');
      return;
    }

    if (city.trim().length > 80 || country.trim().length > 80) {
      setError('City and country must be 80 characters or fewer.');
      return;
    }

    if (normalizedDob) {
      const parsedDate = new Date(`${normalizedDob}T00:00:00.000Z`);
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDob) ||
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== normalizedDob ||
        parsedDate > today
      ) {
        setError('Enter a valid date of birth in YYYY-MM-DD format.');
        return;
      }
    }

    const normalizedEmergencyName = emergencyContactName.trim();
    const hasEmergencyContact = Boolean(
      normalizedEmergencyName ||
        normalizedEmergencyPhone ||
        emergencyContactRelationship.trim()
    );

    if (
      hasEmergencyContact &&
      (!normalizedEmergencyName || !normalizedEmergencyPhone)
    ) {
      setError('Emergency contact name and phone number are required.');
      return;
    }

    if (
      normalizedEmergencyName.length > 80 ||
      emergencyContactRelationship.trim().length > 40
    ) {
      setError('Emergency contact details exceed the allowed length.');
      return;
    }

    if (
      normalizedEmergencyPhone &&
      (!phonePattern.test(normalizedEmergencyPhone) ||
        normalizedEmergencyPhone.replace(/\D/g, '').length < 7 ||
        normalizedEmergencyPhone.replace(/\D/g, '').length > 15)
    ) {
      setError('Enter a valid emergency contact phone number.');
      return;
    }

    setError(null);
    setSavingProfile(true);
    try {
      await updateProfile({
        fullName: normalizedName,
        phoneNumber: normalizedPhone || null,
        city: city.trim() || null,
        country: country.trim() || null,
        dateOfBirth: normalizedDob || null,
        bloodGroup: bloodGroup || null,
        emergencyContact: hasEmergencyContact
          ? {
              name: normalizedEmergencyName,
              phoneNumber: normalizedEmergencyPhone,
              relationship: emergencyContactRelationship.trim(),
            }
          : null,
      });
      await refreshProfile();
      Alert.alert('Profile updated', 'Your profile details have been saved.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update your profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 24, paddingBottom: 40 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
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
    title: { color: c.text, fontSize: 25, fontWeight: '800' },
    subtitle: {
      color: c.textSecondary,
      fontSize: 15,
      marginTop: 6,
      marginBottom: 24,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginBottom: 18,
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...tileDepth,
    },
    avatar: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarInitials: {
      color: c.primaryDark,
      fontSize: 24,
      fontWeight: '800',
    },
    profileHeaderInfo: {
      flex: 1,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      marginBottom: 18,
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    cardTitle: {
      color: c.text,
      fontSize: 19,
      fontWeight: '800',
      marginBottom: 16,
    },
    label: {
      color: c.textSecondary,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 7,
    },
    value: { color: c.text, fontSize: 16, marginBottom: 18 },
    input: {
      minHeight: 48,
      color: c.text,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 11,
      paddingHorizontal: 13,
      marginBottom: 15,
    },
    button: {
      minHeight: 48,
      borderRadius: 11,
      backgroundColor: c.primaryAction,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      shadowColor: c.primaryDark,
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: {
      color: c.onPrimaryAction,
      fontSize: 15,
      fontWeight: '800',
    },
    error: {
      color: c.danger,
      backgroundColor: c.danger + '18',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
      lineHeight: 20,
    },
    bloodGroupOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    bloodGroupOption: {
      minWidth: 48,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    bloodGroupOptionSelected: {
      backgroundColor: c.primarySoft,
      borderColor: c.primaryDark,
    },
    bloodGroupOptionText: {
      color: c.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    bloodGroupOptionTextSelected: { color: c.primaryDark },
    bloodGroupNote: {
      color: c.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      marginBottom: 16,
    },
  });

  const initials = (user?.fullName ?? 'OnePass')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

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
            <Text style={styles.title}>Account details</Text>
          </View>
          <Text style={styles.subtitle}>
            Review and update the details linked to your OnePass account.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            <View style={styles.profileHeaderInfo}>
              <Text style={styles.cardTitle}>{user?.fullName ?? 'OnePass user'}</Text>
              <Text style={styles.label}>{user?.email ?? ''}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account details</Text>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                setError(null);
              }}
              autoCapitalize="words"
              maxLength={80}
              placeholder="Your full name"
              placeholderTextColor={c.textSecondary}
            />
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email ?? '—'}</Text>
            <Text style={styles.label}>Email status</Text>
            <Text style={styles.value}>
              {user?.isEmailVerified ? 'Verified' : 'Not verified'}
            </Text>
            <Text style={styles.label}>Account type</Text>
            <Text style={styles.value}>User</Text>
            <Text style={styles.label}>Member since</Text>
            <Text style={styles.value}>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : '—'}
            </Text>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="e.g. +1 555 123 4567"
              placeholderTextColor={c.textSecondary}
              keyboardType="phone-pad"
              maxLength={25}
            />
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Your city"
              placeholderTextColor={c.textSecondary}
              maxLength={80}
            />
            <Text style={styles.label}>Blood group (optional)</Text>
            <View style={styles.bloodGroupOptions}>
              <Pressable
                style={[
                  styles.bloodGroupOption,
                  !bloodGroup && styles.bloodGroupOptionSelected,
                ]}
                onPress={() => setBloodGroup('')}
                accessibilityRole="button"
                accessibilityState={{ selected: !bloodGroup }}
              >
                <Text
                  style={[
                    styles.bloodGroupOptionText,
                    !bloodGroup && styles.bloodGroupOptionTextSelected,
                  ]}
                >
                  Not set
                </Text>
              </Pressable>
              {bloodGroups.map((group) => (
                <Pressable
                  key={group}
                  style={[
                    styles.bloodGroupOption,
                    bloodGroup === group && styles.bloodGroupOptionSelected,
                  ]}
                  onPress={() => setBloodGroup(group)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: bloodGroup === group }}
                >
                  <Text
                    style={[
                      styles.bloodGroupOptionText,
                      bloodGroup === group &&
                        styles.bloodGroupOptionTextSelected,
                    ]}
                  >
                    {group}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.bloodGroupNote}>
              This is optional profile information and is not medical verification.
            </Text>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="Your country"
              placeholderTextColor={c.textSecondary}
              maxLength={80}
            />
            <Text style={styles.label}>Date of birth</Text>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textSecondary}
              maxLength={10}
            />
            <Text style={styles.cardTitle}>Emergency contact</Text>
            <Text style={styles.label}>Contact name</Text>
            <TextInput
              style={styles.input}
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
              placeholder="Full name"
              placeholderTextColor={c.textSecondary}
              maxLength={80}
            />
            <Text style={styles.label}>Contact phone</Text>
            <TextInput
              style={styles.input}
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              placeholder="Phone number"
              placeholderTextColor={c.textSecondary}
              keyboardType="phone-pad"
              maxLength={25}
            />
            <Text style={styles.label}>Relationship</Text>
            <TextInput
              style={styles.input}
              value={emergencyContactRelationship}
              onChangeText={setEmergencyContactRelationship}
              placeholder="e.g. Parent, partner, friend"
              placeholderTextColor={c.textSecondary}
              maxLength={40}
            />
            <Pressable
              style={[
                styles.button,
                savingProfile && styles.buttonDisabled,
              ]}
              onPress={() => void handleSaveProfile()}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="content-save-outline"
                    size={18}
                    color={c.onPrimaryAction}
                  />
                  <Text style={styles.buttonText}>Save profile</Text>
                </>
              )}
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
