import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { AuthUser } from '../api/auth';
import { createHrTicket, fetchHrTickets, type HrTicketCategory, type HrTicketItem } from '../api/hrTicket';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#F4F7FB';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const FieldStroke = '#D5E4F2';
const SickRed = '#E11D48';

const categories: { value: HrTicketCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'payment_related', label: 'Payment Related' },
  { value: 'benefits', label: 'Benefits' },
];

type HRHelpdeskScreenProps = {
  user: AuthUser;
  onBack: () => void;
  onHome?: () => void;
};

export function HRHelpdeskScreen({ user, onBack, onHome }: HRHelpdeskScreenProps) {
  const [tickets, setTickets] = useState<HrTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchHrTickets(user.employeeId, 'Employee');
      setTickets(rows);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [user.employeeId]);

  useEffect(() => {
    if (showForm) return;
    void loadTickets();
  }, [loadTickets, showForm]);

  useEffect(() => {
    if (showForm) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, showForm]);

  if (showForm) {
    return (
      <CreateHrTicketScreen
        employeeId={user.employeeId}
        onBack={() => setShowForm(false)}
        onHome={onHome}
        onCreated={() => setShowForm(false)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={22} color={LogoNavy} />
          </Pressable>
          <Text style={styles.headerTitle}>HR Helpdesk</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={LogoMid} />
            <Text style={styles.loadingText}>Loading HR tickets…</Text>
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="file-document-outline" size={36} color={LogoNavy} />
            </View>
            <Text style={styles.emptyTitle}>No Tickets Found</Text>
            <Text style={styles.emptyText}>
              You haven't raised any helpdesk tickets yet. Tap the button below to submit a concern to HR.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {tickets.map((ticket) => {
              const tone = statusTone(ticket.status);
              return (
                <View
                  key={String(ticket.id)}
                  style={[
                    styles.ticketCard,
                    brandShadow('0 8px 14px rgba(11, 53, 110, 0.08)', {
                      shadowColor: LogoNavy,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.08,
                      shadowRadius: 8,
                      elevation: 3,
                    }),
                  ]}
                >
                  <View style={styles.ticketTop}>
                    <View style={styles.flex}>
                      {ticket.ticketCode ? (
                        <Text style={styles.ticketCode}>{ticket.ticketCode}</Text>
                      ) : null}
                      <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.statusText, { color: tone.fg }]}>{ticket.statusLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.ticketCategory}>{ticket.categoryLabel}</Text>
                  {ticket.description ? (
                    <Text style={styles.ticketMessage} numberOfLines={3}>
                      {ticket.description}
                    </Text>
                  ) : null}
                  {ticket.createdAt ? (
                    <Text style={styles.ticketMeta}>{formatTicketDate(ticket.createdAt)}</Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.fabSafe}>
        <Pressable onPress={() => setShowForm(true)} accessibilityRole="button" accessibilityLabel="Add ticket">
          <LinearGradient
            colors={[LogoSky, LogoMid, LogoNavy]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.fab,
              brandShadow('0 8px 16px rgba(11, 53, 110, 0.28)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.28,
                shadowRadius: 10,
                elevation: 8,
              }),
            ]}
          >
            <MaterialCommunityIcons name="plus" size={28} color={Brand.white} />
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return (
    <Text style={styles.fieldLabel}>
      {text} <Text style={styles.requiredMark}>*</Text>
    </Text>
  );
}

function ConcernArt() {
  return (
    <Svg width={68} height={68} viewBox="0 0 84 84" accessibilityElementsHidden>
      <Circle cx="54" cy="34" r="26" fill="#E7F2FC" />
      <Path d="M62 18c6 2 10 8 10 8-6 1-12-2-14-6 1-1 3-2 4-2z" fill="#D5EBD8" />
      <Rect x="18" y="14" width="40" height="52" rx="8" fill="#FFFFFF" stroke="#D5E6F5" strokeWidth="1.5" />
      <Rect x="26" y="26" width="24" height="3.5" rx="1.5" fill="#D7E6F4" />
      <Rect x="26" y="34" width="16" height="3.5" rx="1.5" fill="#E3EEF8" />
      <Rect x="26" y="42" width="22" height="3.5" rx="1.5" fill="#D7E6F4" />
      <Rect x="26" y="50" width="12" height="3.5" rx="1.5" fill="#E3EEF8" />
      <Circle cx="52" cy="58" r="13" fill="#1264A3" />
      <Circle cx="52" cy="54" r="4" fill="#FFFFFF" />
      <Path d="M44.5 66.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6" fill="#FFFFFF" />
    </Svg>
  );
}

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key.includes('close') || key.includes('resolve')) {
    return { bg: '#DCFCE7', fg: '#15803D' };
  }
  if (key.includes('hold') || key.includes('pending')) {
    return { bg: '#FFF4D6', fg: '#B45309' };
  }
  if (key.includes('progress')) {
    return { bg: SoftBlue, fg: LogoMid };
  }
  return { bg: SoftBlue, fg: LogoMid };
}

function formatTicketDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]}, ${match[1]}`;
}

function CreateHrTicketScreen({
  employeeId,
  onBack,
  onHome,
  onCreated,
}: {
  employeeId: number;
  onBack: () => void;
  onHome?: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<HrTicketCategory>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const { width } = useWindowDimensions();
  const side = width < 360 ? 16 : 20;
  const categoryLabel = categories.find((item) => item.value === category)?.label ?? 'General';
  const needsPaymentRef = category === 'payment_related';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitting) return true;
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, submitting]);

  async function submit() {
    if (submitting) return;
    setFormError('');

    if (!subject.trim()) {
      setFormError('Please enter a subject.');
      return;
    }
    if (!message.trim()) {
      setFormError('Please describe your concern.');
      return;
    }
    if (needsPaymentRef && !paymentReference.trim()) {
      setFormError('Payment reference or month/period is required.');
      return;
    }

    setSubmitting(true);
    try {
      await createHrTicket({
        employeeId,
        category,
        subject: subject.trim(),
        description: message.trim(),
        paymentReference: paymentReference.trim(),
      });
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create HR ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.formScreen}>
      <StatusBar style="light" />
      <View style={styles.formWash} />
      <LinearGradient colors={['#0B2E59', '#124B87']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.formHeader}>
            <Pressable
              onPress={() => {
                if (!submitting) onBack();
              }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.white} />
            </Pressable>
            <Text style={styles.formHeaderTitle}>Create Ticket</Text>
            <Pressable
              onPress={() => {
                if (!submitting) (onHome ?? onBack)();
              }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Home"
            >
              <MaterialCommunityIcons name="home-outline" size={22} color={Brand.white} />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.formContent, { paddingHorizontal: side }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.formColumn, { maxWidth: width > 520 ? 430 : undefined }]}>
          <View
            style={[
              styles.formCard,
              brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 5,
              }),
            ]}
          >
            <View style={styles.formIntro}>
              <View style={styles.formIntroCopy}>
                <View style={styles.headset}>
                  <MaterialCommunityIcons name="headset" size={22} color={Brand.white} />
                </View>
                <Text style={styles.formTitle}>Raise HR Concern</Text>
                <Text style={styles.formHint}>Provide details of your issue below, and HR will review it.</Text>
              </View>
              <View style={styles.formArt}>
                <ConcernArt />
              </View>
            </View>

            <FieldLabel text="CATEGORY" />
            <Pressable
              onPress={() => {
                if (!submitting) setShowCategories(true);
              }}
              style={styles.field}
              accessibilityRole="button"
              accessibilityLabel="Select category"
            >
              <MaterialCommunityIcons name="view-grid-outline" size={18} color="#1264A3" />
              <Text style={styles.fieldValue}>{categoryLabel}</Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color="#7187A3" />
            </Pressable>

            {needsPaymentRef ? (
              <>
                <FieldLabel text="PAYMENT REFERENCE" />
                <View style={styles.field}>
                  <MaterialCommunityIcons name="cash" size={18} color={LogoMid} />
                  <TextInput
                    value={paymentReference}
                    onChangeText={(text) => {
                      setPaymentReference(text);
                      if (formError) setFormError('');
                    }}
                    placeholder="Month / period / reference"
                    placeholderTextColor={Mute}
                    style={styles.fieldInput}
                    editable={!submitting}
                  />
                </View>
              </>
            ) : null}

            <FieldLabel text="SUBJECT" />
            <View style={styles.field}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color="#1264A3" />
              <TextInput
                value={subject}
                onChangeText={(text) => {
                  setSubject(text);
                  if (formError) setFormError('');
                }}
                placeholder="Brief summary of concern"
                placeholderTextColor="#7187A3"
                style={styles.fieldInput}
                editable={!submitting}
                accessibilityLabel="Subject"
              />
            </View>

            <FieldLabel text="DESCRIPTION" />
            <View style={[styles.field, styles.descriptionField]}>
              <MaterialCommunityIcons name="file-document-outline" size={18} color="#1264A3" style={styles.descIcon} />
              <View style={styles.descriptionBody}>
                <TextInput
                  value={message}
                  onChangeText={(text) => {
                    setMessage(text.slice(0, 1000));
                    if (formError) setFormError('');
                  }}
                  placeholder="Describe your concern in detail..."
                  placeholderTextColor="#7187A3"
                  style={[styles.fieldInput, styles.descriptionInput]}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                  editable={!submitting}
                  accessibilityLabel="Description"
                />
                <Text style={styles.counter}>{message.length}/1000</Text>
              </View>
            </View>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Pressable
              onPress={() => {
                void submit();
              }}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit HR Ticket"
              accessibilityState={{ disabled: submitting }}
              style={({ pressed }) => [pressed && !submitting ? styles.submitPressed : null, submitting ? styles.submitDisabled : null]}
            >
              <LinearGradient
                colors={['#123F7A', '#168FE0']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.submit,
                  brandShadow('0 8px 14px rgba(18, 63, 122, 0.22)', {
                    shadowColor: '#123F7A',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.22,
                    shadowRadius: 10,
                    elevation: 4,
                  }),
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={Brand.white} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send" size={18} color={Brand.white} />
                    <Text style={styles.submitText}>Submit HR Ticket</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.reassure}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color="#7187A3" />
              <View style={styles.reassureRule} />
              <Text style={styles.reassureText}>Your concern is important to us</Text>
            </View>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCategories} transparent animationType="fade" onRequestClose={() => setShowCategories(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowCategories(false)}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Select category</Text>
            {categories.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => {
                  setCategory(item.value);
                  setShowCategories(false);
                  if (formError) setFormError('');
                }}
                style={[styles.sheetRow, item.value === category ? styles.sheetRowActive : null]}
              >
                <Text style={styles.sheetRowText}>{item.label}</Text>
                {item.value === category ? <MaterialCommunityIcons name="check-circle" size={18} color={LogoMid} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  topBar: {
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: SoftBlue,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: LogoNavy,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  body: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 72,
  },
  loadingText: {
    color: Mute,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 72,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 18,
    color: LogoNavy,
    fontSize: 22,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  emptyText: {
    marginTop: 10,
    color: Mute,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  ticketCard: {
    marginBottom: 12,
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 14,
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  ticketCode: {
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  ticketSubject: {
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  ticketCategory: {
    marginTop: 6,
    color: LogoMid,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  ticketMessage: {
    marginTop: 6,
    color: Mute,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Poppins_400Regular',
  },
  ticketMeta: {
    marginTop: 8,
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  fabSafe: {
    position: 'absolute',
    right: 18,
    bottom: 18,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScreen: {
    flex: 1,
    backgroundColor: '#F3F8FD',
  },
  formWash: {
    position: 'absolute',
    right: -80,
    bottom: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(18, 143, 224, 0.08)',
    pointerEvents: 'none',
  },
  formHeader: {
    minHeight: 56,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  formHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: Brand.white,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  formContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  formColumn: {
    width: '100%',
    flex: 1,
  },
  formCard: {
    flex: 1,
    backgroundColor: Brand.white,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  formIntro: {
    position: 'relative',
    minHeight: 78,
    marginBottom: 0,
  },
  formIntroCopy: {
    paddingRight: 92,
  },
  formArt: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  headset: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1264A3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    marginTop: 8,
    color: '#12345B',
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  formHint: {
    marginTop: 4,
    color: '#7187A3',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },
  fieldLabel: {
    marginTop: 6,
    marginBottom: 4,
    color: '#12345B',
    fontSize: 12,
    letterSpacing: 0.6,
    fontFamily: 'Poppins_600SemiBold',
  },
  requiredMark: {
    color: '#D93025',
  },
  field: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D3E4F4',
    backgroundColor: '#F8FBFE',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldValue: {
    flex: 1,
    color: '#12345B',
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
  },
  fieldInput: {
    flex: 1,
    minHeight: 24,
    paddingVertical: 0,
    color: '#12345B',
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
  },
  descriptionField: {
    flex: 1,
    minHeight: 84,
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingBottom: 8,
  },
  descIcon: {
    marginTop: 2,
  },
  descriptionBody: {
    flex: 1,
    alignSelf: 'stretch',
  },
  descriptionInput: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 64,
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    color: '#7187A3',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  reassure: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  reassureRule: {
    width: 1,
    height: 16,
    backgroundColor: '#C9DCF1',
  },
  reassureText: {
    color: '#7187A3',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  formError: {
    marginTop: 12,
    color: '#D93025',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins_500Medium',
  },
  submit: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitPressed: {
    opacity: 0.88,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: Brand.white,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 53, 110, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 14,
  },
  sheetTitle: {
    marginBottom: 8,
    color: LogoNavy,
    fontSize: 15,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  sheetRow: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: SoftBlue,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetRowActive: {
    borderWidth: 1,
    borderColor: '#BFD8F2',
  },
  sheetRowText: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
});
