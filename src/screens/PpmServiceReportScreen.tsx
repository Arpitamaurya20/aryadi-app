import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad';
import {
  fetchPpmServiceReportForm,
  ppmSignatureUrl,
  savePpmClientSignature,
  submitDynamicPpmReport,
  type PpmChecklistItem,
  type PpmGeneralDetails,
  type PpmServiceReportForm,
} from '../api/ppmWork';
import {
  clearPpmReportDraft,
  loadPpmReportDraft,
  savePpmReportDraft,
  type PpmReportDraft,
} from '../storage/ppmReportDraft';
import { Brand } from '../theme/colors';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const Light = '#3AABF2';
const Danger = '#E11D48';
const Success = '#16A34A';
const Warning = '#F97316';

type IconName = ComponentProps<typeof Ionicons>['name'];

const assetConditions: { value: string; icon: IconName; color: string; tint: string }[] = [
  { value: 'Good', icon: 'checkmark-circle-outline', color: Success, tint: '#ECFDF3' },
  { value: 'Not Good', icon: 'warning-outline', color: Warning, tint: '#FFF4EC' },
  { value: 'Bad (BER)', icon: 'close-circle-outline', color: '#DC2626', tint: '#FEF2F2' },
];

type FieldDef = {
  key: keyof PpmGeneralDetails;
  label: string;
  placeholder: string;
  multiline?: boolean;
  keyboard?: 'phone-pad' | 'email-address';
};

const workFields: FieldDef[] = [
  { key: 'ProblemReportedByClient', label: 'Complaint Description', placeholder: 'Enter complaint description', multiline: true },
  { key: 'ActionTaken', label: 'Action Taken', placeholder: 'Enter action taken', multiline: true },
  { key: 'Observation', label: 'Observation', placeholder: 'Enter observation', multiline: true },
  { key: 'Remarks', label: 'Remarks', placeholder: 'Enter remarks', multiline: true },
];

const clientFields: FieldDef[] = [
  { key: 'ClientRepresentative', label: 'Name', placeholder: 'Enter name' },
  { key: 'ClientRepresentativeContact', label: 'Contact No.', placeholder: 'Enter 10 digit contact number', keyboard: 'phone-pad' },
  { key: 'ClientRepresentativeEmails', label: 'Email(s)', placeholder: 'Enter email(s), separated by commas', keyboard: 'email-address' },
  { key: 'ClientRepresentativeDesignation', label: 'Designation', placeholder: 'Enter designation' },
];

type PpmServiceReportScreenProps = {
  ticketId: string;
  ticketCode: string;
  createdBy: string;
  onBack: () => void;
  onSaved: () => void;
};

function isChoiceItem(item: PpmChecklistItem) {
  return item.inputType === 'checkbox' || item.inputType === 'radio' || item.inputType === 'select' || item.options.length > 0;
}

function choicesFor(item: PpmChecklistItem) {
  return item.options.length > 0 ? item.options : ['Ok', 'Not Ok'];
}

function matchAssetCondition(saved: string) {
  const match = assetConditions.find((c) => c.value.toLowerCase() === saved.trim().toLowerCase());
  return match ? match.value : '';
}

function SectionHeader({ icon, title }: { icon: IconName; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionRow}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color={Sky} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionDivider} />
    </View>
  );
}

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.label}>
      {children}
      <Text style={styles.star}> *</Text>
    </Text>
  );
}

export function PpmServiceReportScreen({ ticketId, ticketCode, createdBy, onBack, onSaved }: PpmServiceReportScreenProps) {
  const [form, setForm] = useState<PpmServiceReportForm | null>(null);
  const [general, setGeneral] = useState<PpmGeneralDetails | null>(null);
  const [items, setItems] = useState<PpmChecklistItem[]>([]);
  const [assetCondition, setAssetCondition] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showNoChecklist, setShowNoChecklist] = useState(false);

  const signatureRef = useRef<SignaturePadHandle>(null);
  const [hasInk, setHasInk] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [savedSignature, setSavedSignature] = useState('');
  const [signatureLoadFailed, setSignatureLoadFailed] = useState(false);
  const [inkSaved, setInkSaved] = useState(false);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const [signatureError, setSignatureError] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const dirtyRef = useRef(false);
  const pendingDraftRef = useRef<Omit<PpmReportDraft, 'savedAt'> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushDraft = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    const pending = pendingDraftRef.current;
    pendingDraftRef.current = null;
    if (pending) void savePpmReportDraft(ticketId, pending);
  }, [ticketId]);

  const discardDraft = useCallback(async () => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = null;
    pendingDraftRef.current = null;
    dirtyRef.current = false;
    await clearPpmReportDraft(ticketId);
  }, [ticketId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await fetchPpmServiceReportForm(ticketId);
      const draft = await loadPpmReportDraft(ticketId);
      const draftItems = new Map((draft?.items ?? []).map((item) => [item.id, item]));
      dirtyRef.current = false;
      setRestoredAt(draft ? draft.savedAt : null);
      setForm(result);
      setGeneral(draft ? { ...result.general, ...draft.general } : result.general);
      setItems(
        result.items.map((item) => {
          const saved = draftItems.get(item.id);
          return saved ? { ...item, value: saved.value, status: saved.status, remarks: saved.remarks } : item;
        }),
      );
      setAssetCondition(matchAssetCondition(draft?.assetCondition || result.assetCondition));
      setSavedSignature(result.clientSignature);
      setSignatureLoadFailed(false);
      setShowNoChecklist(!result.useDynamic || result.items.length === 0);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the service report.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirtyRef.current || !general) return;
    pendingDraftRef.current = { general, assetCondition, items };
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(flushDraft, 400);
  }, [general, assetCondition, items, flushDraft]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushDraft();
    });
    return () => {
      sub.remove();
      flushDraft();
    };
  }, [flushDraft]);

  const busy = saving || signatureBusy;
  const hasChecklist = Boolean(form?.useDynamic && form.items.length > 0);
  const noChecklistMessage = form?.useDynamic
    ? 'The checklist mapped to this asset has no items, so a service report cannot be created. Ask the admin to add checklist items.'
    : `No checklist is mapped to this asset${
        form?.assetFlow.categoryName ? ` (${form.assetFlow.categoryName})` : ''
      }, so a service report cannot be created. Ask the admin to map a checklist to this asset.`;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, busy]);

  const updateItem = (id: number, patch: Partial<PpmChecklistItem>) => {
    setFormError('');
    dirtyRef.current = true;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateField = (key: keyof PpmGeneralDetails, value: string) => {
    setFormError('');
    dirtyRef.current = true;
    setGeneral((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const reject = (message: string) => {
    setFormError(message);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    setInkSaved(false);
    setSignatureError('');
  };

  /** Uploads the drawn signature and returns the stored filename. */
  const uploadSignature = async () => {
    const base64 = signatureRef.current?.toJpegBase64() ?? '';
    if (!base64) throw new Error('Please draw the client signature first.');
    const fileName = await savePpmClientSignature({
      ticketId,
      generalReportId: form?.generalReportId ?? -1,
      base64,
    });
    setInkSaved(true);
    if (fileName) {
      setSavedSignature(fileName);
      setSignatureLoadFailed(false);
    }
    return fileName;
  };

  const handleSaveSignature = async () => {
    if (!signatureRef.current?.hasInk()) {
      setSignatureError('Please draw the client signature first.');
      return;
    }
    setSignatureBusy(true);
    setSignatureError('');
    try {
      await uploadSignature();
    } catch (e) {
      setSignatureError(e instanceof Error ? e.message : 'Could not save the signature.');
    } finally {
      setSignatureBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!form || !general) return;
    if (!hasChecklist || !form.mappingMode) {
      setShowNoChecklist(true);
      return;
    }
    if (!createdBy) {
      reject('Sign in again to submit the service report.');
      return;
    }

    const missing: string[] = [];
    if (!assetCondition) missing.push('Asset Condition');
    [...workFields, ...clientFields].forEach((field) => {
      if (!general[field.key].trim()) missing.push(field.label);
    });
    if (missing.length) {
      reject(`Please fill: ${missing.join(', ')}`);
      return;
    }
    const contact = general.ClientRepresentativeContact.trim();
    if (!/^\d{10}$/.test(contact)) {
      reject('Contact No. must be 10 digits.');
      return;
    }
    const emails = general.ClientRepresentativeEmails.split(',').map((e) => e.trim()).filter(Boolean);
    if (!emails.length || emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) {
      reject('Enter valid email(s), separated by commas.');
      return;
    }
    const pending = items.filter((item) => item.mandatory && !item.value.trim()).map((item) => item.name);
    if (pending.length) {
      reject(`Please complete the checklist: ${pending.join(', ')}`);
      return;
    }
    const unsavedInk = hasInk && !inkSaved;
    if (!unsavedInk && !savedSignature && !inkSaved) {
      reject('Please draw and save the client signature.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (unsavedInk) await uploadSignature();
      await submitDynamicPpmReport({
        ticketId,
        mappingMode: form.mappingMode,
        createdBy,
        assetCondition,
        general,
        items,
      });
      await discardDraft();
      onSaved();
    } catch (e) {
      reject(e instanceof Error ? e.message : 'Could not submit the service report.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: FieldDef) => (
    <View key={field.key} style={styles.fieldBlock}>
      <RequiredLabel>{field.label}</RequiredLabel>
      <TextInput
        value={general?.[field.key] ?? ''}
        onChangeText={(value) =>
          updateField(field.key, field.keyboard === 'phone-pad' ? value.replace(/\D/g, '') : value)
        }
        placeholder={field.placeholder}
        placeholderTextColor="#94A3B8"
        multiline={field.multiline}
        keyboardType={field.keyboard ?? 'default'}
        autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'sentences'}
        maxLength={field.keyboard === 'phone-pad' ? 10 : undefined}
        style={[styles.input, field.multiline && styles.multiline]}
      />
    </View>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.headerContainer}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} disabled={busy} style={styles.headerIcon} hitSlop={12} accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={24} color={Navy} />
            </Pressable>
            <Text style={styles.headerTitle}>PPM Service Checklist</Text>
            <View style={styles.headerIcon} />
          </View>
        </SafeAreaView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Sky} />
          <Text style={styles.muted}>Loading service report...</Text>
        </View>
      ) : loadError || !form || !general ? (
        <View style={styles.center}>
          <Text style={[styles.muted, { color: Danger }]}>{loadError || 'Could not load the service report.'}</Text>
          <Pressable onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : !hasChecklist ? (
        <View style={styles.center}>
          <View style={styles.popupIcon}>
            <Ionicons name="clipboard-outline" size={30} color={Warning} />
          </View>
          <Text style={styles.popupTitle}>No Checklist Mapped</Text>
          <Text style={styles.popupText}>{noChecklistMessage}</Text>
          <Pressable onPress={onBack} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!drawing}
        >
          <Text style={styles.ticketCode}>
            {ticketCode}
            {form.checklistName ? <Text style={styles.checklistName}>  ·  {form.checklistName}</Text> : null}
          </Text>

          {restoredAt ? (
            <View style={styles.draftBanner}>
              <Ionicons name="cloud-done-outline" size={18} color={Sky} />
              <Text style={styles.draftText}>
                Restored your unsaved entries from{' '}
                {new Date(restoredAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.
              </Text>
              <Pressable
                onPress={() => {
                  void discardDraft().then(load);
                }}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.draftDiscard}>Discard</Text>
              </Pressable>
            </View>
          ) : null}

          {form.assetFlow.asset ? (
            <>
              <SectionHeader icon="hardware-chip-outline" title="Asset Details" />
              <View style={styles.card}>
                {[
                  ['Equipment', form.assetFlow.asset.equipmentName],
                  ['Category', form.assetFlow.asset.categoryName || form.assetFlow.categoryName],
                  ['Make / Model', [form.assetFlow.asset.make, form.assetFlow.asset.model].filter(Boolean).join(' / ')],
                  ['Serial No.', form.assetFlow.asset.serialNo],
                  ['Capacity', form.assetFlow.asset.capacity],
                  ['Location', form.assetFlow.asset.location],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <View key={label} style={styles.assetRow}>
                      <Text style={styles.assetLabel}>{label}</Text>
                      <Text style={styles.assetValue}>{value}</Text>
                    </View>
                  ))}
              </View>
            </>
          ) : null}

          {form.useDynamic ? (
            <>
              <SectionHeader icon="cube-outline" title="Asset Condition" />
              <View style={styles.card}>
                <RequiredLabel>Select Asset Condition</RequiredLabel>
                <View style={styles.conditionRow}>
                  {assetConditions.map((condition) => {
                    const active = assetCondition === condition.value;
                    return (
                      <Pressable
                        key={condition.value}
                        onPress={() => {
                          setFormError('');
                          dirtyRef.current = true;
                          setAssetCondition(condition.value);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.conditionBox,
                          active && { borderColor: condition.color, backgroundColor: condition.tint },
                        ]}
                      >
                        <Ionicons name={condition.icon} size={30} color={condition.color} />
                        <Text style={[styles.conditionText, active && { color: condition.color }]}>{condition.value}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}

          <SectionHeader icon="document-text-outline" title="Work Details" />
          <View style={styles.card}>{workFields.map(renderField)}</View>

          <SectionHeader icon="person-outline" title="Client Representative" />
          <View style={styles.card}>{clientFields.map(renderField)}</View>

          {form.useDynamic && items.length > 0 ? (
            <>
              <SectionHeader icon="shield-checkmark-outline" title="Checklist Items" />
              {items.map((item, index) => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHead}>
                    <View style={styles.itemNumber}>
                      <Text style={styles.itemNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.itemName}>
                      {item.name}
                      {item.mandatory ? <Text style={styles.star}> *</Text> : null}
                    </Text>
                  </View>
                  {item.helpText ? <Text style={styles.helpText}>{item.helpText}</Text> : null}
                  {isChoiceItem(item) ? (
                    <View style={styles.choiceRow}>
                      {choicesFor(item).map((choice) => {
                        const active = item.value.toLowerCase() === choice.toLowerCase();
                        const color = /not/i.test(choice) ? Danger : Success;
                        return (
                          <Pressable
                            key={choice}
                            onPress={() => updateItem(item.id, { value: choice, status: choice.toUpperCase() })}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            style={[
                              styles.choiceBtn,
                              active ? { backgroundColor: color, borderColor: color } : { borderColor: color },
                            ]}
                          >
                            <Text style={[styles.choiceText, { color: active ? Brand.white : color }]}>{choice}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput
                      value={item.value}
                      onChangeText={(value) => updateItem(item.id, { value, status: value ? 'OK' : '' })}
                      placeholder={item.unit ? `Value (${item.unit})` : 'Value'}
                      placeholderTextColor="#94A3B8"
                      keyboardType={item.inputType === 'number' ? 'decimal-pad' : 'default'}
                      style={[styles.input, styles.itemInput]}
                    />
                  )}
                  <View style={styles.remarkBlock}>
                    <View style={styles.remarkLabelRow}>
                      <Ionicons name="chatbox-ellipses-outline" size={14} color="#64748B" />
                      <Text style={styles.remarkLabel}>Remarks</Text>
                    </View>
                    <TextInput
                      value={item.remarks}
                      onChangeText={(remarks) => updateItem(item.id, { remarks })}
                      placeholder="Add a remark (optional)"
                      placeholderTextColor="#94A3B8"
                      multiline
                      style={[styles.input, styles.remarkInput]}
                    />
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <SectionHeader icon="create-outline" title="Client Signature" />
          <View style={styles.card}>
            {savedSignature ? (
              <>
                <Text style={styles.label}>Previous Signature</Text>
                <View style={styles.savedSignatureBox}>
                  {signatureLoadFailed ? (
                    <Text style={styles.signatureError}>Could not load the previous signature.</Text>
                  ) : (
                    <Image
                      key={savedSignature}
                      source={{ uri: ppmSignatureUrl(savedSignature) }}
                      style={styles.savedSignature}
                      resizeMode="contain"
                      onError={() => setSignatureLoadFailed(true)}
                    />
                  )}
                </View>
                <Text style={styles.savedSignatureText}>Draw below only if you want to replace it.</Text>
              </>
            ) : null}
            {savedSignature ? (
              <Text style={styles.label}>Draw New Signature</Text>
            ) : (
              <RequiredLabel>Draw Signature</RequiredLabel>
            )}
            <View>
              <SignaturePad
                ref={signatureRef}
                style={styles.signaturePad}
                onInkChange={(ink) => {
                  setHasInk(ink);
                  setSignatureError('');
                }}
                onDrawStart={() => {
                  setDrawing(true);
                  setInkSaved(false);
                }}
                onDrawEnd={() => setDrawing(false)}
              />
              {!hasInk ? <Text style={styles.signHint}>Sign here</Text> : null}
            </View>

            {signatureError ? <Text style={styles.signatureError}>{signatureError}</Text> : null}
            {inkSaved ? (
              <View style={styles.signatureOk}>
                <Ionicons name="checkmark-circle" size={16} color={Success} />
                <Text style={styles.signatureOkText}>Signature saved</Text>
              </View>
            ) : null}

            <View style={styles.signatureActions}>
              <Pressable
                onPress={clearSignature}
                disabled={busy}
                style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="trash-outline" size={18} color="#475569" />
                <Text style={styles.clearText}>CLEAR</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSaveSignature()}
                disabled={busy}
                style={({ pressed }) => [styles.saveSignatureBtn, (pressed || signatureBusy) && { opacity: 0.85 }]}
              >
                {signatureBusy ? (
                  <ActivityIndicator color={Brand.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color={Brand.white} />
                    <Text style={styles.saveSignatureText}>SAVE SIGNATURE</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={busy}
            style={({ pressed }) => [(pressed || saving) && { opacity: 0.88 }]}
          >
            <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtn}>
              {saving ? (
                <ActivityIndicator color={Brand.white} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={22} color={Brand.white} />
                  <Text style={styles.submitText}>Submit Report</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      )}

      <Modal
        visible={showNoChecklist && Boolean(form)}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoChecklist(false)}
      >
        <View style={styles.popupBackdrop}>
          <View style={styles.popupCard}>
            <View style={styles.popupIcon}>
              <Ionicons name="clipboard-outline" size={30} color={Warning} />
            </View>
            <Text style={styles.popupTitle}>No Checklist Mapped</Text>
            <Text style={styles.popupText}>{noChecklistMessage}</Text>
            <Pressable
              onPress={() => {
                setShowNoChecklist(false);
                onBack();
              }}
              style={({ pressed }) => [styles.popupPrimary, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={styles.popupPrimaryText}>Go Back</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowNoChecklist(false)}
              style={({ pressed }) => [styles.popupSecondary, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Text style={styles.popupSecondaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  popupCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
  },
  popupIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  popupTitle: {
    color: Navy,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  popupText: {
    color: '#475569',
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  popupPrimary: {
    alignSelf: 'stretch',
    backgroundColor: Sky,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  popupPrimaryText: {
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  popupSecondary: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  popupSecondaryText: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  screen: { flex: 1, backgroundColor: '#F4F7FB' },
  headerContainer: {
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: Navy, fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { color: '#64748B', fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  retryBtn: { backgroundColor: Sky, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8 },
  retryText: { color: Brand.white, fontFamily: 'Poppins_500Medium', fontSize: 13 },
  content: { padding: 16, paddingBottom: 40 },
  ticketCode: { color: Danger, fontSize: 14, fontFamily: 'Poppins_700Bold', marginBottom: 8 },
  checklistName: { color: '#64748B', fontFamily: 'Poppins_500Medium' },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFE3F7',
    backgroundColor: '#F0F8FE',
  },
  draftText: { flex: 1, color: '#0B356E', fontSize: 12, fontFamily: 'Poppins_400Regular', lineHeight: 17 },
  draftDiscard: { color: Danger, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  sectionHeader: { marginTop: 10, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { color: Navy, fontSize: 16, fontFamily: 'Poppins_700Bold' },
  sectionDivider: { height: 1, backgroundColor: '#D6E4F0', marginTop: 10 },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    boxShadow: '0 2px 6px rgba(11, 53, 110, 0.06)',
  },
  label: { color: '#334155', fontSize: 13, fontFamily: 'Poppins_500Medium', marginBottom: 6 },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  assetLabel: { color: '#64748B', fontSize: 12, fontFamily: 'Poppins_400Regular' },
  assetValue: { flex: 1, textAlign: 'right', color: Navy, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  star: { color: Danger },
  conditionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  conditionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: Brand.white,
  },
  conditionText: { color: '#334155', fontSize: 12, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
  fieldBlock: { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#D7E3F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontFamily: 'Poppins_400Regular',
    backgroundColor: '#FBFDFF',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  itemCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    boxShadow: '0 2px 6px rgba(11, 53, 110, 0.06)',
  },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNumberText: { color: Navy, fontSize: 13, fontFamily: 'Poppins_700Bold' },
  itemName: { flex: 1, color: '#0F172A', fontSize: 14, fontFamily: 'Poppins_500Medium', paddingTop: 3 },
  helpText: { color: '#64748B', fontSize: 11, fontFamily: 'Poppins_400Regular', marginTop: 4, marginLeft: 38 },
  choiceRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  choiceBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: Brand.white,
  },
  choiceText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  itemInput: { marginTop: 12 },
  remarkBlock: { marginTop: 12 },
  remarkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  remarkLabel: { color: '#64748B', fontSize: 12, fontFamily: 'Poppins_500Medium' },
  remarkInput: { minHeight: 44, maxHeight: 110, textAlignVertical: 'top' },
  savedSignatureBox: {
    minHeight: 130,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BFE3F7',
    borderRadius: 12,
    backgroundColor: Brand.white,
    padding: 8,
  },
  savedSignature: { alignSelf: 'stretch', height: 112 },
  savedSignatureText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 6,
    marginBottom: 14,
  },
  signaturePad: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Light,
    borderRadius: 12,
    backgroundColor: '#F8FBFF',
  },
  signHint: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    pointerEvents: 'none',
  },
  signatureError: { color: Danger, fontSize: 12, fontFamily: 'Poppins_500Medium', marginTop: 8 },
  signatureOk: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  signatureOkText: { color: Success, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  signatureActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  clearBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
  },
  clearText: { color: '#475569', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  saveSignatureBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Sky,
    borderRadius: 10,
    paddingVertical: 12,
  },
  saveSignatureText: { color: Brand.white, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  formError: { color: Danger, fontSize: 13, fontFamily: 'Poppins_500Medium', textAlign: 'center', marginVertical: 10 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitText: { color: Brand.white, fontSize: 16, fontFamily: 'Poppins_600SemiBold', letterSpacing: 0.3 },
});
