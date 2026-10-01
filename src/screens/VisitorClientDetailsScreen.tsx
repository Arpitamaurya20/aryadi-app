import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { fetchBranchDetails } from '../api/company';
import { initiateSiteVisit } from '../api/siteVisits';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const FieldBg = '#F4FAFE';
const FieldLine = '#CDE4F5';
const Required = '#E11D48';

type VisitorClientDetailsScreenProps = {
  branchId: string;
  createdBy: string;
  onBack: () => void;
  onSubmit: (saved: { id: number; title: string; contactPerson: string; phone: string }) => void;
};

export function VisitorClientDetailsScreen({ branchId, createdBy, onBack, onSubmit }: VisitorClientDetailsScreenProps) {
  const [visitDetails, setVisitDetails] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [branchLabel, setBranchLabel] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      setLoadError('Select a branch before entering client details.');
      return;
    }
    let cancelled = false;
    async function loadBranch() {
      setLoading(true);
      setLoadError('');
      try {
        const details = await fetchBranchDetails(branchId);
        if (cancelled) return;
        setBranchLabel(details.code ? `${details.site} (${details.code})` : details.site);
        setBranchAddress(details.address);
        setContactPerson(details.incharge);
        setEmail(details.email);
        setPhone(details.phone);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load branch details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadBranch();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  async function handleSubmit() {
    if (submitting) return;
    if (!visitDetails.trim()) {
      Alert.alert('Please enter visit details.');
      return;
    }
    if (!contactPerson.trim()) {
      Alert.alert('Please enter contact person.');
      return;
    }
    if (!createdBy.trim()) {
      setSubmitError('Sign in again to save this site visit.');
      return;
    }
    if (!branchId) {
      setSubmitError('Select a branch before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const id = await initiateSiteVisit({
        createdBy: createdBy.trim(),
        branchId,
        visitTitle: visitDetails.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      onSubmit({
        id,
        title: visitDetails.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save the site visit.');
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Visitor Client Details</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Client information</Text>
          <Text style={styles.sectionHint}>Branch contact details are filled in. Add the visit notes, then submit.</Text>

          {loading ? (
            <ActivityIndicator color={LogoMid} style={styles.loader} />
          ) : (
            <>
              {branchLabel ? (
                <View style={styles.branchCard}>
                  <MaterialCommunityIcons name="map-marker" size={18} color={LogoMid} />
                  <View style={styles.branchCopy}>
                    <Text style={styles.branchTitle}>{branchLabel}</Text>
                    {branchAddress ? <Text style={styles.branchAddress}>{branchAddress}</Text> : null}
                  </View>
                </View>
              ) : null}
              {loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}

              <View
                style={[
                  styles.card,
                  brandShadow('0 10px 18px rgba(10, 29, 55, 0.08)', {
                    shadowColor: Brand.navy,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.08,
                    shadowRadius: 14,
                    elevation: 8,
                  }),
                ]}
              >
            <FormField
              label="Visit Details"
              required
              hint="Purpose, discussion points, or outcome"
              value={visitDetails}
              onChangeText={setVisitDetails}
              icon="format-list-bulleted"
              multiline
            />
            <FormField
              label="Contact Person"
              required
              hint="Full name"
              value={contactPerson}
              onChangeText={setContactPerson}
              icon="badge-account-horizontal-outline"
              autoCapitalize="words"
            />
            <FormField
              label="Email(s)"
              hint="name@company.com"
              value={email}
              onChangeText={setEmail}
              icon="email-outline"
              keyboardType="email-address"
            />
            <FormField
              label="Contact Person Phone"
              hint="10-digit mobile number"
              value={phone}
              onChangeText={setPhone}
              icon="phone-outline"
              keyboardType="phone-pad"
            />

            {submitError ? <Text style={styles.loadError}>{submitError}</Text> : null}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Submit"
              accessibilityState={{ disabled: submitting }}
            >
              <LinearGradient colors={[LogoNavy, '#1568B8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                {submitting ? (
                  <ActivityIndicator color={Brand.white} />
                ) : (
                  <Text style={styles.submitText}>Submit</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FormField({
  label,
  required = false,
  hint,
  value,
  onChangeText,
  icon,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: {
  label: string;
  required?: boolean;
  hint: string;
  value: string;
  onChangeText: (value: string) => void;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={[styles.field, multiline ? styles.fieldMultiline : null]}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={LogoMid}
          style={multiline ? styles.multilineIcon : undefined}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={hint}
          placeholderTextColor={Brand.placeholder}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          ]}
        />
      </View>
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
  content: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  sectionHint: {
    marginTop: 4,
    marginBottom: 16,
    color: Brand.placeholder,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Poppins_400Regular',
  },
  loader: {
    marginTop: 24,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  branchCopy: {
    flex: 1,
    marginLeft: 10,
  },
  branchTitle: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  branchAddress: {
    marginTop: 2,
    color: Brand.placeholder,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },
  loadError: {
    marginBottom: 12,
    color: Required,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 18,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  label: {
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  required: {
    color: Required,
  },
  field: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FieldLine,
    backgroundColor: FieldBg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldMultiline: {
    minHeight: 108,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  multilineIcon: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    paddingVertical: 0,
  },
  inputMultiline: {
    minHeight: 84,
    fontFamily: 'Poppins_400Regular',
  },
  submit: {
    marginTop: 8,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: Brand.white,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
});
