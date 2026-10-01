import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import {
  addTicketComment,
  fetchCorporateTicketDetail,
  fetchTicketComments,
  fetchTicketPayments,
  sendStartWorkOtp,
  verifyStartWorkOtp,
  type CorporateTicketDetail,
  type ServiceTicket,
  type TicketComment,
  type TicketPayment,
} from '../api/serviceTickets';
import { formatDisplayDate } from '../components/DateCalendarModal';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { statusTone, typeTone } from '../theme/ticketTones';
import { ConveyanceChargesScreen } from './ConveyanceChargesScreen';
import { SiteVisitsScreen } from './SiteVisitsScreen';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const Danger = '#DC2626';
const Success = '#059669';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];
type SubView = 'conveyance' | 'siteVisit' | null;
type SheetKind = 'info' | 'comments' | 'payments' | 'startWork' | null;

const StartableStatuses = [
  'raised',
  'assigned',
  'generate otp to start',
  'quote approved',
  'escalated',
  'hold by customer',
  'hold by techxpert',
];
const OtpLength = 4;
const ResendSeconds = 30;

const cardShadow = brandShadow('0 6px 18px rgba(11, 53, 110, 0.07)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 2,
});

function displayDate(value?: string) {
  if (!value) return '';
  return formatDisplayDate(value.slice(0, 10)) || value;
}

function joinDateTime(date: string, time: string) {
  return [displayDate(date), time.slice(0, 5)].filter(Boolean).join('  •  ');
}

function formatAmount(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function Card({ icon, iconColor = Sky, iconBg = '#EAF4FD', title, right, children }: {
  icon: McIcon;
  iconColor?: string;
  iconBg?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, wide, onPress }: { label: string; value: string; wide?: boolean; onPress?: () => void }) {
  const body = (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, !value && styles.fieldEmpty, onPress && value ? { color: Sky } : null]}>
        {value || 'Not set'}
      </Text>
    </>
  );
  return onPress && value ? (
    <Pressable onPress={onPress} style={[styles.field, wide && styles.fieldWide]} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    <View style={[styles.field, wide && styles.fieldWide]}>{body}</View>
  );
}

type ServiceTicketDetailScreenProps = {
  ticket: ServiceTicket;
  user?: AuthUser | null;
  onBack: () => void;
};

export function ServiceTicketDetailScreen({ ticket, user, onBack }: ServiceTicketDetailScreenProps) {
  const corporate = ticket.source === 'corporate';
  const closed = ticket.group === 'closed';
  const [detail, setDetail] = useState<CorporateTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(corporate);
  const [detailError, setDetailError] = useState('');
  const [subView, setSubView] = useState<SubView>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [workStarted, setWorkStarted] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!corporate) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      setDetail(await fetchCorporateTicketDetail(ticket.id));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Could not load full ticket details.');
    } finally {
      setDetailLoading(false);
    }
  }, [corporate, ticket.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (subView) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheet) setSheet(null);
      else onBack();
      return true;
    });
    return () => sub.remove();
  }, [subView, sheet, onBack]);

  if (subView === 'conveyance' && user) {
    return (
      <ConveyanceChargesScreen
        user={user}
        defaultReference={ticket.ticketCode}
        ticketReference={ticket.ticketCode}
        readOnly={closed}
        onBack={() => setSubView(null)}
      />
    );
  }

  if (subView === 'siteVisit' && user) {
    return <SiteVisitsScreen user={user} onBack={() => setSubView(null)} />;
  }

  const status = detail?.status || ticket.status;
  const statusColors = statusTone(status);
  const priority = detail?.priority || ticket.priority;
  const dueDate = detail?.dueDate || ticket.dueDate;
  const branch = detail?.branchSite || ticket.site;
  const subService = detail?.subService || ticket.subService;
  const clientTicketId = detail?.clientTicketId || ticket.clientTicketId;
  const address = corporate ? detail?.branchAddress ?? '' : ticket.address;
  const type = typeTone(ticket.type);

  const quoteBanner =
    corporate && detail && !closed
      ? detail.quoteApproved || status.trim().toLowerCase() === 'quote approved'
        ? { tone: 'ok' as const, title: 'Quote Approved', text: 'The client has approved the quotation.' }
        : {
            tone: 'warn' as const,
            title: 'Quote Not Approved',
            text: detail.hasQuotation ? 'Waiting for the client to approve the quotation.' : 'No quotation uploaded yet.',
          }
      : null;

  const canStartWork = corporate && !closed && !!detail && StartableStatuses.includes(status.trim().toLowerCase());

  const operations: { key: string; icon: McIcon; color: string; bg: string; title: string; hint: string; onPress: () => void; hidden?: boolean }[] = [
    {
      key: 'info',
      icon: 'file-document-outline',
      color: Sky,
      bg: '#EAF4FD',
      title: 'View Details',
      hint: 'Every field recorded on this ticket',
      onPress: () => setSheet('info'),
    },
    {
      key: 'site',
      icon: 'map-marker-radius-outline',
      color: Danger,
      bg: '#FDECEC',
      title: 'Site Visit',
      hint: 'Log or review site visits',
      onPress: () => setSubView('siteVisit'),
      hidden: !corporate || !user,
    },
    {
      key: 'conveyance',
      icon: closed ? 'car-clock' : 'car-outline',
      color: '#B45309',
      bg: '#FFF4E0',
      title: closed ? 'Conveyance History' : 'Conveyance',
      hint: closed ? 'View claims made for this ticket' : 'Claim travel charges for this ticket',
      onPress: () => setSubView('conveyance'),
      hidden: !user,
    },
    {
      key: 'comments',
      icon: 'comment-text-multiple-outline',
      color: '#7C3AED',
      bg: '#F1EBFE',
      title: 'Comments',
      hint: 'Conversation on this ticket',
      onPress: () => setSheet('comments'),
      hidden: !corporate,
    },
    {
      key: 'payments',
      icon: 'wallet-outline',
      color: Success,
      bg: '#E7F7F0',
      title: 'Ticket Payment',
      hint: 'Material, labour and visit charges',
      onPress: () => setSheet('payments'),
      hidden: !corporate,
    },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroGlowLarge} />
        <View style={styles.heroGlowSmall} />
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [styles.glassButton, pressed && styles.pressed]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Ticket Details</Text>
            <View style={styles.glassSpacer} />
          </View>

          <View style={styles.identity}>
            <View style={styles.identityTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.identityLabel}>{corporate ? 'Ticket' : 'Booking'}  ·  #{ticket.id}</Text>
                <Text style={styles.identityCode} numberOfLines={2}>
                  {ticket.ticketCode}
                </Text>
              </View>
              <View style={[styles.identityStatus]}>
                <View style={[styles.statusDot, { backgroundColor: statusColors.color }]} />
                <Text style={[styles.identityStatusText, { color: statusColors.color }]} numberOfLines={2}>
                  {status}
                </Text>
              </View>
            </View>
            <View style={styles.identityTags}>
              <View style={[styles.typeTag, { backgroundColor: type.tint }]}>
                <Text style={[styles.typeTagText, { color: type.color }]}>{ticket.type}</Text>
              </View>
              {ticket.service ? (
                <View style={styles.glassTag}>
                  <MaterialCommunityIcons name="tools" size={12} color={Brand.white} />
                  <Text style={styles.glassTagText} numberOfLines={1}>
                    {ticket.service}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.identityStats}>
              <View style={styles.identityStat}>
                <MaterialCommunityIcons name="calendar-clock-outline" size={20} color={Brand.white} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.identityStatLabel}>{corporate ? 'Due date' : 'Booking date'}</Text>
                  <Text style={styles.identityStatValue} numberOfLines={1}>
                    {displayDate(corporate ? dueDate : ticket.date) || 'Not set'}
                  </Text>
                </View>
              </View>
              <View style={styles.identityDivider} />
              <View style={styles.identityStat}>
                <MaterialCommunityIcons
                  name={corporate ? 'flag-outline' : 'cash'}
                  size={20}
                  color={Brand.white}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.identityStatLabel}>{corporate ? 'Priority' : 'Payment'}</Text>
                  <Text style={styles.identityStatValue} numberOfLines={1}>
                    {(corporate ? priority : ticket.paymentStatus) || 'Not set'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {quoteBanner ? (
          <View
            style={[
              styles.banner,
              cardShadow,
              quoteBanner.tone === 'ok' ? styles.bannerOk : styles.bannerWarn,
            ]}
          >
            <View style={[styles.bannerIcon, { backgroundColor: quoteBanner.tone === 'ok' ? '#D1FAE5' : '#FEE2E2' }]}>
              <MaterialCommunityIcons
                name={quoteBanner.tone === 'ok' ? 'check-decagram' : 'alert'}
                size={20}
                color={quoteBanner.tone === 'ok' ? Success : Danger}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{quoteBanner.title}</Text>
              <Text style={styles.bannerText}>{quoteBanner.text}</Text>
            </View>
          </View>
        ) : null}

        {canStartWork ? (
          <Pressable
            onPress={() => setSheet('startWork')}
            style={({ pressed }) => [styles.startWork, cardShadow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Start work"
          >
            <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startWorkInner}>
              <View style={styles.startWorkIcon}>
                <MaterialCommunityIcons name="play-circle" size={26} color={Brand.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.startWorkTitle}>Start Work</Text>
                <Text style={styles.startWorkHint}>Verify with the OTP sent to the branch</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={Brand.white} />
            </LinearGradient>
          </Pressable>
        ) : null}

        {workStarted && !canStartWork ? (
          <View style={[styles.banner, cardShadow, styles.bannerOk]}>
            <View style={[styles.bannerIcon, { backgroundColor: '#D1FAE5' }]}>
              <MaterialCommunityIcons name="progress-wrench" size={20} color={Success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Work started</Text>
              <Text style={styles.bannerText}>OTP verified. The ticket is now Work In Progress.</Text>
            </View>
          </View>
        ) : null}

        {detailLoading ? (
          <View style={styles.inlineNote}>
            <ActivityIndicator size="small" color={Sky} />
            <Text style={styles.inlineNoteText}>Loading full ticket details…</Text>
          </View>
        ) : detailError ? (
          <Pressable onPress={() => void loadDetail()} style={styles.inlineNote} accessibilityRole="button">
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Danger} />
            <Text style={[styles.inlineNoteText, { color: '#9F1239' }]}>{detailError} Tap to retry.</Text>
          </Pressable>
        ) : null}

        {corporate ? (
          <Card icon="office-building-outline" title="Client Overview">
            <View style={styles.grid}>
              <Field label="Company" value={detail?.companyName ?? ''} />
              <Field label="Branch" value={[branch, detail?.branchCode].filter(Boolean).join(' · ')} />
              <Field label="Employee" value={detail?.employeeName ?? ''} />
              <Field label="Client ticket ID" value={clientTicketId} />
            </View>
          </Card>
        ) : (
          <Card icon="account-outline" title="Customer Overview">
            <View style={styles.grid}>
              <Field label="Customer" value={ticket.site} />
              <Field label="City" value={ticket.city} />
              <Field
                label="Phone"
                value={ticket.phone}
                onPress={() => void Linking.openURL(`tel:${ticket.phone}`)}
              />
              <Field label="Email" value={ticket.email} />
            </View>
          </Card>
        )}

        <Card icon="tools" title="Service Specification">
          <View style={styles.grid}>
            <Field label="Type" value={ticket.type} />
            <Field label="Service" value={ticket.service} />
            <Field label="Sub service" value={subService} wide />
            {detail?.equipmentName ? <Field label="Asset" value={detail.equipmentName} wide /> : null}
            {detail?.sparePartStatus ? <Field label="Spare part status" value={detail.sparePartStatus} /> : null}
            <Field
              label={corporate ? 'Booking timeline' : 'Booked for'}
              value={joinDateTime(ticket.date, ticket.time)}
              wide
            />
            {ticket.closeDate ? (
              <Field label="Closed on" value={joinDateTime(ticket.closeDate, ticket.closeTime)} wide />
            ) : null}
          </View>
        </Card>

        {address ? (
          <View style={[styles.addressCard, cardShadow]}>
            <View style={styles.addressIcon}>
              <MaterialCommunityIcons name="map-marker" size={22} color={Danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{corporate ? 'Branch address' : 'Customer address'}</Text>
              <Text style={styles.addressText}>{address}</Text>
              <Pressable
                onPress={() =>
                  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)
                }
                hitSlop={6}
                style={styles.mapLink}
                accessibilityRole="link"
              >
                <MaterialCommunityIcons name="directions" size={15} color={Sky} />
                <Text style={styles.mapLinkText}>Open in Maps</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Card icon="message-text-outline" title={corporate ? 'Message Info' : 'Subject'}>
          <View style={styles.messageBox}>
            <Text style={[styles.messageText, !ticket.message && styles.fieldEmpty]}>
              {ticket.message || 'No message added.'}
            </Text>
          </View>
          {ticket.description && ticket.description !== ticket.message ? (
            <View style={[styles.messageBox, { marginTop: 10 }]}>
              <Text style={styles.fieldLabel}>Description</Text>
              <Text style={styles.messageText}>{ticket.description}</Text>
            </View>
          ) : null}
        </Card>

        <Text style={styles.sectionLabel}>Operations</Text>
        <View style={[styles.menu, cardShadow]}>
          {operations
            .filter((item) => !item.hidden)
            .map((item, index) => (
              <Pressable
                key={item.key}
                onPress={item.onPress}
                style={({ pressed }) => [styles.menuRow, index > 0 && styles.menuRowBorder, pressed && styles.menuPressed]}
                accessibilityRole="button"
              >
                <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuHint} numberOfLines={1}>
                    {item.hint}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Muted} />
              </Pressable>
            ))}
        </View>
      </ScrollView>

      <InfoSheet visible={sheet === 'info'} ticket={ticket} detail={detail} onClose={() => setSheet(null)} />
      {corporate ? (
        <>
          <CommentsSheet
            visible={sheet === 'comments'}
            ticketId={ticket.id}
            ticketCode={ticket.ticketCode}
            author={user?.username || user?.loginName || ''}
            onClose={() => setSheet(null)}
          />
          <PaymentsSheet
            visible={sheet === 'payments'}
            ticketId={ticket.id}
            ticketCode={ticket.ticketCode}
            onClose={() => setSheet(null)}
          />
          <StartWorkSheet
            visible={sheet === 'startWork'}
            ticketId={ticket.id}
            ticketCode={ticket.ticketCode}
            branchId={detail?.branchId ?? ''}
            branchName={branch}
            onClose={() => setSheet(null)}
            onStarted={() => {
              setSheet(null);
              setWorkStarted(true);
              void loadDetail();
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function StartWorkSheet({ visible, ticketId, ticketCode, branchId, branchName, onClose, onStarted }: {
  visible: boolean;
  ticketId: string;
  ticketCode: string;
  branchId: string;
  branchName: string;
  onClose: () => void;
  onStarted: () => void;
}) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setOtp('');
      setError('');
      setNotice('');
    }
  }, [visible]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const message = await sendStartWorkOtp(ticketId, branchId);
      setOtpSent(true);
      setOtp('');
      setNotice(message);
      setCooldown(ResendSeconds);
      setTimeout(() => inputRef.current?.focus(), 250);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the OTP.');
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (verifying || otp.length !== OtpLength) return;
    setVerifying(true);
    setError('');
    try {
      await verifyStartWorkOtp(ticketId, otp);
      setOtpSent(false);
      setCooldown(0);
      onStarted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The OTP is incorrect or expired.');
    } finally {
      setVerifying(false);
    }
  };

  const busy = sending || verifying;

  return (
    <Sheet visible={visible} title="Start Work" subtitle={ticketCode} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.otpIntro}>
          <View style={styles.otpIntroIcon}>
            <MaterialCommunityIcons name={otpSent ? 'shield-key-outline' : 'whatsapp'} size={26} color={otpSent ? Sky : Success} />
          </View>
          <Text style={styles.otpIntroTitle}>{otpSent ? 'Enter the branch OTP' : 'Get OTP from the branch'}</Text>
          <Text style={styles.otpIntroText}>
            {otpSent
              ? `Ask ${branchName || 'the branch'} for the ${OtpLength}-digit OTP they received on WhatsApp.`
              : `A ${OtpLength}-digit OTP will be sent on WhatsApp to ${branchName || 'the branch'}. Work starts once you verify it.`}
          </Text>
        </View>

        {otpSent ? (
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpBoxes} accessibilityLabel="OTP input">
            {Array.from({ length: OtpLength }, (_, index) => {
              const digit = otp[index] ?? '';
              const active = index === Math.min(otp.length, OtpLength - 1);
              return (
                <View key={index} style={[styles.otpBox, digit ? styles.otpBoxFilled : null, active && styles.otpBoxActive]}>
                  <Text style={styles.otpDigit}>{digit}</Text>
                </View>
              );
            })}
            <TextInput
              ref={inputRef}
              value={otp}
              onChangeText={(value) => {
                setOtp(value.replace(/\D/g, '').slice(0, OtpLength));
                setError('');
              }}
              onSubmitEditing={() => void verify()}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={OtpLength}
              caretHidden
              style={[styles.otpHiddenInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
              accessibilityLabel="Enter OTP"
            />
          </Pressable>
        ) : null}

        {notice && !error ? (
          <View style={styles.otpNotice}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={Success} />
            <Text style={styles.otpNoticeText}>{notice}</Text>
          </View>
        ) : null}
        {error ? <Text style={[styles.sheetError, { textAlign: 'center', marginTop: 12 }]}>{error}</Text> : null}

        <Pressable
          onPress={() => void (otpSent ? verify() : send())}
          disabled={busy || (otpSent && otp.length !== OtpLength)}
          style={({ pressed }) => [
            styles.otpPrimary,
            (busy || (otpSent && otp.length !== OtpLength)) && styles.otpPrimaryDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
        >
          <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.otpPrimaryInner}>
            {busy ? (
              <ActivityIndicator size="small" color={Brand.white} />
            ) : (
              <MaterialCommunityIcons name={otpSent ? 'check-decagram' : 'send'} size={18} color={Brand.white} />
            )}
            <Text style={styles.otpPrimaryText}>{otpSent ? 'Verify & Start Work' : 'Send OTP to Branch'}</Text>
          </LinearGradient>
        </Pressable>

        {otpSent ? (
          <Pressable
            onPress={() => void send()}
            disabled={busy || cooldown > 0}
            style={styles.otpResend}
            hitSlop={6}
            accessibilityRole="button"
          >
            <Text style={[styles.otpResendText, (busy || cooldown > 0) && { color: Muted }]}>
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function Sheet({ visible, title, subtitle, onClose, children, footer }: {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={Slate} />
            </Pressable>
          </View>
          {children}
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: McIcon; label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={16} color={Sky} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function InfoSheet({ visible, ticket, detail, onClose }: {
  visible: boolean;
  ticket: ServiceTicket;
  detail: CorporateTicketDetail | null;
  onClose: () => void;
}) {
  const corporate = ticket.source === 'corporate';
  return (
    <Sheet visible={visible} title="Full Details" subtitle={ticket.ticketCode} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <InfoRow icon="pound" label={corporate ? 'Ticket ID' : 'Booking ID'} value={ticket.id} />
        <InfoRow icon="list-status" label="Status" value={detail?.status || ticket.status} />
        <InfoRow icon="shape-outline" label="Type" value={ticket.type} />
        <InfoRow icon="tools" label="Service" value={ticket.service} />
        <InfoRow icon="wrench-outline" label="Sub service" value={detail?.subService || ticket.subService} />
        {corporate ? (
          <>
            <InfoRow icon="domain" label="Company" value={detail?.companyName ?? ''} />
            <InfoRow icon="office-building-outline" label="Branch" value={detail?.branchSite || ticket.site} />
            <InfoRow icon="map-marker-outline" label="Branch address" value={detail?.branchAddress ?? ''} />
            <InfoRow icon="account-hard-hat-outline" label="Employee" value={detail?.employeeName ?? ''} />
            <InfoRow icon="cog-outline" label="Asset" value={detail?.equipmentName ?? ''} />
            <InfoRow icon="message-text-outline" label="Issue" value={ticket.message} />
            <InfoRow icon="text-box-outline" label="Description" value={ticket.description} />
            <InfoRow icon="flag-outline" label="Priority" value={detail?.priority || ticket.priority} />
            <InfoRow icon="calendar-plus" label="Raised" value={joinDateTime(ticket.date, ticket.time)} />
            <InfoRow icon="calendar-clock-outline" label="Due date" value={displayDate(detail?.dueDate || ticket.dueDate)} />
            <InfoRow icon="check-decagram-outline" label="Closed" value={joinDateTime(ticket.closeDate, ticket.closeTime)} />
            <InfoRow icon="file-document-outline" label="Quotation status" value={ticket.quotationStatus} />
            <InfoRow icon="package-variant-closed" label="Spare part status" value={detail?.sparePartStatus ?? ''} />
            <InfoRow icon="identifier" label="Client ticket ID" value={detail?.clientTicketId || ticket.clientTicketId} />
            <InfoRow icon="phone-in-talk-outline" label="Call type" value={ticket.callType} />
            <InfoRow icon="comment-text-outline" label="Remarks" value={ticket.remarks} />
          </>
        ) : (
          <>
            <InfoRow icon="account-outline" label="Customer" value={ticket.site} />
            <InfoRow icon="phone-outline" label="Phone" value={ticket.phone} />
            <InfoRow icon="email-outline" label="Email" value={ticket.email} />
            <InfoRow icon="map-marker-outline" label="Address" value={ticket.address} />
            <InfoRow icon="calendar-clock-outline" label="Booking" value={joinDateTime(ticket.date, ticket.time)} />
            <InfoRow icon="cash" label="Payment" value={ticket.paymentStatus} />
            <InfoRow icon="message-text-outline" label="Subject" value={ticket.message} />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

function CommentsSheet({ visible, ticketId, ticketCode, author, onClose }: {
  visible: boolean;
  ticketId: string;
  ticketCode: string;
  author: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setComments(await fetchTicketComments(ticketId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;
    if (!author) {
      setError('Sign in again to add comments.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await addTicketComment(ticketId, message, author);
      setDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the comment.');
    } finally {
      setSending(false);
    }
  };

  const mine = (comment: TicketComment) => comment.createdBy.toLowerCase() === author.toLowerCase();

  return (
    <Sheet
      visible={visible}
      title="Comments"
      subtitle={`${ticketCode}  ·  ${comments.length} message${comments.length === 1 ? '' : 's'}`}
      onClose={onClose}
      footer={
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a comment…"
            placeholderTextColor={Muted}
            style={[styles.composerInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            style={({ pressed }) => [
              styles.sendButton,
              (!draft.trim() || sending) && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
          >
            {sending ? (
              <ActivityIndicator size="small" color={Brand.white} />
            ) : (
              <Ionicons name="send" size={18} color={Brand.white} />
            )}
          </Pressable>
        </View>
      }
    >
      <ScrollView
        ref={listRef}
        contentContainerStyle={styles.sheetContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.sheetError}>{error}</Text> : null}
        {loading && comments.length === 0 ? (
          <View style={styles.sheetState}>
            <ActivityIndicator color={Sky} />
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.sheetState}>
            <MaterialCommunityIcons name="comment-outline" size={30} color={Muted} />
            <Text style={styles.sheetStateText}>No comments yet. Start the conversation.</Text>
          </View>
        ) : (
          comments.map((comment) => {
            const own = mine(comment);
            return (
              <View key={comment.id} style={[styles.bubbleRow, own && styles.bubbleRowOwn]}>
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  {!own ? <Text style={styles.bubbleAuthor}>{comment.createdBy || 'Unknown'}</Text> : null}
                  <Text style={[styles.bubbleText, own && { color: Brand.white }]}>{comment.message}</Text>
                  <Text style={[styles.bubbleTime, own && { color: 'rgba(255, 255, 255, 0.75)' }]}>
                    {joinDateTime(comment.date, comment.time)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

function PaymentsSheet({ visible, ticketId, ticketCode, onClose }: {
  visible: boolean;
  ticketId: string;
  ticketCode: string;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<TicketPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPayments(await fetchTicketPayments(ticketId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load payments.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const total = payments.filter((p) => !/reject/i.test(p.status)).reduce((sum, p) => sum + p.amount, 0);

  return (
    <Sheet visible={visible} title="Ticket Payment" subtitle={ticketCode} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        {payments.length > 0 ? (
          <View style={styles.paymentTotal}>
            <Text style={styles.paymentTotalLabel}>Total requested</Text>
            <Text style={styles.paymentTotalValue}>₹{formatAmount(total)}</Text>
          </View>
        ) : null}
        {error ? (
          <Pressable onPress={() => void load()} accessibilityRole="button">
            <Text style={styles.sheetError}>{error} Tap to retry.</Text>
          </Pressable>
        ) : null}
        {loading && payments.length === 0 ? (
          <View style={styles.sheetState}>
            <ActivityIndicator color={Sky} />
          </View>
        ) : payments.length === 0 && !error ? (
          <View style={styles.sheetState}>
            <MaterialCommunityIcons name="wallet-outline" size={30} color={Muted} />
            <Text style={styles.sheetStateText}>No payments have been requested for this ticket.</Text>
          </View>
        ) : (
          payments.map((payment) => {
            const tone = statusTone(payment.status);
            return (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentType}>{payment.paymentType}</Text>
                    {payment.store ? <Text style={styles.paymentStore}>{payment.store}</Text> : null}
                  </View>
                  <Text style={styles.paymentAmount}>₹{formatAmount(payment.amount)}</Text>
                </View>
                <View style={styles.paymentMeta}>
                  <View style={[styles.statusPill, { backgroundColor: tone.tint }]}>
                    <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
                    <Text style={[styles.statusText, { color: tone.color }]}>{payment.status}</Text>
                  </View>
                  {payment.scheduleDate ? (
                    <Text style={styles.paymentDate}>Scheduled {displayDate(payment.scheduleDate)}</Text>
                  ) : null}
                </View>
                <View style={styles.approvalRow}>
                  {(
                    [
                      ['State', payment.stateApproved],
                      ['Finance', payment.financeApproved],
                      ['CFO', payment.cfoApproved],
                    ] as const
                  ).map(([label, approved]) => (
                    <View key={label} style={[styles.approval, approved && styles.approvalDone]}>
                      <MaterialCommunityIcons
                        name={approved ? 'check-circle' : 'circle-outline'}
                        size={14}
                        color={approved ? Success : Muted}
                      />
                      <Text style={[styles.approvalText, approved && { color: Success }]}>{label}</Text>
                    </View>
                  ))}
                </View>
                {payment.billCount || payment.phone ? (
                  <Text style={styles.paymentFoot}>
                    {[
                      payment.billCount ? `${payment.billCount} bill${payment.billCount > 1 ? 's' : ''} attached` : '',
                      payment.phone ? `Pay to ${payment.phone}` : '',
                    ]
                      .filter(Boolean)
                      .join('  ·  ')}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PageBg },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  hero: { paddingBottom: 20, overflow: 'hidden', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroGlowLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -60,
    backgroundColor: 'rgba(58, 171, 242, 0.28)',
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -40,
    bottom: -50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  glassButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  glassSpacer: { width: 42 },
  headerTitle: { flex: 1, textAlign: 'center', color: Brand.white, fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  identity: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
  identityTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingBottom: 0 },
  identityLabel: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  identityCode: { color: Brand.white, fontSize: 24, lineHeight: 30, fontFamily: 'Poppins_700Bold', marginTop: 2 },
  identityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '45%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Brand.white,
  },
  identityStatusText: { flexShrink: 1, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  identityTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 10 },
  typeTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  typeTagText: { fontSize: 11.5, fontFamily: 'Poppins_700Bold', letterSpacing: 0.3 },
  glassTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '70%',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  glassTagText: { flexShrink: 1, color: Brand.white, fontSize: 11.5, fontFamily: 'Poppins_500Medium' },
  identityStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(11, 53, 110, 0.35)',
  },
  identityStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityDivider: { width: 1, height: 32, marginHorizontal: 12, backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  identityStatLabel: { color: 'rgba(255, 255, 255, 0.72)', fontSize: 11, fontFamily: 'Poppins_500Medium' },
  identityStatValue: { color: Brand.white, fontSize: 14, fontFamily: 'Poppins_700Bold' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Brand.white,
    borderLeftWidth: 4,
  },
  bannerWarn: { borderLeftColor: Danger },
  bannerOk: { borderLeftColor: Success },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { color: Ink, fontSize: 14.5, fontFamily: 'Poppins_700Bold' },
  bannerText: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular' },
  startWork: { borderRadius: 18, overflow: 'hidden' },
  startWorkInner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  startWorkIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  startWorkTitle: { color: Brand.white, fontSize: 16, fontFamily: 'Poppins_700Bold' },
  startWorkHint: { color: 'rgba(255, 255, 255, 0.82)', fontSize: 12, fontFamily: 'Poppins_400Regular' },
  otpIntro: { alignItems: 'center', gap: 6, paddingTop: 8 },
  otpIntroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FE',
    marginBottom: 4,
  },
  otpIntroTitle: { color: Ink, fontSize: 16, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
  otpIntroText: { color: Slate, fontSize: 13, lineHeight: 19, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  otpBoxes: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 20 },
  otpBox: {
    width: 56,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Line,
    backgroundColor: '#F8FAFD',
  },
  otpBoxFilled: { borderColor: '#B6D5F2', backgroundColor: Brand.white },
  otpBoxActive: { borderColor: Sky, borderWidth: 2 },
  otpDigit: { color: Navy, fontSize: 24, fontFamily: 'Poppins_700Bold' },
  otpHiddenInput: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0, color: 'transparent' },
  otpNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  otpNoticeText: { flexShrink: 1, color: Success, fontSize: 12.5, fontFamily: 'Poppins_500Medium', textAlign: 'center' },
  otpPrimary: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  otpPrimaryDisabled: { opacity: 0.55 },
  otpPrimaryInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52 },
  otpPrimaryText: { color: Brand.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  otpResend: { alignSelf: 'center', marginTop: 14, paddingVertical: 4 },
  otpResendText: { color: Sky, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  inlineNote: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  inlineNoteText: { flex: 1, color: Slate, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  card: { backgroundColor: Brand.white, borderRadius: 18, borderWidth: 1, borderColor: Line, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, color: Ink, fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  field: { width: '50%', paddingRight: 10 },
  fieldWide: { width: '100%' },
  fieldLabel: {
    color: Muted,
    fontSize: 10.5,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: { color: Ink, fontSize: 14, lineHeight: 20, fontFamily: 'Poppins_600SemiBold', marginTop: 1 },
  fieldEmpty: { color: Muted, fontFamily: 'Poppins_400Regular' },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Line,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
  },
  addressText: { color: Ink, fontSize: 14, lineHeight: 20, fontFamily: 'Poppins_600SemiBold', marginTop: 2 },
  mapLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 8 },
  mapLinkText: { color: Sky, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  messageBox: { padding: 12, borderRadius: 12, backgroundColor: '#F8FAFD', borderWidth: 1, borderColor: '#EEF2F7' },
  messageText: { color: '#334155', fontSize: 13.5, lineHeight: 20, fontFamily: 'Poppins_400Regular' },
  sectionLabel: {
    marginTop: 6,
    marginLeft: 2,
    color: Navy,
    fontSize: 12.5,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  menu: { backgroundColor: Brand.white, borderRadius: 18, borderWidth: 1, borderColor: Line, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  menuPressed: { backgroundColor: '#F6F9FD' },
  menuIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { color: Ink, fontSize: 14.5, fontFamily: 'Poppins_600SemiBold' },
  menuHint: { color: Slate, fontSize: 11.5, fontFamily: 'Poppins_400Regular' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Brand.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D8E0EA',
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  sheetTitle: { color: Ink, fontSize: 17, fontFamily: 'Poppins_700Bold' },
  sheetSubtitle: { color: Slate, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  sheetContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  sheetState: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  sheetStateText: { color: Slate, fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  sheetError: { color: '#B91C1C', fontSize: 12.5, fontFamily: 'Poppins_500Medium', marginBottom: 10 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F4F8',
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FE',
  },
  infoValue: { color: Ink, fontSize: 13.5, lineHeight: 19, fontFamily: 'Poppins_600SemiBold' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: Line,
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Sky,
  },
  sendButtonDisabled: { backgroundColor: '#B6D5F2' },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  bubbleOwn: { backgroundColor: Sky, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#F1F5F9', borderBottomLeftRadius: 4 },
  bubbleAuthor: { color: Navy, fontSize: 11.5, fontFamily: 'Poppins_700Bold', marginBottom: 2 },
  bubbleText: { color: Ink, fontSize: 13.5, lineHeight: 19, fontFamily: 'Poppins_400Regular' },
  bubbleTime: { color: Muted, fontSize: 10.5, fontFamily: 'Poppins_400Regular', marginTop: 4, textAlign: 'right' },
  paymentTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#EEF6FE',
  },
  paymentTotalLabel: { color: Navy, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  paymentTotalValue: { color: Navy, fontSize: 20, fontFamily: 'Poppins_700Bold', fontVariant: ['tabular-nums'] },
  paymentCard: { padding: 14, marginBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: Line },
  paymentTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  paymentType: { color: Ink, fontSize: 14.5, fontFamily: 'Poppins_600SemiBold' },
  paymentStore: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular', textTransform: 'capitalize' },
  paymentAmount: { color: Ink, fontSize: 17, fontFamily: 'Poppins_700Bold', fontVariant: ['tabular-nums'] },
  paymentMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  paymentDate: { color: Slate, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: { fontSize: 11.5, fontFamily: 'Poppins_600SemiBold' },
  approvalRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approval: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F4F7FB',
  },
  approvalDone: { backgroundColor: '#E7F7F0' },
  approvalText: { color: Slate, fontSize: 11.5, fontFamily: 'Poppins_600SemiBold' },
  paymentFoot: { color: Slate, fontSize: 11.5, fontFamily: 'Poppins_400Regular', marginTop: 10 },
});
