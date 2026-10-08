import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { completeSiteVisit, uploadCustomerSignature } from '../api/siteVisits';
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad';
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
const MaxSummary = 1000;

const cardShadow = brandShadow('0 2px 8px rgba(15, 23, 42, 0.05)', {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 1,
});

type VisitorSummaryScreenProps = {
  siteVisitId: number;
  createdBy: string;
  onBack: () => void;
  onSaved: () => void;
};

export function VisitorSummaryScreen({ siteVisitId, createdBy, onBack, onSaved }: VisitorSummaryScreenProps) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [summary, setSummary] = useState('');
  const [hasInk, setHasInk] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!submitting) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, submitting]);

  function clearSignature() {
    padRef.current?.clear();
    setHasInk(false);
    setSignatureSaved(false);
    setError('');
  }

  async function submit() {
    if (submitting) return;
    if (!summary.trim()) {
      setError('Please write the visit summary.');
      return;
    }
    if (!signatureSaved && !padRef.current?.hasInk()) {
      setError('Please take the customer signature.');
      return;
    }
    if (!createdBy.trim()) {
      setError('Sign in again to submit this summary.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (!signatureSaved) {
        const imageData = padRef.current?.toJpegBase64();
        if (!imageData) throw new Error('Please take the customer signature.');
        await uploadCustomerSignature(siteVisitId, imageData);
        setSignatureSaved(true);
      }
      await completeSiteVisit({ siteVisitId, createdBy: createdBy.trim(), summary: summary.trim() });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the summary.');
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              disabled={submitting}
              style={styles.backBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Visitor Summary</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, cardShadow]}>
            <SectionTitle icon="text-box-outline" title="Visit Summary" required />
            <TextInput
              value={summary}
              onChangeText={(value) => {
                setSummary(value);
                setError('');
              }}
              placeholder="Describe the work done, findings and next steps…"
              placeholderTextColor={Muted}
              multiline
              maxLength={MaxSummary}
              textAlignVertical="top"
              editable={!submitting}
              style={[styles.summary, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            />
            <Text style={styles.counter}>
              {summary.length}/{MaxSummary}
            </Text>
          </View>

          <View style={[styles.card, cardShadow]}>
            <SectionTitle
              icon="draw-pen"
              title="Customer Signature"
              required
              right={
                hasInk || signatureSaved ? (
                  <Pressable onPress={clearSignature} disabled={submitting} hitSlop={8} style={styles.clearBtn} accessibilityRole="button">
                    <MaterialCommunityIcons name="eraser" size={15} color={Danger} />
                    <Text style={styles.clearText}>Clear</Text>
                  </Pressable>
                ) : null
              }
            />
            <View>
              <SignaturePad
                ref={padRef}
                style={styles.pad}
                onInkChange={(ink) => {
                  setHasInk(ink);
                  setSignatureSaved(false);
                  if (ink) setError('');
                }}
                onDrawStart={() => setScrollEnabled(false)}
                onDrawEnd={() => setScrollEnabled(true)}
              />
              {!hasInk ? (
                <View style={styles.padHint}>
                  <MaterialCommunityIcons name="gesture" size={22} color={Muted} />
                  <Text style={styles.padHintText}>Ask the customer to sign here</Text>
                </View>
              ) : null}
            </View>
            {signatureSaved ? (
              <View style={styles.savedRow}>
                <MaterialCommunityIcons name="check-circle" size={15} color={Success} />
                <Text style={styles.savedText}>Signature saved</Text>
              </View>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Pressable
            onPress={() => void submit()}
            disabled={submitting}
            style={({ pressed }) => [styles.submitBtn, submitting && { opacity: 0.7 }, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={Brand.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle-outline" size={19} color={Brand.white} />
                <Text style={styles.submitText}>Submit & Complete Visit</Text>
              </>
            )}
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SectionTitle({ icon, title, required, right }: {
  icon: 'text-box-outline' | 'draw-pen';
  title: string;
  required?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.sectionRow}>
      <MaterialCommunityIcons name={icon} size={18} color={Sky} />
      <Text style={styles.sectionTitle}>
        {title}
        {required ? <Text style={{ color: Danger }}> *</Text> : null}
      </Text>
      {right}
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
  card: { backgroundColor: Brand.white, borderRadius: 14, borderWidth: 1, borderColor: Line, padding: 14 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { flex: 1, color: Ink, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  summary: {
    minHeight: 130,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: '#F8FAFC',
    color: Ink,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Poppins_400Regular',
  },
  counter: { alignSelf: 'flex-end', marginTop: 6, color: Muted, fontSize: 11.5, fontFamily: 'Poppins_400Regular' },
  pad: {
    height: 190,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C7D7EA',
    backgroundColor: '#FBFCFE',
  },
  padHint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    pointerEvents: 'none',
  },
  padHintText: { color: Muted, fontSize: 13, fontFamily: 'Poppins_500Medium' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearText: { color: Danger, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  savedText: { color: Success, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: Navy,
  },
  submitText: { color: Brand.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
});
