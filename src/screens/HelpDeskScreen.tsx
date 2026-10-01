import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { AryadiLogo } from '../components/AryadiLogo';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const Label = '#7A8CA5';

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
  return `${Number(day)} ${months[Number(month) - 1]} ${year}, ${String(hour12).padStart(2, '0')}:${minute} ${suffix}`;
}

function detailStatusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('close') || normalized.includes('resolv') || normalized.includes('complete')) return 'Closed';
  return 'Under Process';
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('close') || normalized.includes('resolv') || normalized.includes('complete')) {
    return { backgroundColor: '#DDF6E8', color: '#16A34A' };
  }
  return { backgroundColor: '#1E88E5', color: Brand.white };
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
      if (showForm) {
        setShowForm(false);
        return true;
      }
      if (detailId != null) {
        setDetailId(null);
        setDetail(null);
        setDetailError('');
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [detailId, onBack, showForm]);

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
      setImageName(null);
      setAttachment('');
      setShowForm(false);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to submit the concern.');
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    if (showForm) {
      setShowForm(false);
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

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>{detailId != null && !showForm ? 'Details' : 'Help Desk'}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {showForm ? null : detailId != null ? (
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailPage} showsVerticalScrollIndicator={false}>
          {detailLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={LogoMid} />
            </View>
          ) : detailError ? (
            <Text style={styles.listError}>{detailError}</Text>
          ) : detail ? (
            <>
              <View
                style={[
                  styles.detailCard,
                  brandShadow('0 6px 16px rgba(15, 23, 42, 0.06)', {
                    shadowColor: '#0F172A',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.06,
                    shadowRadius: 10,
                    elevation: 2,
                  }),
                ]}
              >
                <View style={styles.detailTop}>
                  <View style={styles.detailIdentity}>
                    <Text style={styles.detailName}>{detail.name}</Text>
                    {detail.mobile ? <Text style={styles.detailPhone}>{detail.mobile}</Text> : null}
                  </View>
                  <View
                    style={[
                      styles.processChip,
                      { borderColor: detailStatusLabel(detail.status) === 'Closed' ? '#16A34A' : '#E53935' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.processText,
                        { color: detailStatusLabel(detail.status) === 'Closed' ? '#16A34A' : '#E53935' },
                      ]}
                    >
                      {detailStatusLabel(detail.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.createdLabel}>Created</Text>
                <Text style={styles.createdValue}>{detail.createdAt ? formatConcernWhen(detail.createdAt) : '—'}</Text>
                <Text style={styles.createdLabel}>Issue</Text>
                <Text style={styles.detailIssue}>{detail.issue || 'No issue text.'}</Text>
              </View>
              {detail.attachment ? (
                <View
                  style={[
                    styles.detailCard,
                    brandShadow('0 6px 16px rgba(15, 23, 42, 0.06)', {
                      shadowColor: '#0F172A',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.06,
                      shadowRadius: 10,
                      elevation: 2,
                    }),
                  ]}
                >
                  <Text style={styles.attachmentTitle}>Attachment</Text>
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
        <View style={styles.blank}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={LogoMid} />
            </View>
          ) : (
            <ScrollView ref={listRef} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {error ? <Text style={styles.listError}>{error}</Text> : null}
              {concerns.map((concern) => {
                const tone = statusTone(concern.status);
                return (
                  <View
                    key={concern.id}
                    style={[
                      styles.concernCard,
                      brandShadow('0 8px 16px rgba(11, 53, 110, 0.08)', {
                        shadowColor: LogoNavy,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.08,
                        shadowRadius: 10,
                        elevation: 3,
                      }),
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.concernName} numberOfLines={2}>
                        {concern.name}
                      </Text>
                      <View style={[styles.statusChip, { backgroundColor: tone.backgroundColor }]}>
                        <Text style={[styles.statusText, { color: tone.color }]}>{concern.status}</Text>
                      </View>
                    </View>
                    {concern.mobile ? (
                      <View style={styles.metaRow}>
                        <MaterialCommunityIcons name="phone" size={16} color="#8AA0B5" />
                        <Text style={styles.metaText}>{concern.mobile}</Text>
                      </View>
                    ) : null}
                    {concern.createdAt ? (
                      <View style={styles.metaRow}>
                        <MaterialCommunityIcons name="calendar-month-outline" size={16} color="#8AA0B5" />
                        <Text style={styles.metaText}>{formatConcernWhen(concern.createdAt)}</Text>
                      </View>
                    ) : null}
                    {concern.issue ? (
                      <Text style={styles.issuePreview} numberOfLines={2}>
                        {concern.issue}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => void openDetails(concern.id)}
                      accessibilityRole="button"
                      accessibilityLabel="View details"
                      style={styles.detailsWrap}
                    >
                      <LinearGradient colors={['#1E88E5', '#42A5F5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.detailsBtn}>
                        <Text style={styles.detailsText}>VIEW DETAILS</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <SafeAreaView edges={['bottom']} style={styles.fabWrap} pointerEvents="box-none">
            <Pressable
              onPress={() => setShowForm(true)}
              accessibilityRole="button"
              accessibilityLabel="Add issue"
              style={[
                styles.fab,
                brandShadow('0 8px 12px rgba(11, 53, 110, 0.28)', {
                  shadowColor: LogoNavy,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.28,
                  shadowRadius: 8,
                  elevation: 8,
                }),
              ]}
            >
              <LinearGradient colors={[LogoNavy, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabFill}>
                <MaterialCommunityIcons name="plus" size={28} color={Brand.white} />
              </LinearGradient>
            </Pressable>
          </SafeAreaView>
        </View>
      )}

      {showForm ? (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.logoCard,
              brandShadow('0 6px 10px rgba(0, 0, 0, 0.08)', {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 4,
              }),
            ]}
          >
            <AryadiLogo width={150} height={40} />
          </View>

          <View
            style={[
              styles.card,
              brandShadow('0 12px 18px rgba(10, 29, 55, 0.08)', {
                shadowColor: Brand.navy,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.08,
                shadowRadius: 14,
                elevation: 8,
              }),
            ]}
          >
            <UnderlineField
              label="Name"
              value={name}
              autoCapitalize="characters"
              onChangeText={(value) => setName(value.toUpperCase())}
            />
            <UnderlineField
              label="Mobile"
              value={mobile}
              keyboardType="phone-pad"
              onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
            />
            <UnderlineField label="Issue" value={issue} multiline onChangeText={setIssue} />

            <View style={styles.uploadBox}>
              <Text style={styles.uploadHint}>{imageName ? 'Image selected' : 'Upload Issue Image'}</Text>
              <Pressable
                onPress={pickImage}
                accessibilityRole="button"
                accessibilityLabel="Upload image"
                style={styles.uploadBtn}
              >
                <Text style={styles.uploadBtnText}>{imageName ? 'CHANGE IMAGE' : 'UPLOAD IMAGE'}</Text>
              </Pressable>
            </View>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Pressable
              onPress={() => void handleSubmit()}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit"
              style={styles.submitWrap}
            >
              <LinearGradient colors={[LogoNavy, '#1568B8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                {submitting ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.submitText}>SUBMIT</Text>}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}

function UnderlineField({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'characters' | 'sentences';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? (multiline ? 'sentences' : 'none')}
        autoCorrect={false}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder=""
        placeholderTextColor={Label}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline ? styles.issueInput : styles.singleInput,
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
      <View style={styles.underline} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  flex: {
    flex: 1,
  },
  blank: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  listError: {
    marginBottom: 10,
    color: '#E11D48',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  concernCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEF3F8',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  concernName: {
    flex: 1,
    marginRight: 10,
    color: '#1A1A1A',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    textTransform: 'uppercase',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#5C6B7A',
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  issuePreview: {
    marginTop: 10,
    color: LogoNavy,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Poppins_500Medium',
  },
  detailsWrap: {
    marginTop: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  detailsBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsText: {
    color: Brand.white,
    fontSize: 14,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_700Bold',
  },
  detailScroll: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  detailPage: {
    padding: 12,
    paddingBottom: 24,
  },
  detailCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  detailTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIdentity: {
    flex: 1,
    marginRight: 10,
  },
  detailName: {
    color: '#111827',
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    textTransform: 'uppercase',
  },
  detailPhone: {
    marginTop: 2,
    color: '#4B5563',
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
  },
  processChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Brand.white,
  },
  processText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  createdLabel: {
    marginTop: 18,
    color: '#9AA3AD',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  createdValue: {
    marginTop: 2,
    color: '#111827',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  detailIssue: {
    marginTop: 2,
    color: '#1F2937',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Poppins_500Medium',
  },
  attachmentTitle: {
    marginBottom: 12,
    color: '#111827',
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  attachmentPhoto: {
    width: '100%',
    height: 280,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  fabWrap: {
    position: 'absolute',
    right: 18,
    bottom: 18,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  fabFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 6,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  formScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: 'center',
  },
  logoCard: {
    backgroundColor: Brand.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    marginTop: 14,
    backgroundColor: Brand.white,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: Label,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    marginBottom: 6,
  },
  input: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
    padding: 0,
  },
  singleInput: {
    height: 28,
  },
  issueInput: {
    height: 96,
    paddingTop: 4,
  },
  underline: {
    height: 2,
    backgroundColor: LogoMid,
  },
  uploadBox: {
    borderWidth: 1.6,
    borderColor: 'rgba(58, 171, 242, 0.75)',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  uploadHint: {
    color: Label,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  uploadBtn: {
    marginTop: 10,
    width: '100%',
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: LogoMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: {
    color: LogoMid,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  submitWrap: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submit: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formError: {
    marginTop: 12,
    color: '#E11D48',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  submitText: {
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
});
