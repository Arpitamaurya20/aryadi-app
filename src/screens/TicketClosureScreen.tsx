import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendCloseTicketOtp, sendFeedbackLink, verifyCloseTicketOtp } from '../api/serviceTickets';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const Success = '#059669';
const OtpLength = 4;
const ResendSeconds = 30;

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Step = 'feedback' | 'otp' | 'closed';

const Steps: { key: Step; label: string }[] = [
  { key: 'feedback', label: 'Feedback' },
  { key: 'otp', label: 'OTP' },
  { key: 'closed', label: 'Closed' },
];

const cardShadow = brandShadow('0 6px 18px rgba(11, 53, 110, 0.07)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 2,
});

type TicketClosureScreenProps = {
  ticketId: string;
  ticketCode: string;
  branchId: string;
  branchName: string;
  defaultPhone: string;
  onBack: () => void;
  onClosed: () => void;
};

export function TicketClosureScreen({ ticketId, ticketCode, branchId, branchName, defaultPhone, onBack, onClosed }: TicketClosureScreenProps) {
  const [step, setStep] = useState<Step>('feedback');
  const [phone, setPhone] = useState(defaultPhone.replace(/\D/g, '').slice(-10));
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef<TextInput>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'closed') onClosed();
      else if (!busy) onBack();
      return true;
    });
    return () => sub.remove();
  }, [step, busy, onBack, onClosed]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendOtp = async () => {
    const message = await sendCloseTicketOtp(ticketId, branchId);
    setOtp('');
    setNotice(message);
    setCooldown(ResendSeconds);
    setStep('otp');
    setTimeout(() => otpRef.current?.focus(), 250);
  };

  const submitFeedback = async () => {
    if (busy) return;
    if (phone.length !== 10) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!feedbackSent) {
        await sendFeedbackLink(ticketId, phone);
        setFeedbackSent(true);
      }
      await sendOtp();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit feedback contact.');
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError('');
    try {
      await sendOtp();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the OTP.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy || otp.length !== OtpLength) return;
    setBusy(true);
    setError('');
    try {
      await verifyCloseTicketOtp(ticketId, otp);
      setStep('closed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The OTP is incorrect or expired.');
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = Steps.findIndex((item) => item.key === step);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroGlow} />
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            {step !== 'closed' ? (
              <Pressable
                onPress={onBack}
                disabled={busy}
                style={({ pressed }) => [styles.glassButton, pressed && styles.pressed]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="arrow-back" size={22} color={Brand.white} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{step === 'feedback' ? 'Client Contact' : step === 'otp' ? 'Close Ticket' : 'Ticket Closed'}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {ticketCode}
              </Text>
            </View>
          </View>
          <View style={styles.stepper}>
            {Steps.map((item, index) => {
              const done = index < stepIndex || step === 'closed';
              const active = index === stepIndex;
              return (
                <View key={item.key} style={styles.stepItem}>
                  <View style={[styles.stepDot, (done || active) && styles.stepDotOn]}>
                    {done ? (
                      <MaterialCommunityIcons name="check" size={13} color={Navy} />
                    ) : (
                      <Text style={[styles.stepNum, active && { color: Navy }]}>{index + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, (done || active) && styles.stepLabelOn]}>{item.label}</Text>
                  {index < Steps.length - 1 ? <View style={[styles.stepLine, done && styles.stepLineOn]} /> : null}
                </View>
              );
            })}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 'feedback' ? (
            <View style={[styles.card, cardShadow]}>
              <Intro
                icon="star-face"
                title="Submit Feedback Contact"
                text="The client gets a feedback link on WhatsApp. After that, the closure OTP is sent to the branch."
              />
              <Text style={styles.inputLabel}>Client phone number</Text>
              <View style={styles.phoneRow}>
                <Text style={styles.phonePrefix}>+91</Text>
                <TextInput
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value.replace(/\D/g, '').slice(0, 10));
                    setError('');
                  }}
                  onSubmitEditing={() => void submitFeedback()}
                  placeholder="Phone Number"
                  placeholderTextColor={Muted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!feedbackSent && !busy}
                  style={[styles.phoneInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
                  accessibilityLabel="Client phone number"
                />
              </View>
              {feedbackSent ? <Notice text="Feedback link already sent. Tap Submit to send the closure OTP again." /> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton
                label="Submit"
                icon="send"
                busy={busy}
                disabled={phone.length !== 10}
                onPress={() => void submitFeedback()}
              />
            </View>
          ) : null}

          {step === 'otp' ? (
            <View style={[styles.card, cardShadow]}>
              <Intro
                icon="shield-key-outline"
                title="Enter the closure OTP"
                text={`Ask ${branchName || 'the branch'} for the ${OtpLength}-digit OTP they received on WhatsApp.`}
              />
              <Pressable onPress={() => otpRef.current?.focus()} style={styles.otpBoxes} accessibilityLabel="OTP input">
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
                  ref={otpRef}
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
              {notice && !error ? <Notice text={notice} /> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton
                label="Verify & Close Ticket"
                icon="check-decagram"
                busy={busy}
                disabled={otp.length !== OtpLength}
                onPress={() => void verify()}
              />
              <Pressable onPress={() => void resendOtp()} disabled={busy || cooldown > 0} style={styles.resend} hitSlop={6} accessibilityRole="button">
                <Text style={[styles.resendText, (busy || cooldown > 0) && { color: Muted }]}>
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {step === 'closed' ? (
            <View style={[styles.card, cardShadow, styles.closedCard]}>
              <View style={styles.closedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={52} color={Success} />
              </View>
              <Text style={styles.closedTitle}>Ticket Closed</Text>
              <Text style={styles.closedText}>
                {ticketCode} has been closed successfully. The service report is shared with the client.
              </Text>
              <PrimaryButton label="Done" icon="check" onPress={onClosed} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Intro({ icon, title, text }: { icon: McIcon; title: string; text: string }) {
  return (
    <View style={styles.intro}>
      <View style={styles.introIcon}>
        <MaterialCommunityIcons name={icon} size={28} color={Sky} />
      </View>
      <Text style={styles.introTitle}>{title}</Text>
      <Text style={styles.introText}>{text}</Text>
    </View>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <View style={styles.notice}>
      <MaterialCommunityIcons name="check-circle-outline" size={16} color={Success} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function PrimaryButton({ label, icon, busy, disabled, onPress }: {
  label: string;
  icon: McIcon;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const off = busy || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.primary, off && styles.primaryDisabled, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryInner}>
        {busy ? <ActivityIndicator size="small" color={Brand.white} /> : <MaterialCommunityIcons name={icon} size={18} color={Brand.white} />}
        <Text style={styles.primaryText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PageBg },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  hero: { paddingBottom: 18, overflow: 'hidden', borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -70,
    backgroundColor: 'rgba(58, 171, 242, 0.28)',
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
  headerTitle: { color: Brand.white, fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  headerSub: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 12.5, fontFamily: 'Poppins_500Medium' },
  stepper: { flexDirection: 'row', marginTop: 18, paddingHorizontal: 24 },
  stepItem: { flex: 1, alignItems: 'center' },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1,
  },
  stepDotOn: { backgroundColor: Brand.white },
  stepNum: { color: Brand.white, fontSize: 12, fontFamily: 'Poppins_700Bold' },
  stepLabel: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 11.5, fontFamily: 'Poppins_500Medium', marginTop: 4 },
  stepLabelOn: { color: Brand.white, fontFamily: 'Poppins_600SemiBold' },
  stepLine: {
    position: 'absolute',
    top: 12,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  stepLineOn: { backgroundColor: Brand.white },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: Brand.white, borderRadius: 20, borderWidth: 1, borderColor: Line, padding: 20 },
  intro: { alignItems: 'center', gap: 6, marginBottom: 18 },
  introIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FE',
    marginBottom: 4,
  },
  introTitle: { color: Ink, fontSize: 17, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
  introText: { color: Slate, fontSize: 13, lineHeight: 19, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  inputLabel: { color: '#334155', fontSize: 12.5, fontFamily: 'Poppins_600SemiBold', marginBottom: 6 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: '#F8FAFD',
    overflow: 'hidden',
  },
  phonePrefix: {
    paddingHorizontal: 14,
    color: Navy,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    borderRightWidth: 1,
    borderRightColor: Line,
    lineHeight: 52,
  },
  phoneInput: { flex: 1, height: '100%', paddingHorizontal: 14, color: Ink, fontSize: 15, fontFamily: 'Poppins_500Medium', letterSpacing: 0.5 },
  otpBoxes: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
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
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  noticeText: { flexShrink: 1, color: Success, fontSize: 12.5, fontFamily: 'Poppins_500Medium', textAlign: 'center' },
  error: { color: '#B91C1C', fontSize: 12.5, fontFamily: 'Poppins_500Medium', textAlign: 'center', marginTop: 12 },
  primary: { alignSelf: 'stretch', marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  primaryDisabled: { opacity: 0.55 },
  primaryInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52 },
  primaryText: { color: Brand.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  resend: { alignSelf: 'center', marginTop: 14, paddingVertical: 4 },
  resendText: { color: Sky, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  closedCard: { alignItems: 'center', paddingVertical: 32 },
  closedBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F7F0',
    marginBottom: 14,
  },
  closedTitle: { color: Ink, fontSize: 22, fontFamily: 'Poppins_700Bold' },
  closedText: { color: Slate, fontSize: 13.5, lineHeight: 20, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginTop: 6 },
});
