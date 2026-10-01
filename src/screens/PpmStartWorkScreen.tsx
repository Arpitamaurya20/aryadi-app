import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PpmTicketDetail } from '../api/ppmTickets';
import {
  deletePpmTicketImage,
  fetchPpmServiceReportForm,
  fetchPpmTicketImages,
  submitPpmTicketClosure,
  uploadPpmTicketImage,
  type PpmImageAction,
  type PpmServiceReportForm,
  type PpmTicketImage,
} from '../api/ppmWork';
import { WebCameraModal } from '../components/WebCameraModal';
import { Brand } from '../theme/colors';
import { PpmServiceReportScreen } from './PpmServiceReportScreen';

const HeaderBlue = '#0284C7';
const Navy = '#0B356E';
const CaptureBlue = '#2196F3';
const CardBorder = '#3AABF2';
const Danger = '#E11D48';
const Success = '#2E7D32';
const SubmitPink = '#E91E63';
const MaxBase64Length = 6_500_000;

const captureRows: { action: PpmImageAction; label: string }[] = [
  { action: 'pre_img', label: 'Pre Image' },
  { action: 'post_img', label: 'Post Image' },
  { action: 'Service_Report', label: 'Service Report' },
];

type ChecklistState = {
  /** A checklist with items is mapped to the ticket's asset */
  mapped: boolean;
  /** The checklist report has been saved for this ticket */
  saved: boolean;
  /** Mandatory checklist items that still have no answer */
  pending: string[];
};

function checklistState(report: PpmServiceReportForm): ChecklistState {
  const mapped = report.useDynamic && report.items.length > 0;
  return {
    mapped,
    saved: mapped && report.dynamicReportId > 0,
    pending: report.items.filter((item) => item.mandatory && !item.value.trim()).map((item) => item.name),
  };
}

function isChecklistComplete(state: ChecklistState) {
  return state.mapped && state.saved && state.pending.length === 0;
}

type PpmStartWorkScreenProps = {
  detail: PpmTicketDetail;
  createdBy: string;
  onBack: () => void;
  onClosed: () => void;
};

export function PpmStartWorkScreen({ detail, createdBy, onBack, onClosed }: PpmStartWorkScreenProps) {
  const [images, setImages] = useState<PpmTicketImage[]>([]);
  const [checklist, setChecklist] = useState<ChecklistState>({ mapped: true, saved: false, pending: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState<PpmImageAction | null>(null);
  const [webCameraAction, setWebCameraAction] = useState<PpmImageAction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [imageList, report] = await Promise.all([
        fetchPpmTicketImages(detail.id),
        fetchPpmServiceReportForm(detail.id),
      ]);
      setImages(imageList);
      setChecklist(checklistState(report));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load ticket work details.');
    } finally {
      setLoading(false);
    }
  }, [detail.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (showReport) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirmSubmit) {
        setConfirmSubmit(false);
      } else if (!submitting) {
        onBack();
      }
      return true;
    });
    return () => sub.remove();
  }, [showReport, confirmSubmit, submitting, onBack]);

  const hasImage = (action: PpmImageAction) => images.some((img) => img.action === action);
  const hasChecklist = checklist.mapped;
  const reportDone = isChecklistComplete(checklist);
  const imagesDone = captureRows.every((row) => hasImage(row.action));
  const canSubmit = imagesDone && reportDone;
  const submitHint = !checklist.mapped
    ? 'This ticket cannot be closed because no checklist is mapped to its asset.'
    : !checklist.saved
      ? 'Fill and save the checklist in the service report to close this ticket.'
      : checklist.pending.length
        ? `Complete the checklist before closing: ${checklist.pending.join(', ')}`
        : !imagesDone
          ? 'Capture all images to close this ticket.'
          : '';

  const pickerOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.4, base64: true };

  const uploadImage = async (action: PpmImageAction, base64: string) => {
    if (base64.length > MaxBase64Length) {
      setMessage({ tone: 'error', text: 'Image is too large. Please capture it again.' });
      return;
    }
    setUploading(action);
    try {
      await uploadPpmTicketImage({ ticketId: detail.id, action, base64, createdBy });
      setImages(await fetchPpmTicketImages(detail.id));
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not upload the image.' });
    } finally {
      setUploading(null);
    }
  };

  const pickFromFiles = async (action: PpmImageAction) => {
    setWebCameraAction(null);
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    const base64 = !result.canceled ? result.assets[0]?.base64 : null;
    if (base64) await uploadImage(action, base64);
  };

  const handleCapture = async (action: PpmImageAction) => {
    if (!createdBy) {
      setMessage({ tone: 'error', text: 'Sign in again to upload images.' });
      return;
    }
    setMessage(null);
    if (Platform.OS === 'web') {
      setWebCameraAction(action);
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setMessage({ tone: 'error', text: 'Camera permission is required to capture images.' });
        return;
      }
      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      const base64 = !result.canceled ? result.assets[0]?.base64 : null;
      if (base64) await uploadImage(action, base64);
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not open the camera.' });
    }
  };

  const handleDelete = async (image: PpmTicketImage) => {
    setMessage(null);
    setDeletingId(image.id);
    try {
      await deletePpmTicketImage(detail.id, image.id);
      setImages((prev) => prev.filter((img) => img.id !== image.id));
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not delete the image.' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const latest = checklistState(await fetchPpmServiceReportForm(detail.id));
      setChecklist(latest);
      if (!isChecklistComplete(latest)) {
        setConfirmSubmit(false);
        setMessage({ tone: 'error', text: 'Fill the complete checklist before closing this ticket.' });
        return;
      }
      await submitPpmTicketClosure(detail.id);
      setConfirmSubmit(false);
      onClosed();
    } catch (e) {
      setConfirmSubmit(false);
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'Could not submit the ticket.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (showReport) {
    return (
      <PpmServiceReportScreen
        ticketId={detail.id}
        ticketCode={detail.ticketCode}
        createdBy={createdBy}
        onBack={() => setShowReport(false)}
        onSaved={() => {
          setShowReport(false);
          setMessage({ tone: 'success', text: 'Service report saved.' });
          void fetchPpmServiceReportForm(detail.id)
            .then((report) => setChecklist(checklistState(report)))
            .catch(() => setChecklist((prev) => ({ ...prev, saved: true, pending: [] })));
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.headerContainer}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.headerIcon} hitSlop={12} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={26} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Ticket Information</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.ticketCode}>{detail.ticketCode}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Assigned To</Text>
            <Text style={styles.summaryValue}>{detail.employee.toUpperCase() || 'Not Set'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Status</Text>
            <Text style={styles.summaryValue}>{detail.status || 'Not Set'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Due Date</Text>
            <Text style={styles.summaryValue}>{detail.dueDate || 'Not Set'}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={HeaderBlue} />
            <Text style={styles.muted}>Loading...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <Text style={[styles.muted, { color: Danger }]}>{loadError}</Text>
            <Pressable onPress={() => void load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {captureRows.map((row) => (
              <View key={row.action} style={styles.captureCard}>
                <Text style={styles.captureLabel}>
                  {row.label} <Text style={styles.star}>*</Text>
                </Text>
                <View style={styles.checkSlot}>
                  {hasImage(row.action) ? (
                    <MaterialCommunityIcons name="check-circle" size={22} color={Success} />
                  ) : null}
                </View>
                <Pressable
                  onPress={() => void handleCapture(row.action)}
                  disabled={uploading !== null}
                  style={({ pressed }) => [styles.captureBtn, (pressed || uploading === row.action) && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Capture ${row.label}`}
                >
                  {uploading === row.action ? (
                    <ActivityIndicator color={Brand.white} size="small" />
                  ) : (
                    <Text style={styles.captureBtnText}>CAPTURE</Text>
                  )}
                </Pressable>
              </View>
            ))}

            <View style={styles.reportCard}>
              <Text style={styles.reportLabel}>
                Dynamic Services Report <Text style={styles.star}>*</Text>
              </Text>
              <View style={styles.checkSlot}>
                {reportDone ? (
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color={Success} />
                ) : null}
              </View>
              <Pressable
                onPress={() => setShowReport(true)}
                style={({ pressed }) => [styles.updateBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
              >
                <Text style={styles.updateBtnText}>UPDATE</Text>
              </Pressable>
            </View>
            {!hasChecklist ? (
              <View style={styles.noChecklistNote}>
                <MaterialCommunityIcons name="clipboard-alert-outline" size={18} color={Danger} />
                <Text style={styles.noChecklistText}>
                  No checklist is mapped to this asset, so the service report cannot be created and the ticket
                  cannot be submitted.
                </Text>
              </View>
            ) : null}

            {images.length > 0 ? (
              <View style={styles.thumbGrid}>
                {images.map((image) => (
                  <View key={image.id} style={styles.thumbItem}>
                    <View>
                      <Image source={{ uri: image.url }} style={styles.thumb} />
                      <Pressable
                        onPress={() => void handleDelete(image)}
                        disabled={deletingId !== null}
                        style={styles.thumbDelete}
                        hitSlop={8}
                        accessibilityLabel={`Delete ${image.action}`}
                      >
                        {deletingId === image.id ? (
                          <ActivityIndicator color={Danger} size="small" />
                        ) : (
                          <Ionicons name="close" size={14} color={Brand.white} />
                        )}
                      </Pressable>
                    </View>
                    <Text style={styles.thumbLabel}>{image.action}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}

        {message ? (
          <Text style={[styles.message, message.tone === 'error' ? { color: Danger } : { color: Success }]}>
            {message.text}
          </Text>
        ) : null}

        {!canSubmit && !loading && !loadError && submitHint ? (
          <Text style={styles.hint}>{submitHint}</Text>
        ) : null}

        <Pressable
          onPress={() => setConfirmSubmit(true)}
          disabled={!canSubmit || submitting}
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>SUBMIT TICKET</Text>
        </Pressable>
      </ScrollView>

      <WebCameraModal
        visible={webCameraAction !== null}
        title={`Capture ${captureRows.find((row) => row.action === webCameraAction)?.label ?? 'Image'}`}
        onCancel={() => setWebCameraAction(null)}
        onCapture={(dataUrl) => {
          const action = webCameraAction;
          setWebCameraAction(null);
          if (action) void uploadImage(action, dataUrl.replace(/^data:[^;]+;base64,/, ''));
        }}
        onPickFile={() => {
          if (webCameraAction) void pickFromFiles(webCameraAction);
        }}
      />

      <Modal visible={confirmSubmit} transparent animationType="fade" onRequestClose={() => setConfirmSubmit(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submit Ticket?</Text>
            <Text style={styles.modalText}>
              {detail.ticketCode} will be closed. You cannot change the images or report after this.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmSubmit(false)}
                disabled={submitting}
                style={[styles.modalBtn, styles.modalCancel]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSubmit()}
                disabled={submitting}
                style={[styles.modalBtn, styles.modalConfirm]}
              >
                {submitting ? (
                  <ActivityIndicator color={Brand.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  noChecklistNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  noChecklistText: {
    flex: 1,
    color: '#9F1239',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 17,
  },
  screen: { flex: 1, backgroundColor: Brand.white },
  headerContainer: { backgroundColor: HeaderBlue },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, gap: 16 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Brand.white, fontSize: 20, fontFamily: 'Poppins_600SemiBold' },
  content: { padding: 16, paddingBottom: 40 },
  ticketCode: { color: Danger, fontSize: 15, fontFamily: 'Poppins_700Bold', marginBottom: 12 },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 18,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 12 },
  summaryLabel: { color: '#1E293B', fontSize: 14, fontFamily: 'Poppins_400Regular' },
  summaryValue: { color: Navy, fontSize: 14, fontFamily: 'Poppins_700Bold', flexShrink: 1, textAlign: 'right' },
  center: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  muted: { color: '#64748B', fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  retryBtn: { backgroundColor: HeaderBlue, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8 },
  retryText: { color: Brand.white, fontFamily: 'Poppins_500Medium', fontSize: 13 },
  captureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: CardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  captureLabel: { color: Navy, fontSize: 15, fontFamily: 'Poppins_400Regular', width: 140 },
  star: { color: Danger },
  checkSlot: { flex: 1, minWidth: 30, alignItems: 'flex-start', paddingLeft: 8 },
  captureBtn: {
    backgroundColor: CaptureBlue,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 92,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  captureBtnText: { color: Brand.white, fontSize: 14, fontFamily: 'Poppins_500Medium', letterSpacing: 0.5 },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 18,
  },
  reportLabel: { color: '#0F172A', fontSize: 15, fontFamily: 'Poppins_400Regular', flexShrink: 1 },
  updateBtn: {
    backgroundColor: Navy,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  updateBtnText: { color: Brand.white, fontSize: 14, fontFamily: 'Poppins_500Medium', letterSpacing: 0.5 },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingHorizontal: 8, marginBottom: 20 },
  thumbItem: { alignItems: 'center', width: 96 },
  thumb: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: CardBorder, backgroundColor: '#E2E8F0' },
  thumbDelete: {
    position: 'absolute',
    top: -6,
    right: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Danger,
    borderWidth: 3,
    borderColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabel: { color: '#1E293B', fontSize: 14, fontFamily: 'Poppins_400Regular', marginTop: 8 },
  message: { fontSize: 13, fontFamily: 'Poppins_500Medium', textAlign: 'center', marginBottom: 12 },
  hint: { color: '#64748B', fontSize: 12, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginBottom: 10 },
  submitBtn: { backgroundColor: SubmitPink, borderRadius: 24, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { backgroundColor: '#F48FB1' },
  submitText: { color: Brand.white, fontSize: 15, fontFamily: 'Poppins_500Medium', letterSpacing: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: 28 },
  modalCard: { backgroundColor: Brand.white, borderRadius: 16, padding: 20 },
  modalTitle: { color: Navy, fontSize: 17, fontFamily: 'Poppins_700Bold', marginBottom: 8 },
  modalText: { color: '#475569', fontSize: 13, fontFamily: 'Poppins_400Regular', lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancel: { backgroundColor: '#F1F5F9' },
  modalConfirm: { backgroundColor: SubmitPink },
  modalCancelText: { color: '#334155', fontFamily: 'Poppins_500Medium', fontSize: 14 },
  modalConfirmText: { color: Brand.white, fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
});
