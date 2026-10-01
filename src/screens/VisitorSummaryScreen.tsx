import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
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

const HeaderBlue = '#1E88E5';
const SaveTeal = '#1A7C89';
const Required = '#E11D48';

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
  const [savingSignature, setSavingSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  function clearSignature() {
    padRef.current?.clear();
    setHasInk(false);
    setSignatureSaved(false);
    setError('');
  }

  async function saveSignature() {
    if (savingSignature || submitting) return;
    if (!padRef.current?.hasInk()) {
      setError('Draw a signature first.');
      return;
    }
    const imageData = padRef.current.toJpegBase64();
    if (!imageData) {
      setError('Draw a signature first.');
      return;
    }
    setSavingSignature(true);
    setError('');
    try {
      await uploadCustomerSignature(siteVisitId, imageData);
      setSignatureSaved(true);
    } catch (saveError) {
      setSignatureSaved(false);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the signature.');
    } finally {
      setSavingSignature(false);
    }
  }

  async function submit() {
    if (savingSignature || submitting) return;
    if (!summary.trim()) {
      setError('Summary is required.');
      return;
    }
    if (!signatureSaved) {
      setError(hasInk ? 'Save the signature before submitting.' : 'Draw and save a signature.');
      return;
    }
    if (!createdBy.trim()) {
      setError('Sign in again to submit this summary.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await completeSiteVisit({
        siteVisitId,
        createdBy: createdBy.trim(),
        summary: summary.trim(),
      });
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the summary.');
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.headerBar}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>visitor Summary</Text>
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={scrollEnabled}
        >
          <Text style={styles.label}>
            summary<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            value={summary}
            onChangeText={setSummary}
            multiline
            textAlignVertical="top"
            style={[styles.summary, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          />

          <SignaturePad
            ref={padRef}
            onInkChange={(ink) => {
              setHasInk(ink);
              setSignatureSaved(false);
            }}
            onDrawStart={() => setScrollEnabled(false)}
            onDrawEnd={() => setScrollEnabled(true)}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {signatureSaved ? <Text style={styles.saved}>Signature saved</Text> : null}

          <View style={styles.actions}>
            <Pressable onPress={clearSignature} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear signature">
              <Text style={styles.clearText}>Clear Signature</Text>
            </Pressable>
            <Pressable
              onPress={saveSignature}
              style={styles.saveBtn}
              accessibilityRole="button"
              accessibilityLabel="Save signature"
            >
              {savingSignature ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.saveText}>Save Signature</Text>}
            </Pressable>
          </View>

          <Pressable onPress={submit} style={styles.submitBtn} accessibilityRole="button" accessibilityLabel="Submit">
            {submitting ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.submitText}>Submit</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.white },
  flex: { flex: 1 },
  headerBar: { backgroundColor: HeaderBlue },
  header: {
    minHeight: 56,
    paddingHorizontal: 4,
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
    color: Brand.white,
    fontSize: 20,
    fontFamily: 'Poppins_500Medium',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  label: {
    color: '#111111',
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 8,
  },
  required: { color: Required },
  summary: {
    minHeight: 120,
    color: '#111111',
    fontSize: 16,
    fontFamily: 'Poppins_400Regular',
    padding: 0,
    marginBottom: 8,
  },
  error: {
    marginTop: 10,
    color: Required,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  saved: {
    marginTop: 10,
    color: '#16A34A',
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  clearBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: '#F3F0EA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  clearText: {
    color: '#222222',
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
  },
  saveBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: SaveTeal,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  saveText: {
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
  },
  submitBtn: {
    alignSelf: 'center',
    marginTop: 18,
    minWidth: 168,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: HeaderBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  submitText: {
    color: Brand.white,
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
  },
});
