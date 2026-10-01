import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createElement, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand } from '../theme/colors';

type Facing = 'environment' | 'user';

type WebCameraModalProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  /** Receives a JPEG data URL. */
  onCapture: (dataUrl: string) => void;
  onPickFile?: () => void;
};

/** Live camera preview for web, built on getUserMedia. */
export function WebCameraModal({ visible, title, onCancel, onCapture, onPickFile }: WebCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    setReady(false);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera. Choose a photo from files instead.');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play().then(() => setReady(true)).catch(() => setReady(true));
          }
        });
      })
      .catch(() => {
        if (!cancelled) setError('Allow camera access in the browser, then try again.');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [visible, facing]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 480;
    const scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', 0.7));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Close camera">
              <MaterialCommunityIcons name="close" size={22} color="#475569" />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="camera-off-outline" size={32} color="#E11D48" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.previewWrap}>
              {createElement('video', {
                ref: videoRef,
                autoPlay: true,
                playsInline: true,
                muted: true,
                style: {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: facing === 'user' ? 'scaleX(-1)' : undefined,
                },
              })}
              <Pressable
                onPress={() => setFacing((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                style={styles.flipBtn}
                accessibilityLabel="Switch camera"
              >
                <MaterialCommunityIcons name="camera-flip-outline" size={22} color={Brand.white} />
              </Pressable>
            </View>
          )}

          <View style={styles.actions}>
            {onPickFile ? (
              <Pressable onPress={onPickFile} style={[styles.btn, styles.fileBtn]} accessibilityRole="button">
                <MaterialCommunityIcons name="image-outline" size={18} color="#0B356E" />
                <Text style={styles.fileText}>Files</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={capture}
              disabled={Boolean(error) || !ready}
              style={[styles.btn, styles.captureBtn, (Boolean(error) || !ready) && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="camera" size={18} color={Brand.white} />
              <Text style={styles.captureText}>Capture</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: '#0B356E', fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  previewWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 440,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#082A5C',
  },
  flipBtn: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: { alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 12 },
  errorText: { color: '#475569', fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  fileBtn: { backgroundColor: '#E8F4FD' },
  fileText: { color: '#0B356E', fontSize: 14, fontFamily: 'Poppins_500Medium' },
  captureBtn: { backgroundColor: '#2196F3' },
  captureText: { color: Brand.white, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
});
