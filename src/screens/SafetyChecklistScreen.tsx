import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps } from 'react';
import { BackHandler, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebCameraModal } from '../components/WebCameraModal';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const Danger = '#DC2626';
const Success = '#059669';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

const Questions: { key: string; text: string; icon: McIcon }[] = [
  { key: 'uniform', text: 'Are you wearing the company uniform?', icon: 'tshirt-crew-outline' },
  { key: 'jacket', text: 'Are you wearing your safety jacket?', icon: 'account-hard-hat-outline' },
  { key: 'toolkit', text: 'Do you have your insulated toolkit?', icon: 'toolbox-outline' },
  { key: 'shoes', text: 'Are you wearing approved safety shoes?', icon: 'shoe-formal' },
  { key: 'ppe', text: 'Do you have your full PPE kit available?', icon: 'shield-check-outline' },
];

export type SafetyAnswer = { answer: 'yes' | 'no'; photoUri?: string };
export type SafetyAnswers = Record<string, SafetyAnswer>;

const cardShadow = brandShadow('0 6px 18px rgba(11, 53, 110, 0.07)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 2,
});

type SafetyChecklistScreenProps = {
  ticketCode: string;
  initialAnswers?: SafetyAnswers;
  onBack: (answers: SafetyAnswers) => void;
  onSubmit: (answers: SafetyAnswers) => void;
};

export function SafetyChecklistScreen({ ticketCode, initialAnswers, onBack, onSubmit }: SafetyChecklistScreenProps) {
  const [answers, setAnswers] = useState<SafetyAnswers>(initialAnswers ?? {});
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const [webCameraFor, setWebCameraFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (preview) setPreview(null);
      else if (photoFor) setPhotoFor(null);
      else onBack(answers);
      return true;
    });
    return () => sub.remove();
  }, [answers, photoFor, preview, onBack]);

  const pickerOptions: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.4 };

  const setYes = (key: string, photoUri: string) => {
    setAnswers((prev) => ({ ...prev, [key]: { answer: 'yes', photoUri } }));
    setError('');
  };

  const takePhoto = async (key: string) => {
    setPhotoFor(null);
    if (Platform.OS === 'web') {
      setWebCameraFor(key);
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera permission is required to take the safety photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      const uri = !result.canceled ? result.assets[0]?.uri : null;
      if (uri) setYes(key, uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the camera.');
    }
  };

  const chooseFromGallery = async (key: string) => {
    setPhotoFor(null);
    setWebCameraFor(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      const uri = !result.canceled ? result.assets[0]?.uri : null;
      if (uri) setYes(key, uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the gallery.');
    }
  };

  const answerNo = (key: string) => {
    setAnswers((prev) => ({ ...prev, [key]: { answer: 'no' } }));
    setError('');
  };

  const submit = () => {
    const unanswered = Questions.filter((q) => !answers[q.key]);
    if (unanswered.length) {
      setError(`Please answer all ${Questions.length} questions.`);
      return;
    }
    if (Questions.some((q) => answers[q.key]?.answer === 'no')) {
      setError('All safety items must be confirmed with “Yes” before you can start work.');
      return;
    }
    if (Questions.some((q) => !answers[q.key]?.photoUri)) {
      setError('Add a photo for every “Yes” answer.');
      return;
    }
    onSubmit(answers);
  };

  const answeredCount = Questions.filter((q) => answers[q.key]).length;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroGlow} />
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={() => onBack(answers)}
              style={({ pressed }) => [styles.glassButton, pressed && styles.pressed]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={Brand.white} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Employee Safety Checklist</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {ticketCode}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.intro, cardShadow]}>
          <View style={styles.introIcon}>
            <MaterialCommunityIcons name="shield-account-outline" size={24} color={Sky} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Safety Verification</Text>
            <Text style={styles.introText}>Tap “Yes” to take a photo or choose from gallery</Text>
          </View>
          <Text style={styles.introCount}>
            {answeredCount}/{Questions.length}
          </Text>
        </View>

        {Questions.map((question, index) => {
          const current = answers[question.key];
          return (
            <View key={question.key} style={[styles.card, cardShadow, current?.answer === 'no' && styles.cardNo]}>
              <View style={styles.questionRow}>
                <View style={styles.questionIcon}>
                  <MaterialCommunityIcons name={question.icon} size={19} color={Navy} />
                </View>
                <Text style={styles.questionText}>
                  {index + 1}. {question.text}
                </Text>
              </View>

              <View style={styles.options}>
                <Option
                  label="Yes"
                  selected={current?.answer === 'yes'}
                  color={Success}
                  onPress={() => setPhotoFor(question.key)}
                />
                <Option label="No" selected={current?.answer === 'no'} color={Danger} onPress={() => answerNo(question.key)} />
              </View>

              {current?.answer === 'yes' && current.photoUri ? (
                <View style={styles.photoRow}>
                  <Pressable
                    onPress={() => setPreview(current.photoUri ?? null)}
                    style={({ pressed }) => [styles.thumbWrap, pressed && styles.pressed]}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View safety photo"
                  >
                    <Image source={{ uri: current.photoUri }} style={styles.thumb} resizeMode="cover" />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <View style={styles.photoDone}>
                      <MaterialCommunityIcons name="check-circle" size={15} color={Success} />
                      <Text style={styles.photoDoneText}>Photo added</Text>
                    </View>
                    <Pressable onPress={() => setPhotoFor(question.key)} hitSlop={6} accessibilityRole="button">
                      <Text style={styles.retake}>Change photo</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              {current?.answer === 'no' ? (
                <Text style={styles.noNote}>This must be “Yes” before work can start.</Text>
              ) : null}
            </View>
          );
        })}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={submit} style={({ pressed }) => [styles.submit, pressed && styles.pressed]} accessibilityRole="button">
          <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitInner}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={19} color={Brand.white} />
            <Text style={styles.submitText}>Submit Checklist</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>

      <Modal visible={photoFor !== null} transparent animationType="slide" onRequestClose={() => setPhotoFor(null)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPhotoFor(null)} accessibilityLabel="Close" />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add photo</Text>
            <Pressable
              onPress={() => photoFor && void takePhoto(photoFor)}
              style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="camera-outline" size={22} color={Slate} />
              <Text style={styles.sheetRowText}>Take Photo</Text>
            </Pressable>
            <Pressable
              onPress={() => photoFor && void chooseFromGallery(photoFor)}
              style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="image-outline" size={22} color={Slate} />
              <Text style={styles.sheetRowText}>Choose from Gallery</Text>
            </Pressable>
            <Pressable
              onPress={() => setPhotoFor(null)}
              style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
              accessibilityRole="button"
            >
              <Text style={[styles.sheetRowText, { marginLeft: 0 }]}>Cancel</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>

      <WebCameraModal
        visible={webCameraFor !== null}
        title="Safety Photo"
        onCancel={() => setWebCameraFor(null)}
        onCapture={(dataUrl) => {
          const key = webCameraFor;
          setWebCameraFor(null);
          if (key) setYes(key, dataUrl);
        }}
        onPickFile={() => {
          if (webCameraFor) void chooseFromGallery(webCameraFor);
        }}
      />

      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.previewBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreview(null)} accessibilityLabel="Close preview" />
          {preview ? <Image source={{ uri: preview }} style={styles.previewImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </View>
  );
}

function Option({ label, selected, color, onPress }: { label: string; selected: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected && { borderColor: color, backgroundColor: `${color}12` }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View style={[styles.radio, selected && { borderColor: color }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: color }]} /> : null}
      </View>
      <Text style={[styles.optionText, selected && { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PageBg },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  hero: { paddingBottom: 18, overflow: 'hidden', borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -70,
    backgroundColor: 'rgba(58, 171, 242, 0.28)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  glassButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  headerTitle: { color: Brand.white, fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  headerSub: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 12.5, fontFamily: 'Poppins_500Medium' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#EAF4FD',
    borderWidth: 1,
    borderColor: '#CFE4F8',
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.white,
  },
  introTitle: { color: Navy, fontSize: 17, fontFamily: 'Poppins_700Bold' },
  introText: { color: Slate, fontSize: 12.5, fontFamily: 'Poppins_400Regular' },
  introCount: { color: Navy, fontSize: 15, fontFamily: 'Poppins_700Bold' },
  card: { backgroundColor: Brand.white, borderRadius: 18, borderWidth: 1, borderColor: Line, padding: 16 },
  cardNo: { borderColor: '#FBCACA' },
  questionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  questionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3FA',
  },
  questionText: { flex: 1, color: Ink, fontSize: 14.5, lineHeight: 21, fontFamily: 'Poppins_600SemiBold' },
  options: { flexDirection: 'row', gap: 10, marginTop: 14 },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Line,
    backgroundColor: '#F8FAFD',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionText: { color: '#334155', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  thumbWrap: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEF2F7' },
  thumb: { width: '100%', height: '100%' },
  photoDone: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  photoDoneText: { color: Success, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  retake: { color: Sky, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold', marginTop: 4 },
  noNote: { color: Danger, fontSize: 12, fontFamily: 'Poppins_500Medium', marginTop: 10 },
  error: { color: '#B91C1C', fontSize: 12.5, fontFamily: 'Poppins_500Medium', textAlign: 'center' },
  submit: { marginTop: 4, borderRadius: 16, overflow: 'hidden' },
  submitInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52 },
  submitText: { color: Brand.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { backgroundColor: Brand.white, paddingTop: 16, paddingBottom: 8 },
  sheetTitle: { color: Slate, fontSize: 14, fontFamily: 'Poppins_500Medium', paddingHorizontal: 20, marginBottom: 6 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  sheetRowPressed: { backgroundColor: '#F6F9FD' },
  sheetRowText: { color: Ink, fontSize: 15, fontFamily: 'Poppins_500Medium', marginLeft: 18 },
  previewBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.85)' },
  previewImage: { width: '100%', maxWidth: 520, aspectRatio: 3 / 4, borderRadius: 16 },
});
