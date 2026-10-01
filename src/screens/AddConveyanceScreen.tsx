import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const Mute = '#7A8CA5';
const FieldStroke = '#D5E4F2';
const SickRed = '#E11D48';

export type ConveyanceFormValues = {
  date: string;
  from: string;
  to: string;
  amount: string;
  remarks: string;
};

type AddConveyanceScreenProps = {
  onBack: () => void;
  onSubmit: (values: ConveyanceFormValues) => Promise<void>;
  submitting?: boolean;
  initialRemarks?: string;
};

export function AddConveyanceScreen({ onBack, onSubmit, submitting = false, initialRemarks = '' }: AddConveyanceScreenProps) {
  const today = formatToday();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState(initialRemarks);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    if (!from.trim()) {
      setError('Please enter the starting place.');
      return;
    }
    if (!to.trim()) {
      setError('Please enter the final place.');
      return;
    }
    if (!amount.trim() || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    try {
      await onSubmit({
        date: today,
        from: from.trim(),
        to: to.trim(),
        amount: amount.trim(),
        remarks: remarks.trim() || '-',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit conveyance.');
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              disabled={submitting}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Conveyance Charges</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View
            style={[
              styles.card,
              brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 5,
              }),
            ]}
          >
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Date</Text>
              <Text style={styles.dateValue}>{today}</Text>
            </View>

            <Field label="From" value={from} onChangeText={(v) => { setError(null); setFrom(v); }} placeholder="Enter your starting place" />
            <Field label="To" value={to} onChangeText={(v) => { setError(null); setTo(v); }} placeholder="Enter your final place" />
            <Field
              label="Amount"
              value={amount}
              onChangeText={(v) => { setError(null); setAmount(v); }}
              placeholder="Enter your amount"
              keyboardType="numeric"
            />
            <Field
              label="Reference / Remarks"
              value={remarks}
              onChangeText={(v) => { setError(null); setRemarks(v); }}
              placeholder="Ticket ID or related remarks"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={() => {
                void submit();
              }}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit"
              style={submitting ? styles.submitDisabled : null}
            >
              <LinearGradient colors={[LogoNavy, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                {submitting ? (
                  <ActivityIndicator color={Brand.white} />
                ) : (
                  <Text style={styles.submitText}>SUBMIT</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Mute}
        style={styles.input}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function formatToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 12,
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
    color: Brand.white,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
  },
  dateRow: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    color: Mute,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  dateValue: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  label: {
    marginBottom: 6,
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FieldStroke,
    backgroundColor: '#F7FBFE',
    paddingHorizontal: 14,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  errorText: {
    marginBottom: 12,
    color: SickRed,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Poppins_500Medium',
  },
  submitDisabled: {
    opacity: 0.75,
  },
  submit: {
    marginTop: 4,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: Brand.white,
    fontSize: 15,
    letterSpacing: 0.6,
    fontFamily: 'Poppins_700Bold',
  },
});
