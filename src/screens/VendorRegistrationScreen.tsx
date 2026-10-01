import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
import type { AuthUser } from '../api/auth';
import { fetchVendorRegistrationDetails, fetchVendorRegistrations, submitVendorRegistration, type VendorRegistration, type VendorRegistrationDetail } from '../api/vendors';
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

const stateIds: Record<string, number> = {
  'Andhra Pradesh': 4,
  'Arunachal Pradesh': 5,
  Assam: 6,
  Bihar: 2,
  Chhattisgarh: 8,
  Delhi: 31,
  Goa: 10,
  Gujarat: 11,
  Haryana: 12,
  'Himachal Pradesh': 13,
  Jharkhand: 14,
  Karnataka: 15,
  Kerala: 16,
  'Madhya Pradesh': 17,
  Maharashtra: 18,
  Manipur: 19,
  Meghalaya: 20,
  Mizoram: 21,
  Nagaland: 22,
  Odisha: 23,
  Punjab: 24,
  Rajasthan: 25,
  Sikkim: 26,
  'Tamil Nadu': 27,
  Telangana: 28,
  Tripura: 29,
  'Uttar Pradesh': 1,
  Uttarakhand: 9,
  'West Bengal': 7,
};

type VendorRegistrationScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

type UploadKey = 'photo' | 'gst' | 'pan' | 'aadhaar' | 'cheque';

function vendorStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('reject')) return { backgroundColor: '#FEE2E2', color: '#DC2626' };
  if (normalized === 'approved') return { backgroundColor: '#DDF6E8', color: '#16A34A' };
  return { backgroundColor: '#E8F4FD', color: LogoMid };
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function VendorRegistrationScreen({ user, onBack }: VendorRegistrationScreenProps) {
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<VendorRegistrationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [vendors, setVendors] = useState<VendorRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const formScrollRef = useRef<ScrollView>(null);

  function rejectForm(message: string) {
    setFormError(message);
    requestAnimationFrame(() => formScrollRef.current?.scrollToEnd({ animated: true }));
  }

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchVendorRegistrations(user.employeeId);
      setVendors(rows);
    } catch (loadError) {
      setVendors([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load vendor registrations.');
    } finally {
      setLoading(false);
    }
  }, [user.employeeId]);

  useEffect(() => {
    if (showForm) return;
    void loadVendors();
  }, [loadVendors, showForm]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showForm) {
        setShowForm(false);
        return true;
      }
      if (detailId != null) {
        setDetailId(null);
        setDetail(null);
        setDetailError('');
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [detailId, onBack, showForm]);

  async function pick(target: UploadKey) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      rejectForm('Unable to read the selected image.');
      return;
    }
    const mime = asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${asset.base64}`;
    if (dataUrl.length > 6_500_000) {
      rejectForm('Please choose a smaller image (max 5MB).');
      return;
    }
    setUploads((current) => ({ ...current, [target]: dataUrl }));
  }

  function clearForm() {
    setFullName('');
    setPhone('');
    setEmail('');
    setBusinessName('');
    setVendorType('');
    setVendorCategory('');
    setPincode('');
    setCity('');
    setState('');
    setCurrentAddress('');
    setPermanentAddress('');
    setRemarks('');
    setGstNumber('');
    setPanNumber('');
    setAadhaarNumber('');
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setIfsc('');
    setUploads({ photo: null, gst: null, pan: null, aadhaar: null, cheque: null });
    setOpenMenu(null);
  }

  async function handleSubmit() {
    setFormError('');
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
      rejectForm(`Please add ${missing}.`);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      rejectForm('Enter a valid email address.');
      return;
    }
    if (phone.length < 10) {
      rejectForm('Enter a 10-digit mobile number.');
      return;
    }
    if (!/^[A-Z0-9]{15}$/.test(gstNumber.trim().toUpperCase())) {
      rejectForm('GST number must be 15 letters or digits.');
      return;
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.trim().toUpperCase())) {
      rejectForm('PAN must look like ABCDE1234F.');
      return;
    }
    if (aadhaarNumber.length !== 12) {
      rejectForm('Aadhaar number must be 12 digits.');
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase())) {
      rejectForm('IFSC must be 11 characters and the 5th character must be 0, for example HDFC0001234.');
      return;
    }
    if (!user.employeeId) {
      rejectForm('Sign in again to register a vendor.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitVendorRegistration({
        employeeId: String(user.employeeId),
        name: fullName,
        mobile: phone,
        email,
        profileImage: uploads.photo ?? '',
        gstNumber,
        gstImage: uploads.gst ?? '',
        panNumber,
        panImage: uploads.pan ?? '',
        aadhaarNumber,
        aadhaarImage: uploads.aadhaar ?? '',
        cancelChequeImage: uploads.cheque ?? '',
        accountName,
        accountNumber,
        ifscCode: ifsc,
        currentAddress,
        permanentAddress,
        businessName,
        vendorType,
        vendorCategory,
        pincode,
        city,
        stateId: stateIds[state] ?? '',
        stateName: state,
        bankName,
        remarks,
      });
      clearForm();
      setShowForm(false);
      await loadVendors();
      setFormError('');
    } catch (submitError) {
      rejectForm(submitError instanceof Error ? submitError.message : 'Vendor registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  function goBack() {
    if (showForm) {
      setShowForm(false);
      return;
    }
    if (detailId != null) {
      setDetailId(null);
      setDetail(null);
      setDetailError('');
      return;
    }
    onBack();
  }

  async function openDetails(id: number) {
    setDetailId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      setDetail(await fetchVendorRegistrationDetails(user.employeeId, id));
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Vendor registration not found');
    } finally {
      setDetailLoading(false);
    }
  }

  if (!showForm && detailId != null) {
    const tone = detail ? vendorStatusTone(detail.status) : null;
    const documents = detail
      ? [
          ['Profile', detail.profileImage],
          ['GST', detail.gstImage],
          ['PAN', detail.panImage],
          ['Aadhaar', detail.aadhaarImage],
          ['Cancelled cheque', detail.cancelChequeImage],
        ].filter((item): item is [string, string] => Boolean(item[1]))
      : [];
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <Pressable onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
                <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
              </Pressable>
              <Text style={styles.headerTitle}>Details</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailPage} showsVerticalScrollIndicator={false}>
          {detailLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={LogoMid} />
            </View>
          ) : detailError ? (
            <Text style={styles.listError}>{detailError}</Text>
          ) : detail ? (
            <>
              <View style={styles.detailCard}>
                <View style={styles.cardTop}>
                  <View style={styles.detailIdentity}>
                    <Text style={styles.detailName}>{detail.businessName || detail.name || 'Vendor'}</Text>
                    {detail.name && detail.businessName ? <Text style={styles.detailSub}>{detail.name}</Text> : null}
                    {detail.registrationCode ? <Text style={styles.detailSub}>{detail.registrationCode}</Text> : null}
                  </View>
                  {tone ? (
                    <View style={[styles.statusChip, { backgroundColor: tone.backgroundColor }]}>
                      <Text style={[styles.statusText, { color: tone.color }]}>{detail.statusLabel}</Text>
                    </View>
                  ) : null}
                </View>
                {detail.mobile ? <DetailLine label="Mobile" value={detail.mobile} /> : null}
                {detail.email ? <DetailLine label="Email" value={detail.email} /> : null}
                {detail.vendorType ? <DetailLine label="Vendor type" value={detail.vendorType} /> : null}
                {detail.vendorCategory ? <DetailLine label="Category" value={detail.vendorCategory} /> : null}
                {[detail.city, detail.stateName, detail.pincode].filter(Boolean).length ? (
                  <DetailLine label="Location" value={[detail.city, detail.stateName, detail.pincode].filter(Boolean).join(', ')} />
                ) : null}
                {detail.currentAddress ? <DetailLine label="Current address" value={detail.currentAddress} /> : null}
                {detail.permanentAddress ? <DetailLine label="Permanent address" value={detail.permanentAddress} /> : null}
                {detail.createdDate ? (
                  <DetailLine label="Submitted" value={`${detail.createdDate}${detail.createdTime ? ` ${detail.createdTime}` : ''}`} />
                ) : null}
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.sectionHeading}>Documents</Text>
                {detail.gstNumber ? <DetailLine label="GST" value={detail.gstNumber} /> : null}
                {detail.panNumber ? <DetailLine label="PAN" value={detail.panNumber} /> : null}
                {detail.aadhaarNumber ? <DetailLine label="Aadhaar" value={detail.aadhaarNumber} /> : null}
                {documents.map(([label, uri]) => (
                  <View key={label} style={styles.documentBlock}>
                    <Text style={styles.documentLabel}>{label}</Text>
                    <Image source={{ uri }} style={styles.documentImage} resizeMode="cover" />
                  </View>
                ))}
              </View>
              {detail.bankName || detail.accountNumber ? (
                <View style={styles.detailCard}>
                  <Text style={styles.sectionHeading}>Bank</Text>
                  {detail.bankName ? <DetailLine label="Bank" value={detail.bankName} /> : null}
                  {detail.accountName ? <DetailLine label="Account name" value={detail.accountName} /> : null}
                  {detail.accountNumber ? <DetailLine label="Account number" value={detail.accountNumber} /> : null}
                  {detail.ifscCode ? <DetailLine label="IFSC" value={detail.ifscCode} /> : null}
                </View>
              ) : null}
              {detail.timeline.length ? (
                <View style={styles.detailCard}>
                  <Text style={styles.sectionHeading}>Status</Text>
                  {detail.timeline.map((step) => (
                    <View key={step.stage} style={styles.timelineRow}>
                      <Text style={styles.timelineStage}>{step.stage}</Text>
                      <Text style={styles.timelineStatus}>{step.status}</Text>
                      {step.datetime ? <Text style={styles.timelineMeta}>{step.datetime}</Text> : null}
                      {step.approverName ? <Text style={styles.timelineMeta}>{step.approverName}</Text> : null}
                      {step.remarks ? <Text style={styles.timelineMeta}>{step.remarks}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {detail.rejectionReason ? (
                <View style={styles.detailCard}>
                  <DetailLine label="Rejection reason" value={detail.rejectionReason} />
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (!showForm) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
                <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
              </Pressable>
              <Text style={styles.headerTitle}>Vendors</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.listPage}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={LogoMid} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {error ? <Text style={styles.listError}>{error}</Text> : null}
              {vendors.map((vendor) => {
                const tone = vendorStatusTone(vendor.status);
                const title = vendor.businessName || vendor.name || 'Vendor';
                const place = [vendor.city, vendor.stateName].filter(Boolean).join(', ');
                return (
                  <View
                    key={vendor.id}
                    style={[
                      styles.vendorCard,
                      brandShadow('0 8px 16px rgba(11, 53, 110, 0.08)', {
                        shadowColor: LogoNavy,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.08,
                        shadowRadius: 10,
                        elevation: 3,
                      }),
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <Text style={styles.vendorTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <View style={[styles.statusChip, { backgroundColor: tone.backgroundColor }]}>
                        <Text style={[styles.statusText, { color: tone.color }]}>{vendor.statusLabel}</Text>
                      </View>
                    </View>
                    {vendor.name && vendor.businessName ? <Text style={styles.vendorMeta}>{vendor.name}</Text> : null}
                    {vendor.vendorType || vendor.vendorCategory ? (
                      <Text style={styles.vendorMeta}>
                        {[vendor.vendorType, vendor.vendorCategory].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    {vendor.mobile ? (
                      <View style={styles.metaRow}>
                        <MaterialCommunityIcons name="phone" size={16} color="#8AA0B5" />
                        <Text style={styles.vendorInline}>{vendor.mobile}</Text>
                      </View>
                    ) : null}
                    {place ? (
                      <View style={styles.metaRow}>
                        <MaterialCommunityIcons name="map-marker-outline" size={16} color="#8AA0B5" />
                        <Text style={styles.vendorInline}>{place}</Text>
                      </View>
                    ) : null}
                    {vendor.createdDate ? (
                      <Text style={styles.vendorDate}>
                        {vendor.createdDate}
                        {vendor.createdTime ? ` ${vendor.createdTime}` : ''}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => void openDetails(vendor.id)}
                      accessibilityRole="button"
                      accessibilityLabel="View details"
                      style={styles.detailsWrap}
                    >
                      <LinearGradient colors={['#1E88E5', '#42A5F5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.detailsBtn}>
                        <Text style={styles.detailsText}>VIEW DETAILS</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <SafeAreaView edges={['bottom']} style={styles.fabWrap} pointerEvents="box-none">
            <Pressable
              onPress={() => setShowForm(true)}
              accessibilityRole="button"
              accessibilityLabel="Add vendor"
              style={[
                styles.fab,
                brandShadow('0 8px 12px rgba(11, 53, 110, 0.28)', {
                  shadowColor: LogoNavy,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.28,
                  shadowRadius: 8,
                  elevation: 8,
                }),
              ]}
            >
              <LinearGradient colors={[LogoNavy, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabFill}>
                <MaterialCommunityIcons name="plus" size={28} color={Brand.white} />
              </LinearGradient>
            </Pressable>
          </SafeAreaView>
        </View>
      </View>
    );
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
            <Pressable onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Vendor Registration</Text>
          </View>
          <Text style={styles.headerHint}>Add vendor, document and bank details</Text>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={formScrollRef}
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
                hint="Example SBIN0001234"
                value={ifsc}
                autoCapitalize="characters"
                onChangeText={(value) => {
                  setIfsc(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11));
                  setFormError('');
                }}
              />
              {ifsc.length > 0 && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) ? (
                <Text style={styles.fieldError}>
                  {ifsc} cannot be submitted. IFSC needs 11 characters, and the 5th character must be 0. SBI codes look like SBIN0001234.
                </Text>
              ) : null}
              <UploadBox
                label="Upload cancelled cheque / passbook"
                uri={uploads.cheque}
                onPick={() => pick('cheque')}
              />
            </DocumentBlock>
          </View>

          <Text style={styles.mandatory}>All fields marked on this form are mandatory{'\n'}except remarks.</Text>
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Submit registration"
            style={styles.submitPress}
          >
            <LinearGradient colors={[LogoNavy, '#1568B8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
              <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit registration'}</Text>
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
  fieldError: {
    marginTop: -6,
    marginBottom: 12,
    color: '#E11D48',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Poppins_500Medium',
  },
  formError: {
    marginBottom: 10,
    color: '#E11D48',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: 'Poppins_500Medium',
  },
  submitPress: {
    width: '100%',
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
  listPage: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  listError: {
    marginBottom: 10,
    color: '#E11D48',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  vendorCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEF3F8',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  vendorTitle: {
    flex: 1,
    marginRight: 10,
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vendorMeta: {
    marginTop: 6,
    color: '#5C6B7A',
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  vendorInline: {
    color: '#5C6B7A',
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  vendorDate: {
    marginTop: 8,
    color: '#8AA0B5',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  fabWrap: {
    position: 'absolute',
    right: 18,
    bottom: 18,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  fabFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsWrap: {
    marginTop: 14,
    borderRadius: 10,
    overflow: 'hidden',
  },
  detailsBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsText: {
    color: Brand.white,
    fontSize: 14,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_700Bold',
  },
  detailScroll: {
    flex: 1,
    backgroundColor: '#F2F4F7',
  },
  detailPage: {
    padding: 12,
    paddingBottom: 24,
  },
  detailCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  detailIdentity: {
    flex: 1,
    marginRight: 10,
  },
  detailName: {
    color: '#111827',
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  detailSub: {
    marginTop: 2,
    color: '#4B5563',
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  detailLine: {
    marginTop: 12,
  },
  detailLabel: {
    color: '#9AA3AD',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  detailValue: {
    marginTop: 2,
    color: '#111827',
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'Poppins_600SemiBold',
  },
  sectionHeading: {
    color: '#111827',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  documentBlock: {
    marginTop: 12,
  },
  documentLabel: {
    marginBottom: 6,
    color: '#9AA3AD',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  documentImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  timelineRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF3F8',
  },
  timelineStage: {
    color: '#111827',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  timelineStatus: {
    marginTop: 2,
    color: LogoMid,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  timelineMeta: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
});
