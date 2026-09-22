import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { createElement, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchAttendanceStatus,
  formatJoiningDate,
  getPunchLocation,
  isBeforeJoiningDate,
  punchIn,
  punchOut,
  toRawBase64,
  PUNCH_ADDRESS,
  PUNCH_LATITUDE,
  PUNCH_LONGITUDE,
  type AttendanceStatus,
  type PunchLocation,
} from '../api/attendance';
import type { AuthUser } from '../api/auth';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const ValidGreen = '#16A34A';

const weekdays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const months = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

type AttendanceScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

export function AttendanceScreen({ user, onBack }: AttendanceScreenProps) {
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [showWebCam, setShowWebCam] = useState(false);
  const [punchPlace, setPunchPlace] = useState<PunchLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [onBack]);

  useEffect(() => {
    let cancelled = false;
    async function loadLocation() {
      try {
        const place = await getPunchLocation();
        if (!cancelled) {
          setPunchPlace(place);
          setLocationError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLocationError(err instanceof Error ? err.message : 'Unable to get location.');
        }
      }
    }
    loadLocation();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingStatus(true);
      try {
        const next = await fetchAttendanceStatus(user.employeeId);
        if (!cancelled) setStatus(next);
      } catch (err) {
        if (!cancelled) {
          Alert.alert(err instanceof Error ? err.message : 'Unable to load attendance status.');
        }
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user.employeeId]);

  const alreadyOut = Boolean(status?.alreadyCheckedOut || status?.outTimeStatus);
  const punchedIn = Boolean(status?.checkedIn || status?.inTimeStatus);
  // Today’s punch-in has no selfie yet — let user attach it (even after punch-out)
  const needsCheckinPhoto = punchedIn && !status?.hasCheckinImage;
  const waitingForCheckout = punchedIn && !alreadyOut && !needsCheckinPhoto && !status?.canCheckout;
  const punchingOut = punchedIn && !alreadyOut && !needsCheckinPhoto && Boolean(status?.canCheckout);
  const beforeJoining = isBeforeJoiningDate(user.joiningDate);
  const joiningLabel = formatJoiningDate(user.joiningDate);
  const blockedByJoining = beforeJoining && !punchedIn && !needsCheckinPhoto;
  const title = blockedByJoining
    ? 'PUNCH-IN BLOCKED'
    : needsCheckinPhoto
      ? 'ADD CHECK-IN PHOTO'
      : alreadyOut
        ? 'ATTENDANCE COMPLETE'
        : waitingForCheckout
          ? 'PUNCH-OUT WAITING'
          : punchingOut
            ? 'PUNCH-OUT ATTENDANCE'
            : 'PUNCH-IN ATTENDANCE';
  const action = needsCheckinPhoto
    ? 'SAVE CHECK-IN PHOTO'
    : punchingOut
      ? 'CONFIRM & PUNCH-OUT'
      : 'CONFIRM & PUNCH-IN';

  // Refresh eligibility while waiting for the 2-hour gap
  useEffect(() => {
    if (!waitingForCheckout) return;
    const timer = setInterval(async () => {
      try {
        const next = await fetchAttendanceStatus(user.employeeId);
        setStatus(next);
      } catch {
        // ignore transient refresh errors
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [waitingForCheckout, user.employeeId]);

  async function openCamera() {
    if (Platform.OS === 'web') {
      setShowWebCam(true);
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission is required to take a selfie.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        cameraType: ImagePicker.CameraType.front,
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelfieUri(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
        return;
      }
    } catch {
      const library = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });
      if (!library.canceled && library.assets[0]) {
        const asset = library.assets[0];
        setSelfieUri(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    }
  }

  function retakePhoto() {
    openCamera();
  }

  async function confirm() {
    if (submitting) return;
    if (alreadyOut && !needsCheckinPhoto) return;
    if (blockedByJoining) {
      Alert.alert(
        'Punch-in not allowed',
        joiningLabel
          ? `You can punch in only on or after your joining date (${joiningLabel}).`
          : 'You can punch in only on or after your joining date.',
      );
      return;
    }
    if (!selfieUri) {
      Alert.alert('Please take a selfie first.');
      return;
    }

    setSubmitting(true);
    try {
      const place = punchPlace ?? (await getPunchLocation());
      setPunchPlace(place);
      setLocationError(null);

      const imageData = await resolveImageBase64(selfieUri);
      if (!imageData) {
        Alert.alert('Unable to read selfie. Please retake the photo.');
        return;
      }

      const payload = {
        employeeId: user.employeeId,
        latitude: PUNCH_LATITUDE,
        longitude: PUNCH_LONGITUDE,
        location: PUNCH_ADDRESS,
        address: PUNCH_ADDRESS,
        imageData,
        joiningDate: user.joiningDate,
      };

      if (punchingOut) {
        if (!status?.canCheckout) {
          Alert.alert(
            'Punch-out not allowed yet',
            status?.message ||
              `You can punch out only after ${status?.minHoursRequired || 2} hours from punch-in.`
          );
          return;
        }
        const message = await punchOut(payload);
        const next = await fetchAttendanceStatus(user.employeeId);
        setStatus(next);
        setSelfieUri(null);
        setShowWebCam(false);
        Alert.alert(message || 'Punch out successful', next.outTime || formatClock(new Date()), [
          { text: 'OK', onPress: onBack },
        ]);
        return;
      }

      // Punch-in OR attach missing check-in selfie
      const message = await punchIn(payload);
      const next = await fetchAttendanceStatus(user.employeeId);
      setStatus(next);
      setSelfieUri(null);
      setShowWebCam(false);
      Alert.alert(
        message || (needsCheckinPhoto ? 'Check-in photo saved' : 'Punch in successful'),
        next.inTime || formatClock(new Date())
      );
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : 'Attendance request failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.backBtn} />
          </View>
          <Text style={styles.clock}>{formatClock(now)}</Text>
          <Text style={styles.date}>{formatDate(now)}</Text>
          <View style={styles.statusStrip}>
            <Text style={styles.statusChip}>In {status?.inTime || '--:--'}</Text>
            <Text style={styles.statusChip}>Out {status?.outTime || '--:--'}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View
        style={[
          styles.card,
          brandShadow('0 12px 20px rgba(11, 53, 110, 0.12)', {
            shadowColor: LogoNavy,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 14,
            elevation: 8,
          }),
        ]}
      >
        {loadingStatus ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={LogoMid} />
            <Text style={styles.loadingText}>Loading attendance status…</Text>
          </View>
        ) : blockedByJoining ? (
          <View style={styles.doneBox}>
            <MaterialCommunityIcons name="calendar-remove" size={42} color={LogoMid} />
            <Text style={styles.doneTitle}>Punch-in not available yet</Text>
            <Text style={styles.doneHint}>
              {joiningLabel
                ? `Your joining date is ${joiningLabel}. Punch-in is allowed only from that day onwards.`
                : 'Punch-in is allowed only from your joining date onwards.'}
            </Text>
          </View>
        ) : alreadyOut && !needsCheckinPhoto ? (
          <View style={styles.doneBox}>
            <MaterialCommunityIcons name="check-decagram" size={42} color={ValidGreen} />
            <Text style={styles.doneTitle}>Already punched out today</Text>
            <Text style={styles.doneHint}>
              In {status?.inTime || '--:--'} · Out {status?.outTime || '--:--'}
            </Text>
          </View>
        ) : waitingForCheckout ? (
          <View style={styles.doneBox}>
            <MaterialCommunityIcons name="timer-sand" size={42} color={LogoMid} />
            <Text style={styles.doneTitle}>Punch-out locked</Text>
            <Text style={styles.doneHint}>
              Minimum {status?.minHoursRequired || 2} hours required after punch-in.
            </Text>
            <Text style={styles.waitTime}>
              Worked: {formatDuration(status?.minutesWorked || 0)}
            </Text>
            <Text style={styles.waitTime}>
              Remaining: {formatDuration(status?.remainingMinutes || 0)}
            </Text>
            <Text style={[styles.doneHint, { marginTop: 8 }]}>
              {status?.message || 'Please wait before punching out.'}
            </Text>
            <Pressable
              onPress={async () => {
                try {
                  const next = await fetchAttendanceStatus(user.employeeId);
                  setStatus(next);
                } catch (err) {
                  Alert.alert(err instanceof Error ? err.message : 'Unable to refresh status.');
                }
              }}
              style={styles.refreshWaitBtn}
              accessibilityRole="button"
              accessibilityLabel="Refresh punch-out status"
            >
              <MaterialCommunityIcons name="refresh" size={16} color={LogoMid} />
              <Text style={styles.refreshWaitText}>Refresh status</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.workspace}>
              <Text style={styles.smallLabel}>CURRENT WORKSPACE</Text>
              <Text style={styles.radius}>
                {punchPlace?.accuracy != null ? `Accuracy ~${Math.round(punchPlace.accuracy)}m` : 'GPS required'}
              </Text>
              <View style={styles.locationRow}>
                <View style={styles.pin}>
                  <MaterialCommunityIcons name="map-marker" size={18} color={LogoMid} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.location} numberOfLines={2}>
                    {locationError
                      ? locationError
                      : punchPlace?.address || 'Fetching current location…'}
                  </Text>
                  <View style={styles.validRow}>
                    <MaterialCommunityIcons
                      name={punchPlace ? 'check-circle' : 'clock-outline'}
                      size={14}
                      color={punchPlace ? ValidGreen : Mute}
                    />
                    <Text style={[styles.valid, !punchPlace ? { color: Mute } : null]}>
                      {punchPlace
                        ? punchingOut
                          ? 'Ready to punch out'
                          : 'Ready to punch in'
                        : 'Waiting for GPS'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    try {
                      const place = await getPunchLocation();
                      setPunchPlace(place);
                      setLocationError(null);
                    } catch (err) {
                      setLocationError(err instanceof Error ? err.message : 'Unable to get location.');
                    }
                  }}
                  style={styles.refresh}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh location"
                >
                  <MaterialCommunityIcons name="refresh" size={16} color={LogoMid} />
                </Pressable>
              </View>
            </View>

            <View style={styles.selfieBox}>
              <Text style={styles.selfieTitle}>{selfieUri && !showWebCam ? 'Selfie captured' : 'Take a Selfie'}</Text>
              <Text style={styles.selfieHint}>Required for attendance verification</Text>

              {showWebCam ? (
                <InlineWebCamera
                  onCancel={() => setShowWebCam(false)}
                  onCapture={(uri) => {
                    setSelfieUri(uri);
                    setShowWebCam(false);
                  }}
                />
              ) : selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.preview} />
              ) : (
                <>
                  <View style={styles.previewPlaceholder}>
                    <MaterialCommunityIcons name="camera-outline" size={28} color={LogoNavy} />
                  </View>
                  <Pressable
                    onPress={openCamera}
                    style={styles.cameraBtnWrap}
                    accessibilityRole="button"
                    accessibilityLabel="Open Camera"
                  >
                    <LinearGradient
                      colors={[LogoNavy, LogoMid]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.cameraBtn}
                    >
                      <MaterialCommunityIcons name="camera-outline" size={16} color={Brand.white} />
                      <Text style={styles.cameraText}>Open Camera</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              )}
            </View>

            {selfieUri && !showWebCam ? (
              <View style={styles.footer}>
                <Pressable
                  onPress={retakePhoto}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Retake Photo"
                >
                  <Text style={styles.retakeText}>Retake Photo</Text>
                </Pressable>
                <Pressable
                  onPress={confirm}
                  disabled={submitting}
                  style={styles.confirmWrap}
                  accessibilityRole="button"
                  accessibilityLabel={action}
                >
                  <LinearGradient
                    colors={[LogoNavy, LogoMid]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.confirm}
                  >
                    {submitting ? (
                      <ActivityIndicator color={Brand.white} />
                    ) : (
                      <>
                        <Text style={styles.confirmText}>{action}</Text>
                        <MaterialCommunityIcons name="arrow-right" size={18} color={Brand.white} />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

async function resolveImageBase64(uri: string): Promise<string | null> {
  try {
    // Prefer canvas compress so payload stays small enough for PHP
    if (typeof document !== 'undefined') {
      const dataUrl = await compressImageToJpegDataUrl(uri, 720, 0.72);
      if (dataUrl) return toRawBase64(dataUrl);
    }
  } catch {
    // fall through
  }

  if (uri.startsWith('data:')) {
    return toRawBase64(uri);
  }
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read selfie'));
      reader.readAsDataURL(blob);
    });
    return toRawBase64(dataUrl);
  } catch {
    return null;
  }
}

async function compressImageToJpegDataUrl(uri: string, maxWidth: number, quality: number) {
  const img = await loadHtmlImage(uri);
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

function loadHtmlImage(uri: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load selfie'));
    img.src = uri;
  });
}

function InlineWebCamera({
  onCancel,
  onCapture,
}: {
  onCancel: () => void;
  onCapture: (uri: string) => void;
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
            videoRef.current.play().catch(() => undefined);
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
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', 0.85));
  }

  return (
    <View style={styles.webCamBox}>
      {error ? (
        <Text style={styles.webCamError}>{error}</Text>
      ) : (
        createElement('video', {
          ref: videoRef,
          autoPlay: true,
          playsInline: true,
          muted: true,
          style: {
            width: '100%',
            height: 220,
            objectFit: 'cover',
            borderRadius: 14,
            backgroundColor: SoftBlue,
          },
        })
      )}
      <View style={styles.webCamActions}>
        <Pressable onPress={onCancel} style={styles.webCamCancel}>
          <Text style={styles.webCamCancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={capture} style={styles.webCamCapture}>
          <Text style={styles.webCamCaptureText}>Capture</Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatClock(date: Date) {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes}:${seconds} ${suffix}`;
}

function formatDuration(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatDate(date: Date) {
  return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  clock: {
    textAlign: 'center',
    color: Brand.white,
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
  },
  date: {
    marginBottom: 8,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  statusStrip: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 12,
  },
  statusChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    color: Brand.white,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  card: {
    flex: 1,
    marginTop: -6,
    marginHorizontal: 14,
    marginBottom: 14,
    backgroundColor: Brand.white,
    borderRadius: 22,
    padding: 14,
    overflow: 'hidden',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: Mute,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  doneBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  doneTitle: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  doneHint: {
    color: Mute,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    textAlign: 'center',
  },
  waitTime: {
    marginTop: 6,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  refreshWaitBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SoftBlue,
  },
  refreshWaitText: {
    color: LogoMid,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  workspace: {
    backgroundColor: SoftBlue,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  smallLabel: {
    color: Mute,
    fontSize: 10,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_600SemiBold',
  },
  radius: {
    marginTop: 2,
    color: LogoMid,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  locationRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  location: {
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  validRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valid: {
    color: ValidGreen,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  refresh: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieBox: {
    flex: 1,
    alignItems: 'center',
  },
  selfieTitle: {
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  selfieHint: {
    marginTop: 2,
    marginBottom: 12,
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: SoftBlue,
  },
  previewPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cameraBtnWrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cameraBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraText: {
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  footer: {
    marginTop: 12,
    gap: 10,
  },
  retakeText: {
    textAlign: 'center',
    color: LogoMid,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  confirmWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirm: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmText: {
    color: Brand.white,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },
  webCamBox: {
    width: '100%',
    gap: 10,
  },
  webCamError: {
    color: Brand.error,
    textAlign: 'center',
    fontFamily: 'Poppins_500Medium',
  },
  webCamActions: {
    flexDirection: 'row',
    gap: 10,
  },
  webCamCancel: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCamCancelText: {
    color: LogoNavy,
    fontFamily: 'Poppins_600SemiBold',
  },
  webCamCapture: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: LogoMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCamCaptureText: {
    color: Brand.white,
    fontFamily: 'Poppins_600SemiBold',
  },
});
