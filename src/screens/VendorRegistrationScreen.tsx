import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  BackHandler,
  Image,
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
const FieldLine = '#D3E2F0';
const Hint = '#7A8CA5';
const PhotoWash = '#D7EEFB';

const vendorTypes = [
  'Goods Supplier',
  'Service Provider',
  'Contractor',
  'Manufacturer',
  'Consultant',
  'Transporter',
];

const indianStates = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

type VendorRegistrationScreenProps = {
  onBack: () => void;
};

type UploadKey = 'photo' | 'gst' | 'pan' | 'aadhaar' | 'cheque';

export function VendorRegistrationScreen({ onBack }: VendorRegistrationScreenProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [vendorType, setVendorType] = useState('');
  const [vendorCategory, setVendorCategory] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [remarks, setRemarks] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [uploads, setUploads] = useState<Record<UploadKey, string | null>>({
    photo: null,
    gst: null,
    pan: null,
    aadhaar: null,
    cheque: null,
  });
  const [openMenu, setOpenMenu] = useState<'type' | 'state' | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  async function pick(target: UploadKey) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploads((current) => ({ ...current, [target]: result.assets[0].uri }));
  }

  function handleSubmit() {
    const missing = (
      [
        ['Profile photo', !uploads.photo],
        ['Full name', !fullName.trim()],
        ['Phone number', !phone.trim()],
        ['Email ID', !email.trim()],
        ['Business name', !businessName.trim()],
        ['Vendor type', !vendorType],
        ['Vendor category', !vendorCategory.trim()],
        ['Pincode', !pincode.trim()],
        ['City', !city.trim()],
        ['State', !state],
        ['Current address', !currentAddress.trim()],
        ['Permanent address', !permanentAddress.trim()],
        ['GST number', !gstNumber.trim()],
        ['GST image', !uploads.gst],
        ['PAN number', !panNumber.trim()],
        ['PAN image', !uploads.pan],
        ['Aadhaar number', !aadhaarNumber.trim()],
        ['Aadhaar image', !uploads.aadhaar],
        ['Bank name', !bankName.trim()],
        ['Account name', !accountName.trim()],
        ['Account number', !accountNumber.trim()],
        ['IFSC code', !ifsc.trim()],
        ['Cancel cheque image', !uploads.cheque],
      ] as const
    ).find((item) => item[1])?.[0];

    if (missing) {
      Alert.alert(`Please add ${missing}.`);
      return;
    }
    Alert.alert('Vendor registration submitted for review.', undefined, [{ text: 'OK', onPress: onBack }]);
  }

  const cardShadow = brandShadow('0 16px 22px rgba(11, 53, 110, 0.14)', {
    shadowColor: LogoNavy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  });

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Vendor Registration</Text>
          </View>
          <Text style={styles.headerHint}>Add vendor, document and bank details</Text>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, cardShadow]}>
            <ProfilePhoto uri={uploads.photo} onPick={() => pick('photo')} />
            <View style={styles.sectionRow}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>Vendor details</Text>
            </View>
            <FormField label="Full Name" hint="Enter your full name" value={fullName} onChangeText={setFullName} />
            <FormField
              label="Phone Number"
              hint="Enter mobile number"
              value={phone}
              keyboardType="phone-pad"
              onChangeText={(value) => setPhone(value.replace(/\D/g, '').slice(0, 10))}
            />
            <FormField
              label="Email ID"
              hint="Enter email address"
              value={email}
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={setEmail}
            />
            <FormField
              label="Business Name"
              hint="Enter business name"
              value={businessName}
              onChangeText={setBusinessName}
            />
            <DropdownField
              label="Vendor Type"
              hint="Select vendor type"
              value={vendorType}
              options={vendorTypes}
              expanded={openMenu === 'type'}
              onToggle={() => setOpenMenu((current) => (current === 'type' ? null : 'type'))}
              onSelect={(value) => {
                setVendorType(value);
                setOpenMenu(null);
              }}
            />
            <FormField
              label="Vendor Category"
              hint="e.g. Electrical, Civil"
              value={vendorCategory}
              onChangeText={setVendorCategory}
            />
            <FormField
              label="Pincode"
              hint="Enter 6-digit pincode"
              value={pincode}
              keyboardType="number-pad"
              onChangeText={(value) => setPincode(value.replace(/\D/g, '').slice(0, 6))}
            />
            <FormField label="City" hint="Enter city name" value={city} onChangeText={setCity} />
            <DropdownField
              label="State"
              hint="Select state"
              value={state}
              options={indianStates}
              expanded={openMenu === 'state'}
              onToggle={() => setOpenMenu((current) => (current === 'state' ? null : 'state'))}
              onSelect={(value) => {
                setState(value);
                setOpenMenu(null);
              }}
            />
            <FormField
              label="Current Address"
              hint="Enter current address"
              value={currentAddress}
              multiline
              onChangeText={setCurrentAddress}
            />
            <FormField
              label="Permanent Address"
              hint="Enter permanent address"
              value={permanentAddress}
              multiline
              onChangeText={setPermanentAddress}
            />
            <FormField
              label="Remarks / Notes (Optional)"
              hint="Enter any additional remarks"
              value={remarks}
              multiline
              onChangeText={setRemarks}
            />
          </View>

          <View style={[styles.card, styles.docsCard, cardShadow]}>
            <View style={styles.sectionRow}>
              <View style={styles.sectionBar} />
              <Text style={styles.sectionTitle}>Required documents</Text>
            </View>

            <DocumentBlock number={1} title="GST details">
              <FormField
                label="GST Number"
                hint="Enter 15-digit GSTIN"
                value={gstNumber}
                autoCapitalize="characters"
                onChangeText={(value) => setGstNumber(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 15))}
              />
              <UploadBox label="Upload GST certificate" uri={uploads.gst} onPick={() => pick('gst')} />
            </DocumentBlock>
            <View style={styles.divider} />
            <DocumentBlock number={2} title="PAN card">
              <FormField
                label="PAN Number"
                hint="Enter 10-digit PAN"
                value={panNumber}
                autoCapitalize="characters"
                onChangeText={(value) => setPanNumber(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10))}
              />
              <UploadBox label="Upload PAN card image" uri={uploads.pan} onPick={() => pick('pan')} />
            </DocumentBlock>
            <View style={styles.divider} />
            <DocumentBlock number={3} title="Aadhaar card">
              <FormField
                label="Aadhaar Number"
                hint="Enter 12-digit Aadhaar"
                value={aadhaarNumber}
                keyboardType="number-pad"
                onChangeText={(value) => setAadhaarNumber(value.replace(/\D/g, '').slice(0, 12))}
              />
              <UploadBox label="Upload Aadhaar card image" uri={uploads.aadhaar} onPick={() => pick('aadhaar')} />
            </DocumentBlock>
            <View style={styles.divider} />
            <DocumentBlock number={4} title="Bank details">
              <FormField label="Bank Name" hint="Enter bank name" value={bankName} onChangeText={setBankName} />
              <FormField
                label="Account Name"
                hint="Enter account holder name"
                value={accountName}
                onChangeText={setAccountName}
              />
              <FormField
                label="Account Number"
                hint="Enter account number"
                value={accountNumber}
                keyboardType="number-pad"
                onChangeText={(value) => setAccountNumber(value.replace(/\D/g, '').slice(0, 18))}
              />
              <FormField
                label="IFSC Code"
                hint="Enter IFSC code"
                value={ifsc}
                autoCapitalize="characters"
                onChangeText={(value) => setIfsc(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11))}
              />
              <UploadBox
                label="Upload cancelled cheque / passbook"
                uri={uploads.cheque}
                onPick={() => pick('cheque')}
              />
            </DocumentBlock>
          </View>

          <Text style={styles.mandatory}>All fields marked on this form are mandatory{'\n'}except remarks.</Text>
          <Pressable onPress={handleSubmit} accessibilityRole="button" accessibilityLabel="Submit registration">
            <LinearGradient colors={[LogoNavy, '#1568B8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
              <Text style={styles.submitText}>Submit registration</Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ProfilePhoto({ uri, onPick }: { uri: string | null; onPick: () => void }) {
  return (
    <View style={styles.photoWrap}>
      <View>
        <Pressable onPress={onPick} accessibilityRole="button" accessibilityLabel="Upload profile photo" style={styles.photoCircle}>
          {uri ? (
            <Image source={{ uri }} style={styles.photoImage} />
          ) : (
            <MaterialIcons name="person" size={42} color={LogoMid} />
          )}
        </Pressable>
        <Pressable onPress={onPick} style={styles.cameraBadge} accessibilityRole="button" accessibilityLabel="Camera">
          <MaterialIcons name="photo-camera" size={13} color={Brand.white} />
        </Pressable>
      </View>
      <Text style={styles.photoTitle}>{uri ? 'Photo selected' : 'Upload profile photo'}</Text>
      <Text style={styles.photoHint}>Tap to add a clear passport-size photo</Text>
    </View>
  );
}

function DocumentBlock({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <View>
      <View style={styles.docHead}>
        <View style={styles.docBadge}>
          <Text style={styles.docBadgeText}>{number}</Text>
        </View>
        <Text style={styles.docTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function FormField({
  label,
  hint,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  multiline,
}: {
  label: string;
  hint: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'characters';
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, multiline ? styles.inputMultiline : null]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={hint}
          placeholderTextColor={Hint}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={label}
          style={[
            styles.input,
            multiline ? styles.inputTall : null,
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          ]}
        />
      </View>
    </View>
  );
}

function DropdownField({
  label,
  hint,
  value,
  options,
  expanded,
  onToggle,
  onSelect,
}: {
  label: string;
  hint: string;
  value: string;
  options: string[];
  expanded: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={label} style={styles.inputWrap}>
        <Text style={[styles.dropdownText, value ? styles.dropdownValue : null]} numberOfLines={1}>
          {value || hint}
        </Text>
        <MaterialIcons name="expand-more" size={20} color={Hint} />
      </Pressable>
      {expanded ? (
        <ScrollView nestedScrollEnabled style={styles.menu} keyboardShouldPersistTaps="handled">
          {options.map((option) => (
            <Pressable key={option} onPress={() => onSelect(option)} style={styles.option}>
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function UploadBox({ label, uri, onPick }: { label: string; uri: string | null; onPick: () => void }) {
  const selected = Boolean(uri);
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.upload, selected ? styles.uploadSelected : null]}
    >
      <MaterialIcons
        name={selected ? 'check-circle' : 'cloud-upload'}
        size={22}
        color={selected ? LogoMid : Hint}
      />
      <Text style={[styles.uploadText, selected ? styles.uploadValue : null]}>
        {selected ? 'File selected · tap to replace' : label}
      </Text>
    </Pressable>
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
    height: 52,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  headerHint: {
    paddingLeft: 56,
    paddingRight: 20,
    paddingBottom: 32,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  scroller: {
    flex: 1,
    marginTop: -20,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 22,
    padding: 20,
  },
  docsCard: {
    marginTop: 16,
  },
  photoWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: PhotoWash,
    borderWidth: 3,
    borderColor: LogoSky,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LogoNavy,
    borderWidth: 2,
    borderColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTitle: {
    marginTop: 10,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  photoHint: {
    marginTop: 2,
    color: Hint,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: LogoMid,
    marginRight: 8,
  },
  sectionTitle: {
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  fieldBlock: {
    marginBottom: 12,
  },
  label: {
    color: LogoNavy,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    marginBottom: 6,
  },
  inputWrap: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FieldLine,
    backgroundColor: Brand.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputMultiline: {
    height: 84,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    padding: 0,
  },
  inputTall: {
    height: '100%',
    width: '100%',
  },
  dropdownText: {
    flex: 1,
    color: Hint,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  dropdownValue: {
    color: LogoNavy,
  },
  menu: {
    marginTop: 6,
    maxHeight: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FieldLine,
    backgroundColor: Brand.white,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  optionText: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  docHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  docBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LogoMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  docBadgeText: {
    color: Brand.white,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  docTitle: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  divider: {
    height: 1,
    backgroundColor: FieldLine,
    marginVertical: 16,
  },
  upload: {
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1.4,
    borderColor: FieldLine,
    borderStyle: 'dashed',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.white,
  },
  uploadSelected: {
    backgroundColor: PhotoWash,
    borderColor: LogoMid,
    borderStyle: 'solid',
  },
  uploadText: {
    flex: 1,
    marginLeft: 12,
    color: Hint,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  uploadValue: {
    color: LogoNavy,
  },
  mandatory: {
    marginTop: 18,
    marginBottom: 12,
    color: Hint,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  submit: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
});
