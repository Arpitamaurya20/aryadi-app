import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
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

export function HelpDeskScreen({ user, onBack }: HelpDeskScreenProps) {
  const [name, setName] = useState(user.username.trim().toUpperCase());
  const [mobile, setMobile] = useState((user.phone ?? '').replace(/\D/g, '').slice(0, 10));
  const [issue, setIssue] = useState('');
  const [imageName, setImageName] = useState<string | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageName(asset.fileName ?? 'Image selected');
  }

  function handleSubmit() {
    if (!name.trim()) {
      Alert.alert('Please enter your name.');
      return;
    }
    if (mobile.length < 10) {
      Alert.alert('Please enter a valid mobile number.');
      return;
    }
    if (!issue.trim()) {
      Alert.alert('Please describe the issue.');
      return;
    }
    Alert.alert('Issue submitted successfully.', undefined, [{ text: 'OK', onPress: onBack }]);
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
            <Text style={styles.headerTitle}>Help Desk</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
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
            <AryadiLogo width={160} height={42} />
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
            <UnderlineField
              label="Issue"
              value={issue}
              multiline
              grow
              onChangeText={setIssue}
            />

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

            <Pressable onPress={handleSubmit} accessibilityRole="button" accessibilityLabel="Submit" style={styles.submitWrap}>
              <LinearGradient colors={[LogoNavy, '#1568B8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                <Text style={styles.submitText}>SUBMIT</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  grow,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'characters' | 'sentences';
  multiline?: boolean;
  grow?: boolean;
}) {
  return (
    <View style={[styles.field, grow && styles.fieldGrow]}>
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
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
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
    flex: 1,
    width: '100%',
    marginTop: 18,
    backgroundColor: Brand.white,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  field: {
    marginBottom: 16,
  },
  fieldGrow: {
    flex: 1,
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
    flex: 1,
    minHeight: 88,
  },
  underline: {
    height: 2,
    backgroundColor: LogoMid,
  },
  uploadBox: {
    marginTop: 8,
    borderWidth: 1.6,
    borderColor: 'rgba(58, 171, 242, 0.75)',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 14,
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
    marginTop: 18,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submit: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
});
