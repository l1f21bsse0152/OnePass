import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DeviceMotion } from 'expo-sensors';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import ScreenTexture from '../components/ScreenTexture';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { WalletStackParamList } from '../navigation/WalletStackParamList';
import { API_ORIGIN } from '../services/api';
import {
  CARD_DESIGN_STORAGE_KEY,
  cardSkins,
  createMemberNumber,
  getCardAccent,
  getCardSkin,
  parseCardDesign,
  serializeCardDesign,
  type CardAccentId,
  type CardSkinId,
} from '../theme/cardDesign';
import tileDepth from '../theme/tileDepth';

type CardDesignNavigation = NativeStackNavigationProp<
  WalletStackParamList,
  'CardDesign'
>;

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

const skinIconById: Record<
  CardSkinId,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  year: 'diamond-stone',
  christmas: 'snowflake',
  valentine: 'heart',
  summer: 'white-balance-sunny',
};

const cardBubbles = [
  { left: 4, top: 7, size: 12 },
  { left: 17, top: 4, size: 18 },
  { left: 34, top: 9, size: 10 },
  { left: 51, top: 5, size: 15 },
  { left: 69, top: 8, size: 11 },
  { left: 84, top: 4, size: 17 },
  { left: 10, top: 23, size: 17 },
  { left: 27, top: 20, size: 10 },
  { left: 44, top: 25, size: 14 },
  { left: 61, top: 21, size: 18 },
  { left: 79, top: 24, size: 11 },
  { left: 92, top: 20, size: 13 },
  { left: 3, top: 41, size: 16 },
  { left: 21, top: 39, size: 11 },
  { left: 38, top: 44, size: 18 },
  { left: 56, top: 40, size: 10 },
  { left: 73, top: 43, size: 15 },
  { left: 89, top: 39, size: 12 },
  { left: 11, top: 60, size: 11 },
  { left: 29, top: 57, size: 17 },
  { left: 46, top: 62, size: 12 },
  { left: 63, top: 58, size: 15 },
  { left: 80, top: 61, size: 10 },
  { left: 93, top: 57, size: 16 },
  { left: 4, top: 79, size: 14 },
  { left: 22, top: 76, size: 10 },
  { left: 39, top: 81, size: 16 },
  { left: 57, top: 77, size: 11 },
  { left: 74, top: 80, size: 18 },
  { left: 90, top: 76, size: 12 },
];

export default function CardDesignScreen() {
  const navigation = useNavigation<CardDesignNavigation>();
  const { user, token } = useAuth();
  const { theme } = useTheme();
  const c = theme.colors;
  const [selectedSkin, setSelectedSkin] = useState<CardSkinId>('year');
  const [selectedAccent, setSelectedAccent] = useState<CardAccentId>('gold');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [motionAvailable, setMotionAvailable] = useState<boolean | null>(null);
  const [isApplied, setIsApplied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragging = useRef(false);
  const flipAngle = useRef(new Animated.Value(0)).current;
  const motionBaseline = useRef<{ beta: number; gamma: number } | null>(null);

  const skin = getCardSkin(selectedSkin);
  const accent = getCardAccent(selectedAccent);
  const memberNumber = createMemberNumber(user?.id);
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : 'Not set';
  const profilePhotoUri = user?.profilePhotoUrl
    ? `${user.profilePhotoUrl.startsWith('http') ? '' : API_ORIGIN}${user.profilePhotoUrl}${user.profilePhotoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(user.updatedAt ?? '')}`
    : null;
  const initials =
    user?.fullName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'OP';

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(CARD_DESIGN_STORAGE_KEY)
      .then((storedDesign) => {
        if (!active || !storedDesign) return;
        const design = parseCardDesign(storedDesign);
        setSelectedSkin(design.skinId);
        setSelectedAccent(design.accentId);
      })
      .catch((storageError: unknown) => {
        if (active) {
          setError(
            storageError instanceof Error
              ? storageError.message
              : 'Unable to load your saved card design.'
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let subscription: ReturnType<typeof DeviceMotion.addListener> | null = null;

    DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (!active) return;
        setMotionAvailable(available);
        if (!available) return;

        DeviceMotion.setUpdateInterval(80);
        subscription = DeviceMotion.addListener(({ rotation }) => {
          if (dragging.current) return;
          if (!motionBaseline.current) {
            motionBaseline.current = {
              beta: rotation.beta,
              gamma: rotation.gamma,
            };
            return;
          }
          const deltaBeta = rotation.beta - motionBaseline.current.beta;
          const deltaGamma = rotation.gamma - motionBaseline.current.gamma;
          setTilt({
            x: clamp(-deltaBeta * 0.8, 24),
            y: clamp(deltaGamma * 0.8, 24),
          });
        });
      })
      .catch(() => {
        if (active) setMotionAvailable(false);
      });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 3,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          dragging.current = true;
        },
        onPanResponderMove: (_, gesture) => {
          setTilt({
            x: clamp(-gesture.dy * 0.55, 24),
            y: clamp(gesture.dx * 0.55, 24),
          });
        },
        onPanResponderRelease: () => {
          dragging.current = false;
          setTilt({ x: 0, y: 0 });
        },
        onPanResponderTerminate: () => {
          dragging.current = false;
          setTilt({ x: 0, y: 0 });
        },
      }),
    []
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 8,
      gap: 12,
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
    headerTitle: { color: c.text, fontSize: 17, fontWeight: '800' },
    content: { paddingHorizontal: 18, paddingBottom: 30 },
    eyebrow: {
      color: c.success,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginTop: 10,
    },
    title: { color: c.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
    subtitle: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
      marginBottom: 16,
    },
    previewPanel: {
      padding: 14,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 18,
      ...tileDepth,
    },
    previewTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    activeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 15,
      backgroundColor: c.successSoft,
    },
    activeBadgeText: {
      color: c.success,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    motionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 15,
      backgroundColor: c.surfaceSecondary,
    },
    motionText: { color: c.textSecondary, fontSize: 10, fontWeight: '700' },
    cardStage: {
      paddingVertical: 16,
      paddingHorizontal: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      width: '100%',
      aspectRatio: 1.586,
      maxHeight: 245,
      borderRadius: 20,
    },
    cardFace: {
      ...StyleSheet.absoluteFill,
      borderRadius: 20,
      overflow: 'hidden',
      padding: 14,
      borderWidth: 1,
      justifyContent: 'space-between',
    },
    cardBack: {
      transform: [{ rotateY: '180deg' }],
      justifyContent: 'flex-start',
      gap: 8,
    },
    cardAccentLine: {
      height: 3,
      position: 'absolute',
      top: 0,
      left: 18,
      right: 18,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
    },
    cardTexture: {
      ...StyleSheet.absoluteFill,
      overflow: 'hidden',
    },
    textureBubble: {
      position: 'absolute',
      borderRadius: 999,
      borderWidth: 1,
      opacity: 0.72,
    },
    textureBubbleHighlight: {
      position: 'absolute',
      left: '22%',
      top: '16%',
      width: '27%',
      height: '24%',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.42)',
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    brandIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    cardBrandLabel: {
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
      opacity: 0.78,
    },
    cardSkinName: { fontSize: 12, fontWeight: '900', marginTop: 2 },
    chip: {
      width: 29,
      height: 22,
      borderRadius: 5,
      backgroundColor: '#E8C66A',
      borderWidth: 1,
      borderColor: '#FFE7A0',
    },
    cardMiddle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 15,
    },
    cardNumber: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 2.3,
    },
    contactlessIcon: { opacity: 0.85 },
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.22)',
      paddingTop: 10,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitials: { fontSize: 12, fontWeight: '900' },
    holderLabel: { fontSize: 8, fontWeight: '700', opacity: 0.72 },
    holderName: { fontSize: 12, fontWeight: '800', marginTop: 2 },
    cardBackTitle: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.3,
      opacity: 0.75,
    },
    cardDataGrid: { flex: 1, justifyContent: 'center', gap: 8 },
    cardDataRow: { flexDirection: 'row', gap: 12 },
    cardDataItem: { flex: 1, minWidth: 0 },
    cardDataItemWide: { flex: 1 },
    cardDataLabel: {
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 0.8,
      opacity: 0.68,
      textTransform: 'uppercase',
    },
    cardDataValue: { fontSize: 10, fontWeight: '800', marginTop: 2 },
    cardBackNote: { fontSize: 8, lineHeight: 11, opacity: 0.75, flex: 1 },
    cardBackFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.22)',
      paddingTop: 10,
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 9,
      marginTop: 12,
    },
    controlButton: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 13,
      borderRadius: 20,
      backgroundColor: c.surfaceSecondary,
    },
    controlText: { color: c.text, fontSize: 11, fontWeight: '800' },
    sectionHeading: {
      color: c.text,
      fontSize: 16,
      fontWeight: '900',
    },
    sectionSubheading: {
      color: c.textSecondary,
      fontSize: 11,
      marginTop: 3,
      marginBottom: 10,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionMeta: { color: c.primaryDark, fontSize: 10, fontWeight: '800' },
    skinGrid: { gap: 10, marginBottom: 16 },
    skinRow: { flexDirection: 'row', gap: 10 },
    skinButton: {
      flex: 1,
      padding: 9,
      gap: 8,
      borderRadius: 15,
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.border,
    },
    skinSwatch: {
      width: '100%',
      height: 58,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      overflow: 'hidden',
    },
    skinSwatchStripe: {
      position: 'absolute',
      top: 0,
      left: 8,
      right: 8,
      height: 3,
    },
    skinSwatchLabel: {
      position: 'absolute',
      left: 8,
      bottom: 7,
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    skinCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
    skinText: { flex: 1 },
    skinName: { color: c.text, fontSize: 12, fontWeight: '800' },
    skinDescription: { color: c.textSecondary, fontSize: 10, marginTop: 3 },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 7,
      marginTop: 12,
    },
    paginationDot: { height: 7, width: 7, borderRadius: 4, backgroundColor: c.border },
    paginationDotSelected: { width: 22, backgroundColor: c.primaryAction },
    featurePanel: {
      padding: 12,
      borderRadius: 16,
      backgroundColor: c.surfaceSecondary,
      marginTop: 18,
    },
    featureHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    featureGrid: { flexDirection: 'row', gap: 8 },
    featureItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 10,
      paddingHorizontal: 3,
      borderRadius: 11,
      backgroundColor: c.surface,
    },
    featureLabel: { color: c.text, fontSize: 9, fontWeight: '800', textAlign: 'center' },
    featureValue: { color: c.textSecondary, fontSize: 8, textAlign: 'center' },
    error: {
      color: c.danger,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 12,
    },
    applyButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      borderRadius: 16,
      backgroundColor: c.primaryAction,
      paddingHorizontal: 16,
    },
    applyButtonDisabled: { opacity: 0.65 },
    applyText: { color: c.onPrimaryAction, fontSize: 13, fontWeight: '900' },
    savedNote: {
      color: c.textSecondary,
      fontSize: 10,
      textAlign: 'center',
      marginTop: 8,
    },
  });

  const flipCard = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    const showBack = !isFlipped;
    const midpoint = showBack ? 90 : 270;
    const destination = showBack ? 180 : 360;

    Animated.timing(flipAngle, {
      toValue: midpoint,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        setIsFlipping(false);
        return;
      }
      setIsFlipped(showBack);
      Animated.timing(flipAngle, {
        toValue: destination,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished: completed }) => {
        if (!completed) return;
        if (!showBack) flipAngle.setValue(0);
        setIsFlipping(false);
      });
    });
  };
  const applyDesign = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await SecureStore.setItemAsync(
        CARD_DESIGN_STORAGE_KEY,
        serializeCardDesign({ skinId: selectedSkin, accentId: selectedAccent })
      );
      setIsApplied(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save this card design.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderCardTexture = () => (
    <View style={styles.cardTexture} pointerEvents="none">
      {cardBubbles.map((bubble, index) => (
        <View
          key={`${bubble.left}-${bubble.top}-${index}`}
          style={[
            styles.textureBubble,
            {
              left: `${bubble.left}%`,
              top: `${bubble.top}%`,
              width: bubble.size,
              height: bubble.size,
              borderColor: `${accent.color}66`,
              backgroundColor: `${accent.color}20`,
            },
          ]}
        >
          <View style={styles.textureBubbleHighlight} />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenTexture color={c.primary} />
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to wallet"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={21}
            color={c.text}
          />
        </Pressable>
        <Text style={styles.headerTitle}>OnePass Wallet</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MEMBER CARD</Text>
        <Text style={styles.title}>VIP Pass Skins</Text>
        <Text style={styles.subtitle}>
          Choose an edition and make your OnePass card your own.
        </Text>

        <View style={styles.previewPanel}>
          <View style={styles.previewTop}>
            <View style={styles.activeBadge}>
              <MaterialCommunityIcons
                name="check-circle"
                size={13}
                color={c.success}
              />
              <Text style={styles.activeBadgeText}>{skin.name}</Text>
            </View>
            <View style={styles.motionPill}>
              <MaterialCommunityIcons
                name={motionAvailable ? 'motion' : 'gesture-swipe'}
                size={14}
                color={c.primaryDark}
              />
              <Text style={styles.motionText}>
                {motionAvailable === null
                  ? 'Starting motion'
                  : motionAvailable
                    ? 'Move phone or drag'
                    : 'Drag to tilt'}
              </Text>
            </View>
          </View>

          <View style={styles.cardStage} {...panResponder.panHandlers}>
            <Animated.View
              style={[
                styles.card,
                { shadowColor: accent.color, shadowOpacity: 0.32, shadowRadius: 16, elevation: 8 },
                {
                  transform: [
                    { perspective: 900 },
                    { rotateX: `${tilt.x}deg` },
                    {
                      rotateY: flipAngle.interpolate({
                        inputRange: [0, 360],
                        outputRange: [`${tilt.y}deg`, `${360 + tilt.y}deg`],
                      }),
                    },
                  ],
                },
              ]}
            >
              {!isFlipped && (
              <View
                style={[
                  styles.cardFace,
                  {
                    backgroundColor: skin.color,
                    borderColor: `${accent.color}99`,
                  },
                ]}
              >
                {renderCardTexture()}
                <View
                  style={[styles.cardAccentLine, { backgroundColor: accent.color }]}
                />
                <View style={styles.cardTop}>
                  <View style={styles.brand}>
                    <View style={styles.brandIcon}>
                      <MaterialCommunityIcons
                        name="layers-triple"
                        size={18}
                        color={accent.color}
                      />
                    </View>
                    <View>
                      <Text style={[styles.cardBrandLabel, { color: skin.textColor }]}>
                        ONEPASS MEMBER
                      </Text>
                      <Text style={[styles.cardSkinName, { color: skin.textColor }]}>
                        {skin.name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.chip} />
                </View>
                <View style={styles.cardMiddle}>
                  <Text style={[styles.cardNumber, { color: skin.textColor }]}>
                    MEMBER CARD
                  </Text>
                  <MaterialCommunityIcons
                    name="contactless-payment"
                    size={21}
                    color={skin.textColor}
                    style={styles.contactlessIcon}
                  />
                </View>
                <View style={styles.cardBottom}>
                  <View style={[styles.avatar, { borderColor: accent.color }]}>
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
                      <Text style={[styles.avatarInitials, { color: skin.textColor }]}>
                        {initials}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.holderLabel, { color: skin.textColor }]}>
                      CARDHOLDER
                    </Text>
                    <Text
                      style={[styles.holderName, { color: skin.textColor }]}
                      numberOfLines={1}
                    >
                      {user?.fullName || 'OnePass Member'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="infinity"
                    size={23}
                    color={accent.color}
                  />
                </View>
              </View>
              )}
              {isFlipped && (
              <View
                style={[
                  styles.cardFace,
                  styles.cardBack,
                  {
                    backgroundColor: skin.color,
                    borderColor: `${accent.color}99`,
                  },
                ]}
              >
                {renderCardTexture()}
                <Text style={[styles.cardBackTitle, { color: skin.textColor }]}>
                  ONEPASS MEMBER PROFILE
                </Text>
                <View style={styles.cardDataGrid}>
                  <View style={styles.cardDataRow}>
                    <View style={[styles.cardDataItem, styles.cardDataItemWide]}>
                      <Text style={[styles.cardDataLabel, { color: skin.textColor }]}>
                        Full name
                      </Text>
                      <Text
                        style={[styles.cardDataValue, { color: skin.textColor }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {user?.fullName || 'Not set'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardDataRow}>
                    <View style={styles.cardDataItem}>
                      <Text style={[styles.cardDataLabel, { color: skin.textColor }]}>
                        City
                      </Text>
                      <Text
                        style={[styles.cardDataValue, { color: skin.textColor }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {user?.city || 'Not set'}
                      </Text>
                    </View>
                    <View style={styles.cardDataItem}>
                      <Text style={[styles.cardDataLabel, { color: skin.textColor }]}>
                        Member since
                      </Text>
                      <Text style={[styles.cardDataValue, { color: skin.textColor }]} numberOfLines={1} adjustsFontSizeToFit>
                        {memberSince}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardDataRow}>
                    <View style={styles.cardDataItem}>
                      <Text style={[styles.cardDataLabel, { color: skin.textColor }]}>
                        Card number
                      </Text>
                      <Text style={[styles.cardDataValue, { color: skin.textColor }]} numberOfLines={1} adjustsFontSizeToFit>
                        {memberNumber}
                      </Text>
                    </View>
                    <View style={styles.cardDataItem}>
                      <Text style={[styles.cardDataLabel, { color: skin.textColor }]}>
                        Blood group
                      </Text>
                      <Text style={[styles.cardDataValue, { color: skin.textColor }]}>
                        {user?.bloodGroup || 'Not set'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.cardBackFooter}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={17}
                    color={accent.color}
                  />
                  <Text style={[styles.cardBackNote, { color: skin.textColor }]}>
                    Member ID only — not a payment card number.
                  </Text>
                </View>
              </View>
              )}
            </Animated.View>
          </View>

          <View style={styles.controls}>
            <Pressable
              style={styles.controlButton}
              onPress={flipCard}
              disabled={isFlipping}
              accessibilityRole="button"
              accessibilityLabel={isFlipped ? 'Show front of card' : 'Flip card'}
            >
              <MaterialCommunityIcons
                name="rotate-3d-variant"
                size={16}
                color={c.primaryDark}
              />
              <Text style={styles.controlText}>
                {isFlipped ? 'Show front' : 'Flip card'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.pagination}>
            {cardSkins.map((item) => (
              <Pressable
                key={item.id}
                style={[
                  styles.paginationDot,
                  selectedSkin === item.id && styles.paginationDotSelected,
                ]}
                onPress={() => {
                  setSelectedSkin(item.id);
                  setIsApplied(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${item.name} edition`}
                accessibilityState={{ selected: selectedSkin === item.id }}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeading}>Select edition</Text>
          <Text style={styles.sectionMeta}>4 editions</Text>
        </View>
        <View style={styles.skinGrid}>
          {[cardSkins.slice(0, 2), cardSkins.slice(2)].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.skinRow}>
              {row.map((item) => {
                const selected = selectedSkin === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.skinButton,
                      selected && { borderColor: c.primaryAction },
                    ]}
                    onPress={() => {
                      setSelectedSkin(item.id);
                      setIsApplied(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.skinSwatch, { backgroundColor: item.color }]}>
                      <View
                        style={[
                          styles.skinSwatchStripe,
                          { backgroundColor: item.accent },
                        ]}
                      />
                      <Text style={styles.skinSwatchLabel}>ONEPASS</Text>
                      <MaterialCommunityIcons
                        name={skinIconById[item.id]}
                        size={18}
                        color={item.accent}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                      />
                    </View>
                    <View style={styles.skinCopy}>
                      <View style={styles.skinText}>
                        <Text style={styles.skinName}>{item.name}</Text>
                        <Text style={styles.skinDescription}>{item.description}</Text>
                      </View>
                      <MaterialCommunityIcons
                        name={selected ? 'check-circle' : 'circle-outline'}
                        size={19}
                        color={selected ? c.primaryAction : c.textSecondary}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.featurePanel}>
          <View style={styles.featureHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <MaterialCommunityIcons
                name="check-decagram-outline"
                size={18}
                color={c.primaryAction}
              />
              <Text style={styles.sectionHeading}>Card features</Text>
            </View>
            <Text style={styles.sectionMeta}>OnePass</Text>
          </View>
          <View style={styles.featureGrid}>
            {([
              { icon: 'card-account-details-outline', label: 'Member ID', value: 'Generated' },
              { icon: 'rotate-3d-variant', label: '3D preview', value: 'Tilt + flip' },
              { icon: 'content-save-outline', label: 'Design', value: 'Saved on device' },
            ] as const).map((feature) => (
              <View key={feature.label} style={styles.featureItem}>
                <MaterialCommunityIcons
                  name={feature.icon}
                  size={20}
                  color={c.primaryAction}
                />
                <Text style={styles.featureLabel}>{feature.label}</Text>
                <Text style={styles.featureValue}>{feature.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          style={[styles.applyButton, isSaving && styles.applyButtonDisabled]}
          onPress={() => void applyDesign()}
          disabled={isSaving}
          accessibilityRole="button"
        >
          {isSaving ? (
            <ActivityIndicator color={c.onPrimaryAction} />
          ) : (
            <>
              <MaterialCommunityIcons
                name={isApplied ? 'check' : 'check-bold'}
                size={17}
                color={c.onPrimaryAction}
              />
              <Text style={styles.applyText}>
                {isApplied ? 'Card design saved' : 'Set active card design'}
              </Text>
            </>
          )}
        </Pressable>
        <Text style={styles.savedNote}>
          Your design is saved on this device. It does not change your facility
          check-in method.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
