import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  deleteTicketWorkImage,
  fetchTicketWorkImages,
  uploadTicketWorkImage,
  type TicketWorkImage,
  type WorkImageAction,
} from '../api/serviceTickets';
import { Brand } from '../theme/colors';
import { WebCameraModal } from './WebCameraModal';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const Danger = '#DC2626';
const Success = '#059669';
const MaxBase64Length = 6_500_000;

const Sections: {
  action: WorkImageAction;
  title: string;
  hint: string;
  icon: 'camera-outline' | 'camera-plus' | 'file-document-outline';
}[] = [
  { action: 'pre_img', title: 'Pre Image', hint: 'Before starting the work', icon: 'camera-outline' },
  { action: 'post_img', title: 'Post Image', hint: 'After the work is done', icon: 'camera-plus' },
  { action: 'Service_Report', title: 'Service Report', hint: 'Photo of the signed paper report', icon: 'file-document-outline' },
];

type TicketWorkPhotosProps = {
  ticketId: string;
  createdBy: string;
  editable: boolean;
  cardStyle?: object;
  onImagesChange?: (images: TicketWorkImage[]) => void;
};

export function TicketWorkPhotos({ ticketId, createdBy, editable, cardStyle, onImagesChange }: TicketWorkPhotosProps) {
  const [images, setImages] = useState<TicketWorkImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<WorkImageAction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [webCameraAction, setWebCameraAction] = useState<WorkImageAction | null>(null);
  const [preview, setPreview] = useState<TicketWorkImage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setImages(await fetchTicketWorkImages(ticketId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load work photos.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onImagesChange?.(images);
  }, [images, onImagesChange]);

  const pickerOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.4, base64: true };

  const upload = async (action: WorkImageAction, base64: string) => {
    if (base64.length > MaxBase64Length) {
      setError('Photo is too large. Please capture it again.');
      return;
    }
    setUploading(action);
    setError('');
    try {
      await uploadTicketWorkImage({ ticketId, action, base64, createdBy });
      setImages(await fetchTicketWorkImages(ticketId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the photo.');
    } finally {
      setUploading(null);
    }
  };

  const pickFromFiles = async (action: WorkImageAction) => {
    setWebCameraAction(null);
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    const base64 = !result.canceled ? result.assets[0]?.base64 : null;
    if (base64) await upload(action, base64);
  };

  const capture = async (action: WorkImageAction) => {
    if (!createdBy) {
      setError('Sign in again to upload photos.');
      return;
    }
    setError('');
    if (Platform.OS === 'web') {
      setWebCameraAction(action);
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera permission is required to capture photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      const base64 = !result.canceled ? result.assets[0]?.base64 : null;
      if (base64) await upload(action, base64);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the camera.');
    }
  };

  const remove = async (image: TicketWorkImage) => {
    setDeletingId(image.id);
    setError('');
    try {
      await deleteTicketWorkImage(ticketId, image.id);
      setImages((prev) => prev.filter((item) => item.id !== image.id));
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the photo.');
    } finally {
      setDeletingId(null);
    }
  };

  const busy = uploading !== null || deletingId !== null;

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="image-multiple-outline" size={20} color={Sky} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Work Photos</Text>
          <Text style={styles.subtitle}>{editable ? 'Capture pre, post and service report photos' : 'Photos captured on this ticket'}</Text>
        </View>
        {loading ? <ActivityIndicator size="small" color={Sky} /> : null}
      </View>

      {error ? (
        <Pressable onPress={() => void load()} accessibilityRole="button">
          <Text style={styles.error}>{error} Tap to retry.</Text>
        </Pressable>
      ) : null}

      {Sections.map((section, index) => {
        const list = images.filter((image) => image.action === section.action);
        const done = list.length > 0;
        return (
          <View key={section.action} style={[styles.section, index > 0 && styles.sectionBorder]}>
            <View style={styles.sectionHead}>
              <View style={{ flex: 1 }}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <View style={[styles.countPill, done && styles.countPillDone]}>
                    {done ? <MaterialCommunityIcons name="check" size={11} color={Success} /> : null}
                    <Text style={[styles.countText, done && { color: Success }]}>{list.length}</Text>
                  </View>
                </View>
                <Text style={styles.sectionHint}>{section.hint}</Text>
              </View>
              {editable ? (
                <Pressable
                  onPress={() => void capture(section.action)}
                  disabled={busy}
                  style={({ pressed }) => [styles.captureBtn, busy && styles.captureBtnDisabled, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Capture ${section.title}`}
                >
                  {uploading === section.action ? (
                    <ActivityIndicator size="small" color={Brand.white} />
                  ) : (
                    <MaterialCommunityIcons name={section.icon} size={16} color={Brand.white} />
                  )}
                  <Text style={styles.captureText}>{uploading === section.action ? 'Uploading' : 'Capture'}</Text>
                </Pressable>
              ) : null}
            </View>

            {list.length > 0 ? (
              <View style={styles.thumbs}>
                {list.map((image) => (
                  <Pressable
                    key={image.id}
                    onPress={() => setPreview(image)}
                    style={({ pressed }) => [styles.thumbWrap, pressed && styles.pressed]}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`View ${section.title}`}
                  >
                    <Image source={{ uri: image.url }} style={styles.thumb} resizeMode="cover" />
                    {editable ? (
                      <Pressable
                        onPress={() => void remove(image)}
                        disabled={busy}
                        style={styles.thumbDelete}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${section.title}`}
                      >
                        {deletingId === image.id ? (
                          <ActivityIndicator size="small" color={Brand.white} />
                        ) : (
                          <Ionicons name="close" size={13} color={Brand.white} />
                        )}
                      </Pressable>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : !loading ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="image-off-outline" size={18} color={Muted} />
                <Text style={styles.emptyText}>No {section.title.toLowerCase()} yet</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <WebCameraModal
        visible={webCameraAction !== null}
        title={`Capture ${Sections.find((s) => s.action === webCameraAction)?.title ?? 'Photo'}`}
        onCancel={() => setWebCameraAction(null)}
        onCapture={(dataUrl) => {
          const action = webCameraAction;
          setWebCameraAction(null);
          if (action) void upload(action, dataUrl.replace(/^data:[^;]+;base64,/, ''));
        }}
        onPickFile={() => {
          if (webCameraAction) void pickFromFiles(webCameraAction);
        }}
      />

      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.previewBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreview(null)} accessibilityLabel="Close preview" />
          {preview ? (
            <View style={styles.previewCard}>
              <Image source={{ uri: preview.url }} style={styles.previewImage} resizeMode="contain" />
              <View style={styles.previewBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle}>
                    {Sections.find((s) => s.action === preview.action)?.title ?? 'Photo'}
                  </Text>
                  <Text style={styles.previewMeta}>{[preview.date, preview.time.slice(0, 5)].filter(Boolean).join('  •  ')}</Text>
                </View>
                {editable ? (
                  <Pressable
                    onPress={() => void remove(preview)}
                    disabled={busy}
                    style={({ pressed }) => [styles.previewDelete, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    {deletingId === preview.id ? (
                      <ActivityIndicator size="small" color={Danger} />
                    ) : (
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={Danger} />
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setPreview(null)}
                  style={({ pressed }) => [styles.previewClose, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={20} color={Slate} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  card: { backgroundColor: Brand.white, borderRadius: 18, borderWidth: 1, borderColor: Line, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4FD',
  },
  title: { color: Ink, fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  subtitle: { color: Slate, fontSize: 11.5, fontFamily: 'Poppins_400Regular' },
  error: { color: '#B91C1C', fontSize: 12.5, fontFamily: 'Poppins_500Medium', marginTop: 12 },
  section: { paddingTop: 14, marginTop: 14 },
  sectionBorder: { borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: Ink, fontSize: 14.5, fontFamily: 'Poppins_600SemiBold' },
  sectionHint: { color: Slate, fontSize: 11.5, fontFamily: 'Poppins_400Regular' },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  countPillDone: { backgroundColor: '#E7F7F0' },
  countText: { color: Slate, fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Navy,
  },
  captureBtnDisabled: { opacity: 0.6 },
  captureText: { color: Brand.white, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  thumbWrap: { width: 84, height: 84, borderRadius: 14, overflow: 'hidden', backgroundColor: '#EEF2F7' },
  thumb: { width: '100%', height: '100%' },
  thumbDelete: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D8E0EA',
    backgroundColor: '#F8FAFD',
  },
  emptyText: { color: Muted, fontSize: 12.5, fontFamily: 'Poppins_500Medium' },
  previewBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.8)' },
  previewCard: { width: '100%', maxWidth: 520, borderRadius: 20, overflow: 'hidden', backgroundColor: Brand.white },
  previewImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#0F172A' },
  previewBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  previewTitle: { color: Ink, fontSize: 14.5, fontFamily: 'Poppins_600SemiBold' },
  previewMeta: { color: Slate, fontSize: 11.5, fontFamily: 'Poppins_400Regular' },
  previewDelete: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  previewClose: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
});
