import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenTexture from '../components/ScreenTexture';
import tileDepth from '../theme/tileDepth';
import { useTheme } from '../context/ThemeContext';
import {
  confirmFacilityAccess,
  getAccessHistory,
  scanFacility,
  type AccessMethod,
  type AccessPreview,
  type AccessVisit,
} from '../services/onepass';

export default function ActivePassScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const [token, setToken] = useState('');
  const [previewToken, setPreviewToken] = useState('');
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [showManualToken, setShowManualToken] = useState(false);
  const [preview, setPreview] = useState<AccessPreview | null>(null);
  const [accessMethod, setAccessMethod] =
    useState<AccessMethod>('wallet_points');
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(
    null
  );
  const [hours, setHours] = useState(1);
  const [history, setHistory] = useState<AccessVisit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hasHandledBarcode = useRef(false);
  const confirmationKey = useRef<{ selection: string; key: string } | null>(
    null
  );

  const selectedPass = preview?.accessOptions.onePass.find(
    (option) => option.subscriptionId === selectedPassId
  );
  const selectedPackage = preview?.accessOptions.facilityPackages.find(
    (option) => option.subscriptionId === selectedPackageId
  );
  const maxHours =
    accessMethod === 'wallet_points'
      ? preview?.accessOptions.walletPoints.maxHours ?? 0
      : accessMethod === 'onepass_pass'
        ? selectedPass?.maxHours ?? 0
        : selectedPackage?.maxHours ?? 0;
  const canConfirm =
    Boolean(preview?.canAccess) &&
    hours >= 1 &&
    hours <= maxHours &&
    hours <= 24;

  const requestCameraAccess = useCallback(async () => {
    try {
      await requestPermission();
    } catch (permissionError) {
      setError(
        permissionError instanceof Error
          ? permissionError.message
          : 'Unable to request camera permission.'
      );
    }
  }, [requestPermission]);

  useEffect(() => {
    if (!permission || permission.granted || permissionRequested) return;
    setPermissionRequested(true);
    void requestCameraAccess();
  }, [permission, permissionRequested, requestCameraAccess]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await getAccessHistory();
      setHistory(data.visits);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load access history.'
      );
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory])
  );

  const scanToken = async (rawToken: string) => {
    setError(null);
    setNotice(null);
    setPreview(null);
    setPreviewToken('');
    const qrToken = rawToken.trim();
    if (qrToken.length < 20 || qrToken.length > 256) {
      setError('Enter or paste a valid facility QR token.');
      return false;
    }

    try {
      setScanning(true);
      setToken(qrToken);
      const result = await scanFacility(qrToken);
      const availablePass = result.accessOptions.onePass.find(
        (option) => option.maxHours > 0
      );
      const availablePackage = result.accessOptions.facilityPackages.find(
        (option) => option.maxHours > 0
      );
      setPreview(result);
      setPreviewToken(qrToken);
      setHours(1);
      setSelectedPassId(availablePass?.subscriptionId ?? null);
      setSelectedPackageId(availablePackage?.subscriptionId ?? null);
      setAccessMethod(
        result.accessOptions.walletPoints.maxHours > 0
          ? 'wallet_points'
          : availablePass
            ? 'onepass_pass'
            : 'facility_package'
      );
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to validate this facility QR token.'
      );
      return false;
    } finally {
      setScanning(false);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (hasHandledBarcode.current || scanning || confirming) return;
    hasHandledBarcode.current = true;
    setCameraEnabled(false);
    void scanToken(data).then((valid) => {
      if (!valid) {
        hasHandledBarcode.current = false;
        setCameraEnabled(true);
      }
    });
  };

  const handleManualScan = () => {
    hasHandledBarcode.current = true;
    setCameraEnabled(false);
    void scanToken(token).then((valid) => {
      if (!valid) {
        hasHandledBarcode.current = false;
        setCameraEnabled(true);
      }
    });
  };

  const handleScanAgain = () => {
    if (confirming) return;
    setToken('');
    setPreviewToken('');
    setPreview(null);
    setAccessMethod('wallet_points');
    setSelectedPassId(null);
    setSelectedPackageId(null);
    setHours(1);
    setError(null);
    setNotice(null);
    hasHandledBarcode.current = false;
    setCameraEnabled(true);
  };

  const openCameraSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (settingsError) {
      Alert.alert(
        'Unable to open settings',
        settingsError instanceof Error
          ? settingsError.message
          : 'Please enable camera access in your device settings.'
      );
    }
  };

  const handleConfirm = async () => {
    if (!preview || !previewToken || !canConfirm) return;

    const selection = [
      previewToken,
      accessMethod,
      hours,
      selectedPassId ?? '',
      selectedPackageId ?? '',
    ].join('|');
    const existingConfirmation = confirmationKey.current;
    const idempotencyKey =
      existingConfirmation?.selection === selection
        ? existingConfirmation.key
        : `facility-access-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;
    confirmationKey.current = { selection, key: idempotencyKey };

    try {
      setConfirming(true);
      const result = await confirmFacilityAccess(previewToken, {
        accessMethod,
        hours,
        idempotencyKey,
        ...(accessMethod === 'onepass_pass'
          ? { onePassSubscriptionId: selectedPassId ?? undefined }
          : {}),
        ...(accessMethod === 'facility_package'
          ? { facilityPackageSubscriptionId: selectedPackageId ?? undefined }
          : {}),
      });
      setNotice(
        `Access confirmed at ${preview.facility.name}. ${result.access.hoursUsed} hour(s) used.`
      );
      confirmationKey.current = null;
      setToken('');
      setPreviewToken('');
      setPreview(null);
      setAccessMethod('wallet_points');
      setSelectedPassId(null);
      setSelectedPackageId(null);
      setHours(1);
      hasHandledBarcode.current = false;
      setCameraEnabled(true);
      await loadHistory();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to confirm facility access.'
      );
    } finally {
      setConfirming(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    fullCamera: {
      flex: 1,
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
    },
    fullCameraOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullPermissionPanel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: '#000000',
    },
    content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 34 },
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      marginBottom: 18,
    },
    pageHeaderIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: c.primaryAction,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
      ...tileDepth,
    },
    title: { color: c.text, fontSize: 25, fontWeight: '800' },
    subtitle: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#0F172A',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
      ...tileDepth,
    },
    cardTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
    instruction: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
      marginBottom: 16,
    },
    input: {
      minHeight: 52,
      color: c.text,
      backgroundColor: c.surfaceSecondary,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 15,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
    },
    cameraContainer: {
      height: 320,
      overflow: 'hidden',
      borderRadius: 20,
      backgroundColor: c.primaryDark,
      marginBottom: 14,
      shadowColor: '#0F172A',
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    camera: { flex: 1 },
    cameraOverlay: {
      ...StyleSheet.absoluteFill,
      padding: 13,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cameraGuidance: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: 10,
      borderRadius: 13,
      backgroundColor: c.surface,
    },
    cameraGuidanceText: {
      flex: 1,
      color: c.text,
      fontSize: 11,
      lineHeight: 16,
    },
    scannerCenter: {
      flex: 1,
      justifyContent: 'center',
    },
    scannerFrame: {
      width: 220,
      height: 220,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.9)',
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    scannerHint: {
      color: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 7,
      fontSize: 11,
      fontWeight: '700',
    },
    cameraStatus: {
      position: 'absolute',
      right: 13,
      bottom: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: 'rgba(26,50,74,0.86)',
    },
    cameraStatusText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
    permissionPanel: {
      height: 320,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      borderRadius: 20,
      backgroundColor: c.surfaceSecondary,
      marginBottom: 14,
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    permissionText: {
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 16,
    },
    manualToggle: {
      alignSelf: 'center',
      paddingVertical: 10,
    },
    manualToggleText: {
      color: c.primaryDark,
      fontWeight: '700',
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 12,
      backgroundColor: c.primaryAction,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      shadowColor: c.primaryDark,
      shadowOpacity: 0.18,
      shadowRadius: 9,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    primaryButtonDisabled: { opacity: 0.5 },
    primaryButtonText: {
      color: c.onPrimaryAction,
      fontWeight: '800',
      fontSize: 15,
    },
    secondaryButton: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 10,
    },
    secondaryButtonText: {
      color: c.primaryDark,
      fontWeight: '800',
      fontSize: 15,
    },
    facilityName: {
      color: c.text,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 4,
    },
    detail: {
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 6,
    },
    price: {
      color: c.primaryDark,
      fontSize: 22,
      fontWeight: '800',
      marginTop: 12,
      marginBottom: 14,
    },
    error: {
      color: c.danger,
      backgroundColor: c.danger + '18',
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
      lineHeight: 20,
    },
    success: {
      color: c.success,
      backgroundColor: c.success + '18',
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
      lineHeight: 20,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 12,
    },
    visit: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 15,
      marginBottom: 10,
      shadowColor: '#0F172A',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
      ...tileDepth,
    },
    visitName: { color: c.text, fontWeight: '700', fontSize: 15 },
    visitMeta: { color: c.textSecondary, marginTop: 5, fontSize: 13 },
    empty: {
      color: c.textSecondary,
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 20,
      textAlign: 'center',
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.48)',
    },
    modalCard: {
      maxHeight: '90%',
      backgroundColor: c.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 26,
      ...tileDepth,
    },
    modalContent: { paddingBottom: 20 },
    modalHandle: {
      width: 46,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: 17,
    },
    modalTitle: {
      color: c.text,
      fontSize: 21,
      fontWeight: '800',
      marginBottom: 6,
    },
    previewMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      padding: 13,
      marginTop: 13,
      borderRadius: 15,
      backgroundColor: c.surfaceSecondary,
    },
    previewMetaLabel: {
      color: c.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    previewMetaValue: {
      color: c.primaryDark,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 3,
    },
    option: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 15,
      padding: 13,
      marginTop: 9,
      backgroundColor: c.surface,
      ...tileDepth,
    },
    optionSelected: {
      borderColor: c.primaryDark,
      backgroundColor: c.primarySoft,
    },
    optionDisabled: { opacity: 0.48 },
    optionTitle: { color: c.text, fontSize: 14, fontWeight: '800' },
    optionDetail: { color: c.textSecondary, fontSize: 12, marginTop: 4 },
    hourControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 12,
    },
    hourButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hourButtonText: { color: c.primaryDark, fontSize: 24, fontWeight: '700' },
    hourLabel: { color: c.text, fontSize: 17, fontWeight: '800' },
    emptyOptions: {
      color: c.danger,
      backgroundColor: c.danger + '18',
      borderRadius: 10,
      padding: 12,
      marginTop: 12,
      lineHeight: 19,
    },
  });

  return (
    <View style={styles.container}>
      {permission === null ? (
        <View style={styles.fullPermissionPanel}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : permission.granted && isFocused ? (
        <View style={styles.fullCamera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={
              cameraEnabled && !scanning && !preview
                ? handleBarcodeScanned
                : undefined
            }
          />
          {cameraEnabled && !preview && (
            <View style={styles.fullCameraOverlay} pointerEvents="none">
              <View style={styles.scannerCenter}>
                <View style={styles.scannerFrame} />
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.fullPermissionPanel}>
          <Text style={styles.permissionText}>
            Allow camera access to scan facility QR codes.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              permission.canAskAgain
                ? void requestCameraAccess()
                : void openCameraSettings()
            }
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            </Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={preview !== null}
        transparent
        animationType="slide"
        onRequestClose={handleScanAgain}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleScanAgain}
            disabled={confirming}
            accessibilityRole="button"
            accessibilityLabel="Close facility access options"
          />
          {preview && (
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.modalTitle}>Choose how to access</Text>
                <Text style={styles.facilityName}>{preview.facility.name}</Text>
                <Text style={styles.detail}>
                  {preview.facility.category} · {preview.facility.address},{' '}
                  {preview.facility.city}
                </Text>
                <View style={styles.previewMeta}>
                  <View>
                    <Text style={styles.previewMetaLabel}>Facility rate</Text>
                    <Text style={styles.previewMetaValue}>
                      {preview.facility.pointsPerHour.toLocaleString()} pts / hr
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.previewMetaLabel}>Wallet balance</Text>
                    <Text style={styles.previewMetaValue}>
                      {preview.wallet.totalAvailablePoints.toLocaleString()} pts
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                  Wallet points
                </Text>
                <Pressable
                  style={[
                    styles.option,
                    accessMethod === 'wallet_points' && styles.optionSelected,
                    preview.accessOptions.walletPoints.maxHours < 1 &&
                      styles.optionDisabled,
                  ]}
                  disabled={preview.accessOptions.walletPoints.maxHours < 1}
                  onPress={() => {
                    setAccessMethod('wallet_points');
                    setHours(1);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.optionTitle}>
                    {preview.facility.pointsPerHour} points per hour
                  </Text>
                  <Text style={styles.optionDetail}>
                    Balance: {preview.wallet.totalAvailablePoints} points · up
                    to {preview.accessOptions.walletPoints.maxHours} hour(s)
                  </Text>
                </Pressable>

                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                  Universal OnePass
                </Text>
                {preview.accessOptions.onePass.length ? (
                  preview.accessOptions.onePass.map((pass) => (
                    <Pressable
                      key={pass.subscriptionId}
                      style={[
                        styles.option,
                        accessMethod === 'onepass_pass' &&
                          selectedPassId === pass.subscriptionId &&
                          styles.optionSelected,
                        pass.maxHours < 1 && styles.optionDisabled,
                      ]}
                      disabled={pass.maxHours < 1}
                      onPress={() => {
                        setAccessMethod('onepass_pass');
                        setSelectedPassId(pass.subscriptionId);
                        setHours(1);
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.optionTitle}>{pass.plan.name}</Text>
                      <Text style={styles.optionDetail}>
                        {pass.pointsRemaining.toLocaleString()} points left · up
                        to {pass.maxHours} hour(s) · expires{' '}
                        {new Date(pass.expiresAt).toLocaleDateString()}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.optionDetail}>
                    No active universal pass is available.
                  </Text>
                )}

                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                  Facility packages
                </Text>
                {preview.accessOptions.facilityPackages.length ? (
                  preview.accessOptions.facilityPackages.map((facilityPackage) => (
                    <Pressable
                      key={facilityPackage.subscriptionId}
                      style={[
                        styles.option,
                        accessMethod === 'facility_package' &&
                          selectedPackageId ===
                            facilityPackage.subscriptionId &&
                          styles.optionSelected,
                        facilityPackage.maxHours < 1 && styles.optionDisabled,
                      ]}
                      disabled={facilityPackage.maxHours < 1}
                      onPress={() => {
                        setAccessMethod('facility_package');
                        setSelectedPackageId(
                          facilityPackage.subscriptionId
                        );
                        setHours(1);
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.optionTitle}>
                        {facilityPackage.packageType} facility package
                      </Text>
                      <Text style={styles.optionDetail}>
                        {facilityPackage.hoursRemaining} hour(s) remaining · up
                        to {facilityPackage.maxHours} hour(s) · expires{' '}
                        {new Date(facilityPackage.expiresAt).toLocaleDateString()}
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.optionDetail}>
                    No active facility package is available.
                  </Text>
                )}

                {canConfirm ? (
                  <>
                    <View style={styles.hourControls}>
                      <Pressable
                        style={styles.hourButton}
                        onPress={() => setHours((current) => Math.max(1, current - 1))}
                        accessibilityRole="button"
                        accessibilityLabel="Reduce access duration"
                      >
                        <Text style={styles.hourButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.hourLabel}>{hours} hour(s)</Text>
                      <Pressable
                        style={[
                          styles.hourButton,
                          hours >= Math.min(maxHours, 24) &&
                            styles.optionDisabled,
                        ]}
                        onPress={() =>
                          setHours((current) =>
                            Math.min(Math.min(maxHours, 24), current + 1)
                          )
                        }
                        disabled={hours >= Math.min(maxHours, 24)}
                        accessibilityRole="button"
                        accessibilityLabel="Increase access duration"
                      >
                        <Text style={styles.hourButtonText}>+</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      style={[
                        styles.primaryButton,
                        confirming && styles.primaryButtonDisabled,
                      ]}
                      onPress={() => void handleConfirm()}
                      disabled={confirming}
                    >
                      {confirming ? (
                        <ActivityIndicator color={c.onPrimaryAction} />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="check-circle-outline"
                            size={19}
                            color={c.onPrimaryAction}
                          />
                          <Text style={styles.primaryButtonText}>
                            Confirm {hours}-hour access
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.emptyOptions}>
                    No eligible points or active package is available for this
                    facility.
                  </Text>
                )}
                <Pressable
                  style={styles.secondaryButton}
                  onPress={handleScanAgain}
                  disabled={confirming}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryButtonText}>
                    Scan another QR code
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
