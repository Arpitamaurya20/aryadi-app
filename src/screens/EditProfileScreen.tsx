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
import type { AuthUser } from '../api/auth';
import { updateEmployeeProfile } from '../api/profile';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const PageBg = '#F4F8FC';
const SoftBlue = '#E8F4FD';

type EditProfileScreenProps = {
  user: AuthUser;
  onBack: () => void;
  onSave: (user: AuthUser) => void;
};

type FormState = {
  username: string;
  email: string;
  phone: string;
  employee_code: string;
  uan: string;
  bank_account_name: string;
  bank_account_number: string;
  pan: string;
  aadhaar: string;
};

type Field = {
  key: keyof FormState;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  uppercase?: boolean;
};

const fields: Field[] = [
  { key: 'username', label: 'Name', icon: 'account-outline' },
  { key: 'email', label: 'Email', icon: 'email-outline', keyboardType: 'email-address' },
  { key: 'phone', label: 'Phone Number', icon: 'phone-outline', keyboardType: 'phone-pad' },
  { key: 'employee_code', label: 'Employee Number', icon: 'badge-account-horizontal-outline' },
  { key: 'uan', label: 'UAN Number', icon: 'card-account-details-outline' },
  { key: 'bank_account_name', label: 'Bank Account Name', icon: 'bank-outline' },
  { key: 'bank_account_number', label: 'Bank Account Number', icon: 'credit-card-outline', keyboardType: 'number-pad' },
  { key: 'pan', label: 'PAN Number', icon: 'file-document-outline', uppercase: true },
  { key: 'aadhaar', label: 'Aadhaar Number', icon: 'card-account-details-outline', keyboardType: 'number-pad' },
];

export function EditProfileScreen({ user, onBack, onSave }: EditProfileScreenProps) {
  const [form, setForm] = useState<FormState>({
    username: user.username,
    email: user.email ?? '',
    phone: user.phone ?? '',
    employee_code: user.employee_code ?? '',
    uan: user.uan ?? '',
    bank_account_name: user.bank_account_name ?? '',
    bank_account_number: user.bank_account_number ?? '',
    pan: user.pan ?? '',
    aadhaar: user.aadhaar ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!saving) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, saving]);

  function update(key: keyof FormState, value: string, uppercase?: boolean) {
    setForm((current) => ({ ...current, [key]: uppercase ? value.toUpperCase() : value }));
    setError(null);
  }

  async function handleSave() {
    if (saving) return;
    if (!form.username.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Phone number is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateEmployeeProfile(user, form);
      onSave(updated);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={['#082A5C', '#0B4F9E', '#1E8BE0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              disabled={saving}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Edit Personal Information</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.avoid}
        behavior={Platform.OS === 'android' ? 'height' : 'padding'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              brandShadow('0 10px 18px rgba(11, 53, 110, 0.06)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 4,
              }),
            ]}
          >
            <View style={styles.cardHead}>
              <MaterialCommunityIcons name="account-outline" size={18} color={LogoNavy} />
              <Text style={styles.cardTitle}>Personal Information</Text>
            </View>

            {fields.map((field, index) => (
              <View key={field.key}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.field}>
                  <View style={styles.fieldIcon}>
                    <MaterialCommunityIcons name={field.icon} size={16} color={LogoMid} />
                  </View>
                  <View style={styles.fieldCopy}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput
                      value={form[field.key]}
                      onChangeText={(value) => update(field.key, value, field.uppercase)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      placeholderTextColor={Brand.placeholder}
                      keyboardType={field.keyboardType ?? 'default'}
                      autoCapitalize={field.uppercase ? 'characters' : 'none'}
                      autoCorrect={false}
                      editable={!saving}
                      returnKeyType={index === fields.length - 1 ? 'done' : 'next'}
                      style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            <LinearGradient colors={[LogoNavy, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.save}>
              {saving ? (
                <ActivityIndicator color={Brand.white} />
              ) : (
                <>
                  <MaterialCommunityIcons name="content-save-outline" size={18} color={Brand.white} />
                  <Text style={styles.saveText}>SAVE CHANGES</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  header: {
    height: 52,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 4,
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  avoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    marginLeft: 8,
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF3F8',
    marginLeft: 44,
  },
  field: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCopy: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  fieldLabel: {
    color: '#8AA0B5',
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  input: {
    marginTop: 2,
    minHeight: 22,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    paddingVertical: 0,
  },
  error: {
    marginTop: 12,
    marginHorizontal: 4,
    color: Brand.error,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: PageBg,
  },
  save: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    marginLeft: 8,
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.3,
  },
});
