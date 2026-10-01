import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { formatApiDate, type AuthUser } from '../api/auth';
import { toRawBase64 } from '../api/attendance';
import { fetchEmployeeProfile, profileMediaUrl, updateEmployeeProfileImage } from '../api/profile';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#F4F8FC';
const ActiveGreen = '#22C55E';
const SoftBlue = '#E8F4FD';

type InfoRow = {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type MyProfileScreenProps = {
  user: AuthUser;
  onBack: () => void;
  onEditProfile: () => void;
  onHome: () => void;
  onOpenTickets: () => void;
  onUpdateUser: (user: AuthUser) => void;
};

async function resolveProfileImageBase64(uri: string, pickerBase64?: string | null) {
  if (typeof document !== 'undefined') {
    try {
      const dataUrl = await compressProfileImage(uri, 720, 0.72);
      if (dataUrl) return toRawBase64(dataUrl);
    } catch {
      // Fall back to the picker base64 or a direct file read.
    }
  }
  if (pickerBase64) return toRawBase64(pickerBase64);
  return readImageAsRawBase64(uri);
}

async function compressProfileImage(uri: string, maxWidth: number, quality: number) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load photo'));
    image.src = uri;
  });
  const scale = Math.min(1, maxWidth / Math.max(img.width, 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

async function fileToRawJpegBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected photo.'));
    reader.readAsDataURL(file);
  });
  try {
    const compressed = await compressProfileImage(dataUrl, 720, 0.72);
    if (compressed) return toRawBase64(compressed);
  } catch {
    // Use the original file when compression is unavailable.
  }
  return toRawBase64(dataUrl);
}

async function readImageAsRawBase64(uri: string) {
  if (uri.startsWith('data:')) return toRawBase64(uri);
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read photo'));
      reader.readAsDataURL(blob);
    });
    return toRawBase64(dataUrl);
  } catch {
    return null;
  }
}

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

export function MyProfileScreen({
  user,
  onBack,
  onEditProfile,
  onHome,
  onOpenTickets,
  onUpdateUser,
}: MyProfileScreenProps) {
  const initials =
    user.username
      .trim()
      .split(' ')
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join('') || 'AB';

  const memberSince = formatApiDate(user.createdDate) || '—';

  const rows: InfoRow[] = [
    { label: 'Name', value: displayValue(user.username), icon: 'account-outline' },
    { label: 'Email', value: displayValue(user.email), icon: 'email-outline' },
    { label: 'Phone Number', value: displayValue(user.phone), icon: 'phone-outline' },
    { label: 'Employee Number', value: displayValue(user.employee_code), icon: 'badge-account-horizontal-outline' },
    { label: 'UAN Number', value: displayValue(user.uan), icon: 'card-account-details-outline' },
    { label: 'Bank Account Name', value: displayValue(user.bank_account_name), icon: 'bank-outline' },
    { label: 'Bank Account Number', value: displayValue(user.bank_account_number), icon: 'credit-card-outline' },
    { label: 'PAN Number', value: displayValue(user.pan), icon: 'file-document-outline' },
    { label: 'Aadhaar Number', value: displayValue(user.aadhaar), icon: 'card-account-details-outline' },
  ];

  const profileFields = [
    user.username,
    user.email,
    user.phone,
    user.employee_code,
    user.uan,
    user.bank_account_name,
    user.bank_account_number,
    user.pan,
    user.aadhaar,
  ];
  const filledCount = profileFields.filter((value) => Boolean(value && String(value).trim())).length;
  const completed = Math.round((filledCount / profileFields.length) * 100);
  const isActive = user.is_active === 1;
  const [headerHeight, setHeaderHeight] = useState(52);
  const [cardHeight, setCardHeight] = useState(88);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoMenu, setPhotoMenu] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [showWebCamera, setShowWebCamera] = useState(false);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const blueHeight = headerHeight + 6 + cardHeight / 2;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (cropUri) {
        setCropUri(null);
        return true;
      }
      if (showWebCamera) {
        setShowWebCamera(false);
        return true;
      }
      if (viewingPhoto) {
        setViewingPhoto(false);
        return true;
      }
      if (photoMenu) {
        setPhotoMenu(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [cropUri, onBack, photoMenu, showWebCamera, viewingPhoto]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const enriched = await fetchEmployeeProfile(user);
        if (!cancelled) onUpdateUser(enriched);
      } catch {
        // Keep existing login data if profile API fails
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.employeeId]);

  function viewFullPhoto() {
    setPhotoMenu(false);
    if (user.photo_uri) setViewingPhoto(true);
  }

  function openPhotoMenu() {
    if (photoUploading) return;
    setPhotoError('');
    setPhotoMessage('');
    setPhotoMenu(true);
  }

  function chooseGallery() {
    setPhotoMenu(false);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        input.remove();
        if (file) void uploadProfileImage(file);
      };
      document.body.appendChild(input);
      input.click();
      return;
    }
    void pickPhotoNative();
  }

  function chooseCamera() {
    setPhotoMenu(false);
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        setShowWebCamera(true);
        return;
      }
      openWebCameraCapture();
      return;
    }
    void pickFromCameraNative();
  }

  function openWebCameraCapture() {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'user');
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      if (file) void uploadProfileImage(file);
    };
    document.body.appendChild(input);
    input.click();
  }

  async function pickFromCameraNative() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Camera permission is required to take a profile photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
      cameraType: ImagePicker.CameraType.front,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setCropUri(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
  }

  async function pickPhotoNative() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotoError('Photo library permission is required to update your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;

    setCropUri(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
  }

  function uploadProfileImage(file: File) {
    setCropUri(URL.createObjectURL(file));
  }

  async function saveProfileImage(imageData: string, previewUri: string) {
    if (!user.employeeId || user.employeeId <= 0) {
      setPhotoError('Employee ID is missing. Sign in again, then update your photo.');
      return;
    }

    setPhotoUploading(true);
    try {
      const saved = await updateEmployeeProfileImage(user.employeeId, imageData);
      const savedUri = saved.ProfileImage
        ? `${profileMediaUrl(saved.ProfileImage)}?v=${Date.now()}`
        : previewUri;
      setPhotoMessage('Profile photo updated.');
      const withLocalPhoto = { ...user, photo_uri: savedUri };
      onUpdateUser(withLocalPhoto);
      try {
        const enriched = await fetchEmployeeProfile(withLocalPhoto);
        onUpdateUser(enriched.photo_uri ? enriched : withLocalPhoto);
      } catch {
        // Saved photo stays visible if the profile refresh fails.
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Unable to update profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#082A5C', '#0B4F9E', '#1E8BE0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroBg, { height: blueHeight }]}
      />

      <SafeAreaView
        edges={['top']}
        style={styles.headerSafe}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.white} />
          </Pressable>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Pressable style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="More">
            <MaterialCommunityIcons name="dots-vertical" size={22} color={Brand.white} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <View
          style={[
            styles.profileCard,
            brandShadow('0 12px 24px rgba(11, 53, 110, 0.12)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 8,
            }),
          ]}
          onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
        >
          <Svg pointerEvents="none" style={styles.blob} width="180" height="120" viewBox="0 0 180 120">
            <Path
              d="M70 0 C120 10 180 20 180 70 C180 110 130 120 90 110 C40 98 20 70 18 40 C16 12 40 0 70 0 Z"
              fill="rgba(58,171,242,0.16)"
            />
            <Path
              d="M110 20 C150 28 180 48 180 82 C180 112 150 120 118 112 C86 104 78 78 84 52 C90 28 98 16 110 20 Z"
              fill="rgba(30,139,224,0.12)"
            />
          </Svg>

          <View style={styles.profileRow}>
            <Pressable
              onPress={openPhotoMenu}
              disabled={photoUploading}
              style={styles.avatarWrap}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              <View style={styles.avatar}>
                {user.photo_uri ? (
                  <Image source={{ uri: user.photo_uri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.initials}>{initials}</Text>
                )}
              </View>
              <View style={styles.cameraBadge}>
                {photoUploading ? (
                  <ActivityIndicator size="small" color={Brand.white} />
                ) : (
                  <MaterialIcons name="photo-camera" size={13} color={Brand.white} />
                )}
              </View>
            </Pressable>

            <View style={styles.profileCopy}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user.username}
              </Text>
              <Text style={styles.profileRole} numberOfLines={1}>
                {user.user_type || 'Technician'}
              </Text>
              <View style={styles.activePill}>
                <View style={[styles.dot, { backgroundColor: isActive ? ActiveGreen : '#94A3B8' }]} />
                <Text style={[styles.activeText, { color: isActive ? '#16A34A' : Brand.placeholder }]}>
                  {isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>
          {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
          {photoMessage ? <Text style={styles.photoMessage}>{photoMessage}</Text> : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statInner}>
              <View style={styles.statIcon}>
                <MaterialCommunityIcons name="account-outline" size={18} color={LogoMid} />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>Profile Completed</Text>
                <Text style={styles.statPercent}>{completed}%</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completed}%` }]} />
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statInner}>
              <View style={[styles.statIcon, styles.statIconGreen]}>
                <MaterialCommunityIcons name="shield-check-outline" size={18} color={ActiveGreen} />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>Account Status</Text>
                <View style={styles.statusLine}>
                  <View style={[styles.dot, { backgroundColor: isActive ? ActiveGreen : '#94A3B8' }]} />
                  <Text style={[styles.statStatus, { color: isActive ? ActiveGreen : Brand.placeholder }]}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statInner}>
              <View style={styles.statIcon}>
                <MaterialCommunityIcons name="calendar-month-outline" size={18} color={LogoMid} />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>Member Since</Text>
                <Text style={styles.statDate}>{memberSince}</Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.infoCard,
            brandShadow('0 10px 18px rgba(11, 53, 110, 0.06)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.06,
              shadowRadius: 10,
              elevation: 4,
            }),
          ]}
        >
          <View style={styles.infoHead}>
            <MaterialCommunityIcons name="account-outline" size={18} color={LogoNavy} />
            <Text style={styles.infoTitle}>Personal Information</Text>
            <Pressable
              onPress={onEditProfile}
              style={styles.infoEditWrap}
              accessibilityRole="button"
              accessibilityLabel="Edit personal information"
              hitSlop={8}
            >
              <MaterialCommunityIcons name="pencil-outline" size={14} color={LogoMid} />
              <Text style={styles.infoEdit}>Edit</Text>
            </Pressable>
          </View>

          {rows.map((row, index) => (
            <View key={row.label} style={styles.infoRowWrap}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <MaterialCommunityIcons name={row.icon} size={16} color={LogoMid} />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {row.value}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          <TabButton icon="home-outline" label="Home" onPress={onHome} />
          <TabButton icon="calendar-outline" label="Tickets" onPress={onOpenTickets} />
          <TabButton icon="notifications-outline" label="Notifications" badge={3} />
          <TabButton icon="person" label="Profile" active />
        </View>
      </SafeAreaView>

      {photoMenu ? (
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetDismiss} onPress={() => setPhotoMenu(false)} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Profile photo</Text>
            {user.photo_uri ? (
              <Pressable onPress={viewFullPhoto} style={styles.sheetOption} accessibilityRole="button" accessibilityLabel="View full photo">
                <View style={styles.sheetIcon}>
                  <MaterialCommunityIcons name="eye-outline" size={20} color={LogoMid} />
                </View>
                <View style={styles.sheetCopy}>
                  <Text style={styles.sheetOptionTitle}>View photo</Text>
                  <Text style={styles.sheetOptionHint}>See your profile image full size</Text>
                </View>
              </Pressable>
            ) : null}
            <Pressable onPress={chooseCamera} style={styles.sheetOption} accessibilityRole="button" accessibilityLabel="Open camera">
              <View style={styles.sheetIcon}>
                <MaterialCommunityIcons name="camera-outline" size={20} color={LogoMid} />
              </View>
              <View style={styles.sheetCopy}>
                <Text style={styles.sheetOptionTitle}>Camera</Text>
                <Text style={styles.sheetOptionHint}>Take a new photo</Text>
              </View>
            </Pressable>
            <Pressable onPress={chooseGallery} style={styles.sheetOption} accessibilityRole="button" accessibilityLabel="Choose from gallery">
              <View style={styles.sheetIcon}>
                <MaterialCommunityIcons name="image-outline" size={20} color={LogoMid} />
              </View>
              <View style={styles.sheetCopy}>
                <Text style={styles.sheetOptionTitle}>Gallery</Text>
                <Text style={styles.sheetOptionHint}>Choose an existing photo</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => setPhotoMenu(false)} style={styles.sheetCancel} accessibilityRole="button">
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showWebCamera ? (
        <ProfileWebCamera
          onCancel={() => setShowWebCamera(false)}
          onCapture={(dataUrl) => {
            setShowWebCamera(false);
            setCropUri(dataUrl);
          }}
        />
      ) : null}

      {viewingPhoto && user.photo_uri ? (
        <View style={styles.viewerOverlay}>
          <Pressable onPress={() => setViewingPhoto(false)} style={styles.viewerClose} accessibilityRole="button" accessibilityLabel="Close photo">
            <MaterialCommunityIcons name="close" size={22} color={Brand.white} />
          </Pressable>
          <Image source={{ uri: user.photo_uri }} style={styles.viewerImage} resizeMode="contain" />
          <Text style={styles.viewerName}>{user.username}</Text>
        </View>
      ) : null}

      {cropUri ? (
        <ProfileImageCropper
          uri={cropUri}
          onCancel={() => setCropUri(null)}
          onApply={(dataUrl) => {
            const uri = cropUri;
            setCropUri(null);
            void saveProfileImage(toRawBase64(dataUrl), uri);
          }}
        />
      ) : null}
    </View>
  );
}

const CROP_FRAME = 280;

function ProfileImageCropper({
  uri,
  onCancel,
  onApply,
}: {
  uri: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const naturalRef = useRef({ w: 1, h: 1 });
  const dragOrigin = useRef({ x: 0, y: 0 });

  function layout(nextZoom: number) {
    const { w, h } = naturalRef.current;
    const base = Math.max(CROP_FRAME / w, CROP_FRAME / h);
    const scale = base * nextZoom;
    return { scale, dw: w * scale, dh: h * scale };
  }

  function clampOffset(next: { x: number; y: number }, nextZoom: number) {
    const { dw, dh } = layout(nextZoom);
    return {
      x: Math.min(0, Math.max(CROP_FRAME - dw, next.x)),
      y: Math.min(0, Math.max(CROP_FRAME - dh, next.y)),
    };
  }

  function applyOffset(next: { x: number; y: number }, nextZoom = zoomRef.current) {
    const clamped = clampOffset(next, nextZoom);
    offsetRef.current = clamped;
    setOffset(clamped);
  }

  function applyZoom(nextZoom: number) {
    const zoomValue = Math.min(3, Math.max(1, Number(nextZoom.toFixed(2))));
    zoomRef.current = zoomValue;
    setZoom(zoomValue);
    applyOffset(offsetRef.current, zoomValue);
  }

  useEffect(() => {
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      const size = { w: image.naturalWidth || image.width, h: image.naturalHeight || image.height };
      naturalRef.current = size;
      setNatural(size);
      zoomRef.current = 1;
      setZoom(1);
      const base = Math.max(CROP_FRAME / size.w, CROP_FRAME / size.h);
      applyOffset({ x: (CROP_FRAME - size.w * base) / 2, y: (CROP_FRAME - size.h * base) / 2 }, 1);
    };
    image.onerror = () => {
      if (!cancelled) setNatural({ w: 0, h: 0 });
    };
    image.src = uri;
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragOrigin.current = offsetRef.current;
      },
      onPanResponderMove: (_event, gesture) => {
        applyOffset({
          x: dragOrigin.current.x + gesture.dx,
          y: dragOrigin.current.y + gesture.dy,
        });
      },
    }),
  ).current;

  function applyCrop() {
    if (!natural.w || !natural.h) return;
    setBusy(true);
    const image = new window.Image();
    image.onload = () => {
      const { scale } = layout(zoomRef.current);
      const sourceX = -offsetRef.current.x / scale;
      const sourceY = -offsetRef.current.y / scale;
      const sourceSize = CROP_FRAME / scale;
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setBusy(false);
        return;
      }
      ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 720, 720);
      onApply(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => setBusy(false);
    image.src = uri;
  }

  const { dw, dh } = natural.w ? layout(zoom) : { dw: CROP_FRAME, dh: CROP_FRAME };

  return (
    <View style={styles.cropOverlay}>
      <Text style={styles.cropTitle}>Adjust photo</Text>
      <Text style={styles.cropHint}>Drag the photo, then zoom until the face fits the circle.</Text>
      <View style={styles.cropFrame} {...panResponder.panHandlers}>
        {natural.w > 0 ? (
          <Image
            pointerEvents="none"
            source={{ uri }}
            style={{ position: 'absolute', width: dw, height: dh, left: offset.x, top: offset.y }}
          />
        ) : (
          <ActivityIndicator color={Brand.white} />
        )}
        <View pointerEvents="none" style={styles.cropRing} />
      </View>
      <View style={styles.zoomRow}>
        <Pressable onPress={() => applyZoom(zoom - 0.15)} style={styles.zoomBtn} accessibilityRole="button" accessibilityLabel="Zoom out">
          <MaterialCommunityIcons name="minus" size={20} color={LogoNavy} />
        </Pressable>
        <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
        <Pressable onPress={() => applyZoom(zoom + 0.15)} style={styles.zoomBtn} accessibilityRole="button" accessibilityLabel="Zoom in">
          <MaterialCommunityIcons name="plus" size={20} color={LogoNavy} />
        </Pressable>
      </View>
      <View style={styles.cropActions}>
        <Pressable onPress={onCancel} disabled={busy} style={styles.cameraCancel} accessibilityRole="button">
          <Text style={styles.cameraCancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={applyCrop} disabled={busy || !natural.w} style={styles.cameraCapture} accessibilityRole="button">
          {busy ? (
            <ActivityIndicator color={Brand.white} />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={18} color={Brand.white} />
              <Text style={styles.cameraCaptureText}>Use photo</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ProfileWebCamera({
  onCancel,
  onCapture,
}: {
  onCancel: () => void;
  onCapture: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play().catch(() => undefined);
          }
        });
      })
      .catch(() => {
        setError('Allow camera access, then try again.');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 480;
    const scale = Math.min(1, 720 / Math.max(sourceWidth, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', 0.72));
  }

  return (
    <View style={styles.cameraOverlay}>
      <Text style={styles.cameraTitle}>Take a profile photo</Text>
      {error ? (
        <Text style={styles.cameraError}>{error}</Text>
      ) : (
        createElement('video', {
          ref: videoRef,
          autoPlay: true,
          playsInline: true,
          muted: true,
          style: {
            width: '100%',
            maxWidth: 360,
            height: 280,
            objectFit: 'cover',
            borderRadius: 18,
            backgroundColor: '#082A5C',
          },
        })
      )}
      <View style={styles.cameraActions}>
        <Pressable onPress={onCancel} style={styles.cameraCancel} accessibilityRole="button">
          <Text style={styles.cameraCancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={capture} disabled={Boolean(error)} style={styles.cameraCapture} accessibilityRole="button">
          <MaterialCommunityIcons name="camera" size={18} color={Brand.white} />
          <Text style={styles.cameraCaptureText}>Capture</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TabButton({
  icon,
  label,
  active,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  badge?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="button" accessibilityLabel={label}>
      <View>
        <Ionicons name={icon} size={22} color={active ? LogoMid : '#9AADC2'} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
      {active ? <View style={styles.tabLine} /> : <View style={styles.tabLineSpacer} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerSafe: {
    zIndex: 2,
  },
  header: {
    height: 46,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 4,
    color: Brand.white,
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
  },
  body: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  profileCard: {
    borderRadius: 22,
    backgroundColor: Brand.white,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  blob: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 64,
    height: 64,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SoftBlue,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Brand.white,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: LogoNavy,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  photoError: {
    marginTop: 8,
    color: '#DC2626',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  photoMessage: {
    marginTop: 8,
    color: '#16A34A',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#123A6B',
    borderWidth: 2,
    borderColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    minWidth: 0,
  },
  profileName: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  profileRole: {
    marginTop: 1,
    color: '#7B8FA8',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  activePill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F8ED',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  activeText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  statsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  statInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  statIconGreen: {
    backgroundColor: '#E7F8ED',
  },
  statCopy: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    color: '#8AA0B5',
    fontSize: 9,
    lineHeight: 12,
    fontFamily: 'Poppins_500Medium',
  },
  statPercent: {
    marginTop: 1,
    color: LogoMid,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  statStatus: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  statDate: {
    marginTop: 1,
    color: LogoNavy,
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },
  progressTrack: {
    marginTop: 8,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#E4EEF7',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: LogoMid,
  },
  statusLine: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCard: {
    flex: 1,
    marginTop: 8,
    backgroundColor: Brand.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  infoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoTitle: {
    flex: 1,
    marginLeft: 8,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  infoEditWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoEdit: {
    marginLeft: 4,
    color: LogoMid,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  infoRowWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF3F8',
    marginLeft: 44,
  },
  infoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
    minWidth: 0,
  },
  infoLabel: {
    color: '#8AA0B5',
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
  },
  infoValue: {
    color: LogoNavy,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  bottomSafe: {
    backgroundColor: Brand.white,
  },
  bottomBar: {
    height: 58,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Brand.white,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  tabLabel: {
    marginTop: 3,
    fontSize: 11,
    color: '#9AADC2',
    fontFamily: 'Poppins_500Medium',
  },
  tabLabelActive: {
    color: LogoMid,
    fontFamily: 'Poppins_600SemiBold',
  },
  tabLine: {
    marginTop: 6,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: LogoMid,
  },
  tabLineSpacer: {
    marginTop: 6,
    height: 3,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Brand.white,
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8, 42, 92, 0.45)',
  },
  sheetDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 22,
  },
  viewerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 45,
    backgroundColor: '#061E40',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  viewerClose: {
    position: 'absolute',
    top: 18,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  viewerImage: {
    width: '100%',
    height: '70%',
  },
  viewerName: {
    marginTop: 14,
    color: Brand.white,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  sheetTitle: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 10,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCopy: {
    marginLeft: 12,
  },
  sheetOptionTitle: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  sheetOptionHint: {
    color: '#8AA0B5',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  sheetCancel: {
    marginTop: 6,
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetCancelText: {
    color: LogoMid,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    backgroundColor: '#082A5C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cameraTitle: {
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 16,
  },
  cameraError: {
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    textAlign: 'center',
    marginBottom: 16,
  },
  cameraActions: {
    flexDirection: 'row',
    marginTop: 18,
  },
  cameraCancel: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 10,
  },
  cameraCancelText: {
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  cameraCapture: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LogoMid,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cameraCaptureText: {
    marginLeft: 8,
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  cropOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    backgroundColor: '#082A5C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  cropTitle: {
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  cropHint: {
    marginTop: 6,
    marginBottom: 16,
    color: '#D6E8F8',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Poppins_500Medium',
  },
  cropFrame: {
    width: CROP_FRAME,
    height: CROP_FRAME,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#061E40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropRing: {
    position: 'absolute',
    top: 8,
    right: 8,
    bottom: 8,
    left: 8,
    borderRadius: (CROP_FRAME - 16) / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomLabel: {
    width: 72,
    textAlign: 'center',
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  cropActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
});
