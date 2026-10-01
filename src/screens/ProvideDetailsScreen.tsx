import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchBranches, fetchCompanies, type BranchOption, type CompanyOption } from '../api/company';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const FieldBg = '#F4FAFE';
const FieldDisabled = '#F1F4F8';
const FieldLine = '#CDE4F5';
const IconWash = '#D7EEFB';
const Required = '#E11D48';

type ProvideDetailsScreenProps = {
  onBack: () => void;
  onNext?: (selection: { companyId: string; company: string; branchId: string; branch: string }) => void;
};

export function ProvideDetailsScreen({ onBack, onNext }: ProvideDetailsScreenProps) {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [openField, setOpenField] = useState<'company' | 'branch' | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [branchLoading, setBranchLoading] = useState(false);
  const [error, setError] = useState('');

  const company = companies.find((item) => item.id === companyId)?.label ?? '';
  const branch = branches.find((item) => item.id === branchId)?.label ?? '';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  useEffect(() => {
    let cancelled = false;
    async function loadCompanies() {
      setCompanyLoading(true);
      setError('');
      try {
        const rows = await fetchCompanies();
        if (!cancelled) setCompanies(rows);
      } catch (loadError) {
        if (!cancelled) {
          setCompanies([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load companies.');
        }
      } finally {
        if (!cancelled) setCompanyLoading(false);
      }
    }
    loadCompanies();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!companyId) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    async function loadBranches() {
      setBranchLoading(true);
      setError('');
      try {
        const rows = await fetchBranches(companyId);
        if (!cancelled) setBranches(rows);
      } catch (loadError) {
        if (!cancelled) {
          setBranches([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load branches.');
        }
      } finally {
        if (!cancelled) setBranchLoading(false);
      }
    }
    loadBranches();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  function handleNext() {
    if (!company) {
      Alert.alert('Please select your company.');
      return;
    }
    if (!branch) {
      Alert.alert('Please select your branch.');
      return;
    }
    onNext?.({ companyId, company, branchId, branch });
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
            <Text style={styles.headerTitle}>Provide Details</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroIcon}>
          <MaterialIcons name="apartment" size={32} color={LogoMid} />
        </View>
        <Text style={styles.title}>Company and branch</Text>
        <Text style={styles.subtitle}>Choose where this site visit belongs, then continue to client details.</Text>

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
          <SelectField
            label="Company"
            placeholder={companyLoading ? 'Loading companies...' : 'Select your company'}
            value={company}
            options={companies}
            icon="office-building-outline"
            loading={companyLoading}
            enabled={!companyLoading}
            expanded={openField === 'company'}
            onToggle={() => setOpenField((current) => (current === 'company' ? null : 'company'))}
            onSelect={(option) => {
              setCompanyId(option.id);
              setBranchId('');
              setOpenField(null);
            }}
          />
          <SelectField
            label="Branch"
            placeholder={
              !companyId ? 'Select a company first' : branchLoading ? 'Loading branches...' : 'Select your branch'
            }
            value={branch}
            options={branches}
            icon="map-marker-outline"
            loading={branchLoading}
            enabled={Boolean(companyId) && !branchLoading}
            expanded={openField === 'branch'}
            onToggle={() => setOpenField((current) => (current === 'branch' ? null : 'branch'))}
            onSelect={(option) => {
              setBranchId(option.id);
              setOpenField(null);
            }}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={handleNext} accessibilityRole="button" accessibilityLabel="Next">
            <LinearGradient colors={[LogoNavy, '#1568B8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.next}>
              <Text style={styles.nextText}>Next</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function SelectField({
  label,
  placeholder,
  value,
  options,
  icon,
  loading = false,
  enabled = true,
  expanded,
  onToggle,
  onSelect,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  loading?: boolean;
  enabled?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: (option: { id: string; label: string }) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>
        {label}
        <Text style={styles.required}> *</Text>
      </Text>
      <Pressable
        onPress={enabled ? onToggle : undefined}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.field, !enabled ? styles.fieldDisabled : null]}
      >
        <MaterialCommunityIcons name={icon} size={20} color={enabled ? LogoMid : Brand.placeholder} />
        <Text style={[styles.fieldText, value ? styles.fieldValue : null]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        {loading ? <ActivityIndicator size="small" color={LogoMid} /> : null}
        <MaterialCommunityIcons name="chevron-down" size={22} color={Brand.placeholder} />
      </Pressable>
      {expanded ? (
        <View
          style={[
            styles.menu,
            brandShadow('0 8px 12px rgba(10, 29, 55, 0.08)', {
              shadowColor: Brand.navy,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 6,
            }),
          ]}
        >
          {options.length === 0 ? (
            <Text style={styles.emptyOption}>No {label.toLowerCase()} found</Text>
          ) : (
            <ScrollView style={styles.menuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {options.map((option) => (
                <Pressable key={option.id} onPress={() => onSelect(option)} style={styles.option}>
                  <Text style={styles.optionText}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
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
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: IconWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 16,
    color: LogoNavy,
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 18,
    color: Brand.placeholder,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Poppins_400Regular',
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
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FieldLine,
    backgroundColor: FieldBg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldDisabled: {
    backgroundColor: FieldDisabled,
  },
  fieldText: {
    flex: 1,
    marginHorizontal: 12,
    color: Brand.placeholder,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  fieldValue: {
    color: LogoNavy,
    fontFamily: 'Poppins_500Medium',
  },
  menu: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FieldLine,
    backgroundColor: Brand.white,
    overflow: 'hidden',
  },
  menuScroll: {
    maxHeight: 220,
  },
  emptyOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Brand.placeholder,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  errorText: {
    marginBottom: 10,
    color: Required,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  next: {
    marginTop: 8,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: Brand.white,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
});
