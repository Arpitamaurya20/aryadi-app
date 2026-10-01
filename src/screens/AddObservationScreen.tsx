import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toRawBase64 } from '../api/attendance';
import {
  OBSERVATION_CATEGORIES,
  submitSiteObservation,
  uploadObservationPhoto,
} from '../api/siteVisits';
import { WebCameraModal } from '../components/WebCameraModal';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const WebNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;
const Navy = '#0B356E';
const Sky = '#1E8BE0';
const Light = '#3AABF2';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const FieldBg = '#F8FAFD';
const Danger = '#E11D48';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const PRIORITIES = ['High', 'Medium', 'Low'] as const;
type Priority = (typeof PRIORITIES)[number];

const PriorityMeta: Record<Priority, { icon: IconName; color: string; bg: string; border: string; hint: string }> = {
  High: { icon: 'fire', color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5', hint: 'Needs immediate action' },
  Medium: { icon: 'alert-outline', color: '#B45309', bg: '#FFFBEB', border: '#FCD34D', hint: 'Plan within this cycle' },
  Low: { icon: 'arrow-down-circle-outline', color: '#15803D', bg: '#F0FDF4', border: '#86EFAC', hint: 'Can be scheduled later' },
};

const ObservationLimit = 1000;

type AddObservationScreenProps = {
  siteVisitId: number;
  createdBy: string;
  onBack: () => void;
  onSaved: () => void;
};

export function AddObservationScreen({ siteVisitId, createdBy, onBack, onSaved }: AddObservationScreenProps) {
  const [observation, setObservation] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [auditorRecommendation, setAuditorRecommendation] = useState('');
  const [clientRecommendation, setClientRecommendation] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [photoUri, setPhotoUri] = useState('');
  const [photoData, setPhotoData] = useState('');
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [webCameraOpen, setWebCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tempObservationId] = useState(() => String(Date.now()));

  const requiredDone = [
    observation.trim().length > 0,
    location.trim().length > 0,
    auditorRecommendation.trim().length > 0,
    clientRecommendation.trim().length > 0,
    priority !== '',
  ];
  const doneCount = requiredDone.filter(Boolean).length;
  const requiredTotal = requiredDone.length;
  const canSave = doneCount === requiredTotal;

  const filteredCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    if (!query) return OBSERVATION_CATEGORIES;
    return OBSERVATION_CATEGORIES.filter((item) => item.toLowerCase().includes(query));
  }, [categoryQuery]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (categoryOpen) {
        setCategoryOpen(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [categoryOpen, onBack]);

  function applyPhoto(uri: string, base64: string | null | undefined) {
    const raw = base64 ? toRawBase64(base64) : '';
    if (!raw) {
      setError('Unable to read the photo. Please try again.');
      return;
    }
    setPhotoUri(uri);
    setPhotoData(raw);
    setPhotoUploaded(false);
    setError('');
  }

  function removePhoto() {
    setPhotoUri('');
    setPhotoData('');
    setPhotoUploaded(false);
  }

  async function pickFromFiles() {
    setWebCameraOpen(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (result.canceled || !result.assets[0]) return;
      applyPhoto(result.assets[0].uri, result.assets[0].base64);
    } catch {
      setError('Unable to open your files.');
    }
  }

  async function capturePhoto() {
    setError('');
    if (Platform.OS === 'web') {
      setWebCameraOpen(true);
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera permission is required to capture a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      applyPhoto(result.assets[0].uri, result.assets[0].base64);
    } catch {
      setError('Unable to open the camera.');
    }
  }

  async function handleSave() {
    if (!canSave || saving) return;
    if (!createdBy.trim()) {
      setError('Sign in again to save this observation.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (photoData && !photoUploaded) {
        await uploadObservationPhoto({
          siteVisitId,
          createdBy: createdBy.trim(),
          tempObservationId,
          imageData: photoData,
        });
        setPhotoUploaded(true);
      }
      await submitSiteObservation({
        siteVisitId,
        createdBy: createdBy.trim(),
        tempObservationId,
        category,
        priority,
        observation: observation.trim(),
        location: location.trim(),
        auditorRecommendation: auditorRecommendation.trim(),
        clientRecommendation: clientRecommendation.trim(),
      });
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the observation.');
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={[styles.glow, styles.glowOne]} />
        <View style={[styles.glow, styles.glowTwo]} />
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.glassBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Add Observation</Text>
              <Text style={styles.headerSub}>Site Visit #{siteVisitId}</Text>
            </View>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="clipboard-edit-outline" size={22} color={Brand.white} />
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Required fields</Text>
              <Text style={styles.progressValue}>
                {doneCount}/{requiredTotal} completed
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(doneCount / requiredTotal) * 100}%` }]} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SectionCard step={1} icon="text-box-outline" title="Observation Details" subtitle="Describe what you found on site">
            <FormInput
              label="Observation"
              required
              icon="clipboard-text-outline"
              value={observation}
              onChangeText={(text) => setObservation(text.slice(0, ObservationLimit))}
              placeholder="Describe the issue, condition or finding..."
              multiline
              minHeight={120}
              footer={`${observation.length}/${ObservationLimit}`}
            />
            <FormInput
              label="Location"
              required
              icon="map-marker-outline"
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Ground floor, server room"
            />
            <View style={styles.field}>
              <FieldLabel label="Category" optional />
              <Pressable
                onPress={() => {
                  setCategoryQuery('');
                  setCategoryOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={category ? `Category ${category}` : 'Choose a category'}
                style={({ pressed }) => [styles.inputShell, pressed && styles.inputShellPressed]}
              >
                <MaterialCommunityIcons name="shape-outline" size={19} color={category ? Sky : Muted} />
                <Text style={[styles.selectText, category ? styles.selectValue : null]} numberOfLines={1}>
                  {category || 'Choose a category'}
                </Text>
                {category ? (
                  <Pressable onPress={() => setCategory('')} hitSlop={8} accessibilityLabel="Clear category">
                    <MaterialCommunityIcons name="close" size={18} color={Muted} />
                  </Pressable>
                ) : (
                  <MaterialCommunityIcons name="chevron-down" size={22} color={Muted} />
                )}
              </Pressable>
            </View>
          </SectionCard>

          <SectionCard step={2} icon="lightbulb-on-outline" title="Recommendations" subtitle="Suggested actions to resolve it">
            <FormInput
              label="Auditor Recommendation"
              required
              icon="account-tie-outline"
              value={auditorRecommendation}
              onChangeText={setAuditorRecommendation}
              placeholder="What do you recommend?"
              multiline
              minHeight={88}
            />
            <FormInput
              label="Client Recommendation"
              required
              icon="account-outline"
              value={clientRecommendation}
              onChangeText={setClientRecommendation}
              placeholder="What does the client recommend?"
              multiline
              minHeight={88}
            />
          </SectionCard>

          <SectionCard step={3} icon="flag-outline" title="Priority" subtitle="How urgent is this observation?" required>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((item) => {
                const meta = PriorityMeta[item];
                const selected = priority === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setPriority(item)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${item} priority`}
                    style={({ pressed }) => [
                      styles.priorityCard,
                      selected && { backgroundColor: meta.bg, borderColor: meta.border },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={[styles.priorityIcon, { backgroundColor: selected ? meta.color : meta.bg }]}>
                      <MaterialCommunityIcons name={meta.icon} size={18} color={selected ? Brand.white : meta.color} />
                    </View>
                    <Text style={[styles.priorityName, selected && { color: meta.color }]}>{item}</Text>
                    {selected ? (
                      <View style={[styles.priorityCheck, { backgroundColor: meta.color }]}>
                        <MaterialCommunityIcons name="check" size={11} color={Brand.white} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {priority ? (
              <Text style={[styles.priorityHint, { color: PriorityMeta[priority].color }]}>{PriorityMeta[priority].hint}</Text>
            ) : null}
          </SectionCard>

          <SectionCard step={4} icon="camera-outline" title="Photo Evidence" subtitle="Attach a photo of the observation">
            {photoUri ? (
              <View style={styles.photoCard}>
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                <View style={styles.photoBar}>
                  <View style={styles.photoInfo}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#16A34A" />
                    <Text style={styles.photoInfoText}>Photo attached</Text>
                  </View>
                  <View style={styles.photoActions}>
                    <Pressable onPress={capturePhoto} style={styles.photoAction} accessibilityRole="button" accessibilityLabel="Retake photo">
                      <MaterialCommunityIcons name="camera-retake-outline" size={17} color={Sky} />
                      <Text style={styles.photoActionText}>Retake</Text>
                    </Pressable>
                    <Pressable onPress={removePhoto} style={styles.photoAction} accessibilityRole="button" accessibilityLabel="Remove photo">
                      <MaterialCommunityIcons name="trash-can-outline" size={17} color={Danger} />
                      <Text style={[styles.photoActionText, { color: Danger }]}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={capturePhoto}
                accessibilityRole="button"
                accessibilityLabel="Capture photo"
                style={({ pressed }) => [styles.dropZone, pressed && { backgroundColor: '#EAF4FE' }]}
              >
                <View style={styles.dropIcon}>
                  <MaterialCommunityIcons name="camera-plus-outline" size={26} color={Sky} />
                </View>
                <Text style={styles.dropTitle}>Tap to capture photo</Text>
                <Text style={styles.dropSub}>Use the camera or choose an image</Text>
              </Pressable>
            )}
          </SectionCard>

          {error ? (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={Danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            accessibilityRole="button"
            accessibilityLabel="Save observation"
            accessibilityState={{ disabled: !canSave || saving }}
          >
            {canSave ? (
              <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.save}>
                {saving ? (
                  <ActivityIndicator color={Brand.white} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save-outline" size={20} color={Brand.white} />
                    <Text style={styles.saveText}>Save Observation</Text>
                  </>
                )}
              </LinearGradient>
            ) : (
              <View style={[styles.save, styles.saveOff]}>
                <Text style={styles.saveOffText}>
                  Complete required fields ({doneCount}/{requiredTotal})
                </Text>
              </View>
            )}
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <Modal visible={categoryOpen} transparent animationType="slide" onRequestClose={() => setCategoryOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setCategoryOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose Category</Text>
              <Pressable onPress={() => setCategoryOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={22} color={Slate} />
              </Pressable>
            </View>
            <View style={styles.searchBox}>
              <MaterialCommunityIcons name="magnify" size={19} color={Muted} />
              <TextInput
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                placeholder="Search categories"
                placeholderTextColor={Muted}
                style={[styles.searchInput, WebNoOutline]}
              />
            </View>
            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              {filteredCategories.length === 0 ? (
                <Text style={styles.sheetEmpty}>No categories match "{categoryQuery}".</Text>
              ) : (
                filteredCategories.map((item) => {
                  const selected = item === category;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        setCategory(item);
                        setCategoryOpen(false);
                      }}
                      style={({ pressed }) => [styles.option, selected && styles.optionOn, pressed && { backgroundColor: '#F1F6FC' }]}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextOn]}>{item}</Text>
                      {selected ? <MaterialCommunityIcons name="check" size={18} color={Sky} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <WebCameraModal
        visible={webCameraOpen}
        title="Capture Photo"
        onCancel={() => setWebCameraOpen(false)}
        onCapture={(dataUrl) => {
          setWebCameraOpen(false);
          applyPhoto(dataUrl, dataUrl);
        }}
        onPickFile={() => void pickFromFiles()}
      />
    </View>
  );
}

function SectionCard({
  step,
  icon,
  title,
  subtitle,
  required = false,
  children,
}: {
  step: number;
  icon: IconName;
  title: string;
  subtitle: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <MaterialCommunityIcons name={icon} size={20} color={Sky} />
        </View>
        <View style={styles.cardHeadText}>
          <Text style={styles.cardTitle}>
            {title}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
          <Text style={styles.cardSub}>{subtitle}</Text>
        </View>
        <Text style={styles.stepText}>STEP {step}</Text>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function FieldLabel({ label, required = false, optional = false }: { label: string; required?: boolean; optional?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {optional ? <Text style={styles.optional}>Optional</Text> : null}
    </View>
  );
}

function FormInput({
  label,
  required = false,
  icon,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  minHeight,
  footer,
}: {
  label: string;
  required?: boolean;
  icon: IconName;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  minHeight?: number;
  footer?: string;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.trim().length > 0;
  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} />
      <View
        style={[
          styles.inputShell,
          multiline && styles.inputShellMultiline,
          multiline && minHeight ? { minHeight } : null,
          focused && styles.inputShellFocused,
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={19}
          color={focused || filled ? Sky : Muted}
          style={multiline ? styles.multilineIcon : undefined}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Muted}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && minHeight ? { minHeight: minHeight - 26 } : null, WebNoOutline]}
        />
        {filled && !multiline ? <MaterialCommunityIcons name="check-circle" size={17} color="#16A34A" /> : null}
      </View>
      {footer ? <Text style={styles.counter}>{footer}</Text> : null}
    </View>
  );
}

const cardShadow = brandShadow('0 10px 24px rgba(11, 53, 110, 0.07)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.07,
  shadowRadius: 14,
  elevation: 3,
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PageBg },
  flex: { flex: 1 },

  hero: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 18,
  },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  glowOne: { width: 200, height: 200, top: -80, right: -60 },
  glowTwo: { width: 140, height: 140, bottom: -70, left: -40, backgroundColor: 'rgba(58,171,242,0.18)' },
  header: {
    paddingHorizontal: 14,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  glassBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { color: Brand.white, fontSize: 19, fontFamily: 'Poppins_700Bold' },
  headerSub: { color: 'rgba(255,255,255,0.78)', fontSize: 12.5, fontFamily: 'Poppins_500Medium', marginTop: -2 },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Poppins_500Medium' },
  progressValue: { color: Brand.white, fontSize: 12.5, fontFamily: 'Poppins_700Bold' },
  progressTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Light },

  content: { padding: 16, paddingBottom: 24 },

  card: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Line,
    marginBottom: 14,
    ...cardShadow,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F8',
    gap: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F3FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeadText: { flex: 1 },
  cardTitle: { color: Ink, fontSize: 15.5, fontFamily: 'Poppins_700Bold' },
  cardSub: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: -1 },
  stepText: {
    color: Sky,
    fontSize: 10,
    letterSpacing: 0.8,
    fontFamily: 'Poppins_700Bold',
    backgroundColor: '#EEF6FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16 },

  field: { marginTop: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  label: { color: Navy, fontSize: 13.5, fontFamily: 'Poppins_600SemiBold' },
  optional: { color: Muted, fontSize: 11.5, fontFamily: 'Poppins_500Medium' },
  required: { color: Danger },

  inputShell: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Line,
    backgroundColor: FieldBg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputShellMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  inputShellFocused: { borderColor: Sky, backgroundColor: Brand.white },
  inputShellPressed: { borderColor: Sky },
  multilineIcon: { marginTop: 2 },
  input: {
    flex: 1,
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    paddingVertical: 0,
  },
  counter: { marginTop: 5, alignSelf: 'flex-end', color: Muted, fontSize: 11, fontFamily: 'Poppins_500Medium' },
  selectText: { flex: 1, color: Muted, fontSize: 14, fontFamily: 'Poppins_400Regular' },
  selectValue: { color: Ink, fontFamily: 'Poppins_500Medium' },

  priorityRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  priorityCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Line,
    backgroundColor: FieldBg,
  },
  priorityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityName: { marginTop: 8, color: Ink, fontSize: 13.5, fontFamily: 'Poppins_600SemiBold' },
  priorityCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityHint: { marginTop: 10, textAlign: 'center', fontSize: 12, fontFamily: 'Poppins_500Medium' },

  dropZone: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B9D7F3',
    backgroundColor: '#F5FAFF',
  },
  dropIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E3F0FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropTitle: { marginTop: 10, color: Navy, fontSize: 14.5, fontFamily: 'Poppins_600SemiBold' },
  dropSub: { marginTop: 2, color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular' },
  photoCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Line,
    overflow: 'hidden',
    backgroundColor: Brand.white,
  },
  photo: { width: '100%', height: 190, backgroundColor: '#E8EEF6' },
  photoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  photoInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoInfoText: { color: '#15803D', fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3F7FC',
  },
  photoActionText: { color: Sky, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  errorText: { flex: 1, color: '#BE123C', fontSize: 12.5, lineHeight: 18, fontFamily: 'Poppins_500Medium' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: Brand.white,
    borderTopWidth: 1,
    borderTopColor: Line,
  },
  save: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveOff: { backgroundColor: '#EEF2F7' },
  saveText: { color: Brand.white, fontSize: 15.5, fontFamily: 'Poppins_700Bold' },
  saveOffText: { color: Muted, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '78%',
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D5DEE9',
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  sheetTitle: { color: Ink, fontSize: 17, fontFamily: 'Poppins_700Bold' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: FieldBg,
  },
  searchInput: { flex: 1, color: Ink, fontSize: 14, fontFamily: 'Poppins_400Regular', paddingVertical: 0 },
  sheetList: { marginTop: 8 },
  sheetEmpty: { paddingVertical: 24, textAlign: 'center', color: Slate, fontSize: 13, fontFamily: 'Poppins_400Regular' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 12,
  },
  optionOn: { backgroundColor: '#EEF6FE' },
  optionText: { flex: 1, color: Ink, fontSize: 14, fontFamily: 'Poppins_500Medium' },
  optionTextOn: { color: Sky, fontFamily: 'Poppins_600SemiBold' },
});
