import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import { fetchEmployeeConcernDetails, fetchEmployeeConcerns, submitEmployeeConcern, CONCERN_EMPLOYEE_ID, type EmployeeConcern } from '../api/concerns';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F4F6FA';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E5E9F0';
const Danger = '#DC2626';
const Success = '#059669';
const Amber = '#B45309';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

const cardShadow = brandShadow('0 2px 8px rgba(15, 23, 42, 0.05)', {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 1,
});

type HelpDeskScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatConcernWhen(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const hours = Number(hour);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${String(Number(day)).padStart(2, '0')} ${months[Number(month) - 1]} ${year}, ${hour12}:${minute} ${suffix}`;
}

function isClosed(status: string) {
  const normalized = status.toLowerCase();
  return normalized.includes('close') || normalized.includes('resolv') || normalized.includes('complete');
}

function statusTone(status: string) {
  if (isClosed(status)) return { label: 'Closed', color: Success, tint: '#E7F6EF' };
  if (!status || status.toLowerCase() === 'new') return { label: 'New', color: Sky, tint: '#EAF3FC' };
  return { label: status, color: Amber, tint: '#FFF4E0' };
}

export function HelpDeskScreen({ user, onBack }: HelpDeskScreenProps) {
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EmployeeConcern | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [concerns, setConcerns] = useState<EmployeeConcern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState(user.username.trim().toUpperCase());
  const [mobile, setMobile] = useState((user.phone ?? '').replace(/\D/g, '').slice(0, 10));
  const [issue, setIssue] = useState('');
  const [imageName, setImageName] = useState<string | null>(null);
  const [attachment, setAttachment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const listRef = useRef<ScrollView>(null);

  const loadConcerns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchEmployeeConcerns(Number(CONCERN_EMPLOYEE_ID));
      setConcerns(rows);
      listRef.current?.scrollTo({ y: 0, animated: false });
    } catch (loadError) {
      setConcerns([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load concerns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showForm) return;
    void loadConcerns();
  }, [loadConcerns, showForm]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  });

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    const dataUrl = asset.base64 ? `data:${mime};base64,${asset.base64}` : '';
    if (dataUrl.length > 5_000_000) {
      setImageName(null);
      setAttachment('');
      setFormError('Please choose a smaller image.');
      return;
    }
    setFormError('');
    setImageName(asset.fileName ?? 'Image selected');
    setAttachment(dataUrl);
  }

  function removeImage() {
    setImageName(null);
    setAttachment('');
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!name.trim()) {
      setFormError('Please enter your name.');
      return;
    }
    if (mobile.length < 10) {
      setFormError('Please enter a valid mobile number.');
      return;
    }
    if (!issue.trim()) {
      setFormError('Please describe the issue.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await submitEmployeeConcern({
        name: name.trim(),
        mobile,
        issue: issue.trim(),
        attachment,
      });
      setIssue('');
      removeImage();
      setShowForm(false);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to submit the concern.');
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    if (submitting) return;
    if (showForm) {
      setShowForm(false);
      setFormError('');
      return;
    }
    if (detailId != null) {
      setDetailId(null);
      setDetail(null);
      setDetailError('');
      return;
    }
    onBack();
  }

  async function openDetails(id: number) {
    setDetailId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      setDetail(await fetchEmployeeConcernDetails(id));
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Unable to load concern details.');
    } finally {
      setDetailLoading(false);
    }
  }

  const title = showForm ? 'Raise an Issue' : detailId != null ? 'Issue Details' : 'Help Desk';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={goBack} style={styles.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {showForm ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.card, cardShadow]}>
              <SectionTitle icon="account-outline" title="Your details" />
              <Field
                label="Name"
                value={name}
                autoCapitalize="characters"
                onChangeText={(value) => setName(value.toUpperCase())}
              />
              <Field
                label="Mobile number"
                value={mobile}
                keyboardType="phone-pad"
                placeholder="10-digit mobile number"
                onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
              />
            </View>

            <View style={[styles.card, cardShadow]}>
              <SectionTitle icon="message-alert-outline" title="Issue" />
              <Field
                label="Describe the issue"
                value={issue}
                multiline
                placeholder="What went wrong? Add as much detail as you can…"
                onChangeText={setIssue}
              />

              <Text style={styles.inputLabel}>Attachment (optional)</Text>
              {attachment ? (
                <View style={styles.attachRow}>
                  <Image source={{ uri: attachment }} style={styles.attachThumb} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachName} numberOfLines={1}>
                      {imageName}
                    </Text>
                    <View style={styles.attachActions}>
                      <Pressable onPress={() => void pickImage()} hitSlop={6} accessibilityRole="button">
                        <Text style={styles.attachLink}>Change</Text>
                      </Pressable>
                      <Pressable onPress={removeImage} hitSlop={6} accessibilityRole="button">
                        <Text style={[styles.attachLink, { color: Danger }]}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => void pickImage()}
                  style={({ pressed }) => [styles.uploadBox, pressed && { backgroundColor: '#EEF5FD' }]}
                  accessibilityRole="button"
                  accessibilityLabel="Upload image"
                >
                  <MaterialCommunityIcons name="image-plus" size={24} color={Sky} />
                  <Text style={styles.uploadText}>Add a photo of the issue</Text>
                </Pressable>
              )}
            </View>

            {formError ? <ErrorBox text={formError} /> : null}
          </ScrollView>

          <SafeAreaView edges={['bottom']} style={styles.footer}>
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={submitting}
              style={({ pressed }) => [styles.primaryBtn, submitting && { opacity: 0.7 }, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={Brand.white} />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color={Brand.white} />
                  <Text style={styles.primaryBtnText}>Submit Issue</Text>
                </>
              )}
            </Pressable>
          </SafeAreaView>
        </KeyboardAvoidingView>
      ) : detailId != null ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {detailLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={Sky} />
            </View>
          ) : detailError ? (
            <ErrorBox text={detailError} />
          ) : detail ? (
            <>
              <View style={[styles.card, cardShadow]}>
                <View style={styles.cardTop}>
                  <Text style={styles.detailLabel}>Issue #{detail.id}</Text>
                  <StatusChip status={detail.status} />
                </View>
                <Text style={styles.detailIssue}>{detail.issue || 'No issue text.'}</Text>
                <View style={styles.divider} />
                <InfoRow icon="account-outline" label="Raised by" value={detail.name} />
                {detail.mobile ? <InfoRow icon="phone-outline" label="Mobile" value={detail.mobile} /> : null}
                <InfoRow icon="calendar-blank-outline" label="Created" value={detail.createdAt ? formatConcernWhen(detail.createdAt) : '—'} />
              </View>

              {detail.attachment ? (
                <View style={[styles.card, cardShadow]}>
                  <SectionTitle icon="paperclip" title="Attachment" />
                  <Pressable
                    onPress={() => void Linking.openURL(detail.attachment!)}
                    accessibilityRole="button"
                    accessibilityLabel="Open attachment"
                  >
                    <Image source={{ uri: detail.attachment }} style={styles.attachmentPhoto} resizeMode="cover" />
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.flex}>
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={Sky} />
            </View>
          ) : concerns.length === 0 ? (
            <View style={styles.centerBox}>
              <MaterialCommunityIcons name={error ? 'cloud-alert-outline' : 'lifebuoy'} size={40} color={Muted} />
              <Text style={styles.emptyTitle}>{error ? 'Unable to load issues' : 'No issues raised'}</Text>
              <Text style={styles.emptyText}>{error || 'Tap + to raise a new issue.'}</Text>
              {error ? (
                <Pressable onPress={() => void loadConcerns()} style={styles.retryBtn} accessibilityRole="button">
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <ScrollView ref={listRef} contentContainerStyle={[styles.content, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
              {error ? <ErrorBox text={error} /> : null}
              <Text style={styles.listCount}>
                {concerns.length} {concerns.length === 1 ? 'issue' : 'issues'}
              </Text>
              {concerns.map((concern) => (
                <Pressable
                  key={concern.id}
                  onPress={() => void openDetails(concern.id)}
                  style={({ pressed }) => [styles.card, cardShadow, pressed && { backgroundColor: '#F8FAFD' }]}
                  accessibilityRole="button"
                  accessibilityLabel="View details"
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {concern.issue || 'No description'}
                    </Text>
                    <StatusChip status={concern.status} />
                  </View>
                  {concern.createdAt ? <MetaRow icon="calendar-blank-outline" text={formatConcernWhen(concern.createdAt)} /> : null}
                  {concern.mobile ? <MetaRow icon="phone-outline" text={concern.mobile} /> : null}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardId}>#{concern.id}</Text>
                    <View style={styles.viewLink}>
                      <Text style={styles.viewLinkText}>View details</Text>
                      <Ionicons name="chevron-forward" size={15} color={Sky} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <SafeAreaView edges={['bottom']} style={styles.fabBar}>
            <Pressable
              onPress={() => setShowForm(true)}
              accessibilityRole="button"
              accessibilityLabel="Raise an issue"
              style={({ pressed }) => [
                styles.fab,
                brandShadow('0 6px 14px rgba(11, 53, 110, 0.25)', {
                  shadowColor: Navy,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 6,
                }),
                pressed && { opacity: 0.9 },
              ]}
            >
              <MaterialCommunityIcons name="plus" size={28} color={Brand.white} />
            </Pressable>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone = statusTone(status);
  return (
    <View style={[styles.status, { backgroundColor: tone.tint }]}>
      <Text style={[styles.statusText, { color: tone.color }]} numberOfLines={1}>
        {tone.label}
      </Text>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: McIcon; title: string }) {
  return (
    <View style={styles.sectionRow}>
      <MaterialCommunityIcons name={icon} size={18} color={Sky} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function MetaRow({ icon, text }: { icon: McIcon; text: string }) {
  return (
    <View style={styles.metaRow}>
      <MaterialCommunityIcons name={icon} size={15} color={Muted} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: McIcon; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={17} color={Muted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ErrorBox({ text }: { text: ReactNode }) {
  return (
    <View style={styles.errorBox}>
      <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Danger} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'characters' | 'sentences';
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? (multiline ? 'sentences' : 'none')}
        autoCorrect={false}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={placeholder}
        placeholderTextColor={Muted}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PageBg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: Brand.white, fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 40, paddingVertical: 40 },
  emptyTitle: { marginTop: 8, color: Ink, fontSize: 16, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
  emptyText: { color: Slate, fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10, backgroundColor: Sky },
  retryText: { color: Brand.white, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  listCount: { color: Slate, fontSize: 12.5, fontFamily: 'Poppins_500Medium' },
  card: { backgroundColor: Brand.white, borderRadius: 14, borderWidth: 1, borderColor: Line, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  cardTitle: { flex: 1, color: Ink, fontSize: 15, lineHeight: 21, fontFamily: 'Poppins_600SemiBold' },
  status: { maxWidth: '40%', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { flex: 1, color: Slate, fontSize: 12.5, fontFamily: 'Poppins_400Regular' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },
  cardId: { color: Muted, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  viewLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewLinkText: { color: Sky, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  detailLabel: { flex: 1, color: Muted, fontSize: 12.5, fontFamily: 'Poppins_500Medium' },
  detailIssue: { color: Ink, fontSize: 15, lineHeight: 22, fontFamily: 'Poppins_500Medium', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#EEF1F5', marginVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  infoLabel: { width: 84, color: Slate, fontSize: 12.5, fontFamily: 'Poppins_400Regular' },
  infoValue: { flex: 1, color: Ink, fontSize: 13.5, fontFamily: 'Poppins_500Medium', textAlign: 'right' },
  attachmentPhoto: { width: '100%', height: 260, borderRadius: 10, backgroundColor: '#E5E7EB' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { flex: 1, color: Ink, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  field: { marginBottom: 12 },
  inputLabel: { color: '#334155', fontSize: 12.5, fontFamily: 'Poppins_500Medium', marginBottom: 6 },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: '#F8FAFC',
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  inputMultiline: { minHeight: 110 },
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C7D7EA',
    backgroundColor: '#FBFCFE',
  },
  uploadText: { color: Sky, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  attachThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#EEF2F7' },
  attachName: { color: Ink, fontSize: 13, fontFamily: 'Poppins_500Medium' },
  attachActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  attachLink: { color: Sky, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FDECEC',
  },
  errorText: { flex: 1, color: '#9F1239', fontSize: 12.5, fontFamily: 'Poppins_500Medium' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: Brand.white,
    borderTopWidth: 1,
    borderTopColor: Line,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Navy,
  },
  primaryBtnText: { color: Brand.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  fabBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingRight: 20,
    paddingBottom: 16,
    pointerEvents: 'box-none',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Navy,
  },
});
