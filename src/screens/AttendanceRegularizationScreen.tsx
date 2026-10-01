import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
import type { AuthUser } from '../api/auth';
import {
  formatJoiningDate,
  normalizeRegularizationTime,
  parseJoiningDate,
  requestAttendanceRegularization,
} from '../api/attendance';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const FieldStroke = '#D5E4F2';
const SickRed = '#E11D48';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Entry = {
  id: string;
  date: Date | null;
  inTime: string;
  outTime: string;
  reason: string;
};

type AttendanceRegularizationScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

export function AttendanceRegularizationScreen({ user, onBack }: AttendanceRegularizationScreenProps) {
  const [entries, setEntries] = useState<Entry[]>([createEntry()]);
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  const [reasonFocusId, setReasonFocusId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const joiningDate = useMemo(() => parseJoiningDate(user.joiningDate), [user.joiningDate]);
  const joiningLabel = formatJoiningDate(user.joiningDate) || 'Not set';
  const dateOptions = useMemo(
    () => buildDateOptions(joiningDate ?? startOfDay(new Date(2000, 0, 1)), new Date()),
    [joiningDate],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitting) return true;
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, submitting]);

  function updateEntry(id: string, patch: Partial<Entry>) {
    setFormError('');
    setFormSuccess('');
    setEntries((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addEntry() {
    setFormError('');
    setFormSuccess('');
    setEntries((prev) => [...prev, createEntry()]);
  }

  function removeEntry(id: string) {
    setFormError('');
    setFormSuccess('');
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  async function submit() {
    if (submitting) return;
    setFormError('');
    setFormSuccess('');

    for (const [index, entry] of entries.entries()) {
      if (!entry.date) {
        setFormError(`Please select a date for Entry #${index + 1}.`);
        return;
      }
      if (joiningDate && startOfDay(entry.date).getTime() < startOfDay(joiningDate).getTime()) {
        setFormError(`Entry #${index + 1}: date cannot be before joining date.`);
        return;
      }
      if (!normalizeRegularizationTime(entry.inTime) || !normalizeRegularizationTime(entry.outTime)) {
        setFormError(`Please enter in/out time as HH:MM for Entry #${index + 1}.`);
        return;
      }
      if (!entry.reason.trim()) {
        setFormError(`Please enter a reason for Entry #${index + 1}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await requestAttendanceRegularization({
        employeeId: user.employeeId,
        entries: entries.map((entry) => ({
          recordDate: toIsoDate(entry.date!),
          inTime: entry.inTime,
          outTime: entry.outTime,
          reason: entry.reason.trim(),
        })),
      });
      setFormSuccess(result.message);
      setEntries([createEntry()]);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit attendance regularization.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={() => {
                if (!submitting) onBack();
              }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Attendance Regularization</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <SafeAreaView edges={['bottom']} style={styles.body}>
          <View
            style={[
              styles.card,
              brandShadow('0 12px 20px rgba(11, 53, 110, 0.12)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 14,
                elevation: 6,
              }),
            ]}
          >
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.userBanner}>
                <View style={styles.userLeft}>
                  <View style={styles.userIcon}>
                    <MaterialCommunityIcons name="shield-check" size={20} color={LogoMid} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.username.toUpperCase()}
                    </Text>
                    <Text style={styles.userMeta} numberOfLines={1}>
                      Joining · {joiningLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>From DOJ</Text>
                </View>
              </View>

              <Text style={styles.hintLine}>Submit attendance correction for selected dates</Text>

              <View style={styles.entriesHead}>
                <Text style={styles.entriesTitle}>Request Entries</Text>
                <Pressable
                  onPress={addEntry}
                  disabled={submitting}
                  style={styles.addBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Add date"
                >
                  <MaterialCommunityIcons name="plus" size={14} color={LogoMid} />
                  <Text style={styles.addDate}>ADD DATE</Text>
                </Pressable>
              </View>
              <View style={styles.divider} />

              {entries.map((entry, index) => (
                <View key={entry.id} style={[styles.entryBlock, index > 0 ? styles.entryGap : null]}>
                  <View style={styles.entryTop}>
                    <View style={styles.entryBadge}>
                      <MaterialCommunityIcons name="calendar-clock" size={12} color={LogoMid} />
                      <Text style={styles.entryBadgeText}>Entry #{index + 1} · Regularization</Text>
                    </View>
                    {entries.length > 1 ? (
                      <Pressable
                        onPress={() => removeEntry(entry.id)}
                        hitSlop={8}
                        style={styles.removeBtn}
                        disabled={submitting}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove entry ${index + 1}`}
                      >
                        <MaterialCommunityIcons name="close-circle-outline" size={18} color={Mute} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Date</Text>
                    <Pressable
                      onPress={() => {
                        if (!submitting) setDatePickerFor(entry.id);
                      }}
                      style={styles.field}
                      accessibilityRole="button"
                      accessibilityLabel={`Select date for entry ${index + 1}`}
                    >
                      <MaterialCommunityIcons name="calendar-month-outline" size={18} color={LogoMid} />
                      <Text style={[styles.fieldValue, !entry.date ? styles.placeholder : null]}>
                        {entry.date ? formatDate(entry.date) : 'Select date'}
                      </Text>
                      <MaterialCommunityIcons name="chevron-down" size={18} color={Mute} />
                    </Pressable>
                    <Text style={styles.dateHint}>
                      Allowed: {joiningLabel} → Today
                    </Text>
                  </View>

                  <View style={styles.timeRow}>
                    <View style={styles.timeCol}>
                      <Text style={styles.label}>In Time</Text>
                      <View style={styles.field}>
                        <MaterialCommunityIcons name="clock-outline" size={18} color={LogoMid} />
                        <TextInput
                          value={entry.inTime}
                          onChangeText={(value) => updateEntry(entry.id, { inTime: value })}
                          placeholder="09:00"
                          placeholderTextColor={Mute}
                          style={[styles.input, webInputReset]}
                          editable={!submitting}
                        />
                      </View>
                    </View>
                    <View style={styles.timeCol}>
                      <Text style={styles.label}>Out Time</Text>
                      <View style={styles.field}>
                        <MaterialCommunityIcons name="clock-outline" size={18} color={LogoMid} />
                        <TextInput
                          value={entry.outTime}
                          onChangeText={(value) => updateEntry(entry.id, { outTime: value })}
                          placeholder="18:00"
                          placeholderTextColor={Mute}
                          style={[styles.input, webInputReset]}
                          editable={!submitting}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Reason</Text>
                    <View
                      style={[
                        styles.field,
                        styles.reasonField,
                        reasonFocusId === entry.id ? styles.fieldFocused : null,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="text-box-outline"
                        size={18}
                        color={LogoMid}
                        style={styles.reasonIcon}
                      />
                      <TextInput
                        value={entry.reason}
                        onChangeText={(value) => updateEntry(entry.id, { reason: value })}
                        placeholder="Reason for this date..."
                        placeholderTextColor={Mute}
                        style={[styles.input, styles.reasonInput, webInputReset]}
                        multiline
                        textAlignVertical="top"
                        editable={!submitting}
                        onFocus={() => setReasonFocusId(entry.id)}
                        onBlur={() => setReasonFocusId(null)}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              {formSuccess ? <Text style={styles.formSuccess}>{formSuccess}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  void submit();
                }}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Submit regularization"
              >
                <LinearGradient
                  colors={[LogoNavy, LogoMid]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submit}
                >
                  {submitting ? (
                    <ActivityIndicator color={Brand.white} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check-circle-outline" size={18} color={Brand.white} />
                      <Text style={styles.submitText}>SUBMIT REGULARIZATION</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!datePickerFor}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerFor(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setDatePickerFor(null)}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select date</Text>
            <Text style={styles.sheetSub}>From joining date onwards</Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {dateOptions.map((date) => {
                const active =
                  datePickerFor != null &&
                  entries.find((item) => item.id === datePickerFor)?.date?.toDateString() === date.toDateString();
                return (
                  <Pressable
                    key={date.toISOString()}
                    onPress={() => {
                      if (datePickerFor) updateEntry(datePickerFor, { date });
                      setDatePickerFor(null);
                    }}
                    style={[styles.sheetRow, active ? styles.sheetRowActive : null]}
                  >
                    <MaterialCommunityIcons
                      name="calendar"
                      size={16}
                      color={active ? Brand.white : LogoMid}
                    />
                    <Text style={[styles.sheetRowText, active ? styles.sheetRowTextActive : null]}>
                      {formatDate(date)}
                    </Text>
                    {active ? (
                      <MaterialCommunityIcons name="check" size={16} color={Brand.white} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createEntry(): Entry {
  return {
    id: String(Date.now() + Math.random()),
    date: null,
    inTime: '09:00',
    outTime: '18:00',
    reason: '',
  };
}

function formatDate(date: Date) {
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildDateOptions(from: Date, to: Date) {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const dates: Date[] = [];
  for (let cursor = new Date(end); cursor.getTime() >= start.getTime(); cursor.setDate(cursor.getDate() - 1)) {
    dates.push(new Date(cursor));
    if (dates.length >= 60) break;
  }
  return dates;
}

const webInputReset =
  Platform.OS === 'web'
    ? ({
        outlineStyle: 'none',
        outlineWidth: 0,
      } as const)
    : null;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  body: {
    flex: 1,
    marginTop: -10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: Brand.white,
    borderRadius: 22,
    paddingTop: 14,
    overflow: 'hidden',
  },
  formContent: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexGrow: 1,
  },
  userBanner: {
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: SoftBlue,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  userLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },
  userMeta: {
    marginTop: 1,
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  badge: {
    backgroundColor: LogoMid,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: Brand.white,
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
  },
  hintLine: {
    marginBottom: 12,
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  entriesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entriesTitle: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  addDate: {
    color: LogoMid,
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  divider: {
    marginTop: 8,
    marginBottom: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C9D8E8',
  },
  entryBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FieldStroke,
    backgroundColor: '#F8FBFE',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  entryGap: {
    marginTop: 10,
  },
  entryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  entryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SoftBlue,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  entryBadgeText: {
    color: LogoMid,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  removeBtn: {
    padding: 2,
  },
  fieldGroup: {
    marginBottom: 10,
  },
  label: {
    marginBottom: 5,
    color: LogoNavy,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  field: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FieldStroke,
    backgroundColor: Brand.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldFocused: {
    borderColor: LogoMid,
  },
  fieldValue: {
    flex: 1,
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  placeholder: {
    color: Mute,
  },
  dateHint: {
    marginTop: 5,
    color: LogoMid,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  timeRow: {
    marginBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  timeCol: {
    flex: 1,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  reasonField: {
    height: 88,
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingBottom: 10,
  },
  reasonIcon: {
    marginTop: 2,
  },
  reasonInput: {
    alignSelf: 'stretch',
    height: '100%',
  },
  formError: {
    marginTop: 10,
    color: SickRed,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins_500Medium',
  },
  formSuccess: {
    marginTop: 10,
    color: '#15803D',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins_500Medium',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: SoftBlue,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Brand.white,
  },
  submit: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    color: Brand.white,
    fontSize: 13,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_700Bold',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 53, 110, 0.4)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    backgroundColor: Brand.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0DCE8',
    marginBottom: 10,
  },
  sheetTitle: {
    color: LogoNavy,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  sheetSub: {
    marginTop: 2,
    marginBottom: 10,
    color: Mute,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  sheetList: {
    maxHeight: 340,
  },
  sheetRow: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: SoftBlue,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetRowActive: {
    backgroundColor: LogoMid,
  },
  sheetRowText: {
    flex: 1,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  sheetRowTextActive: {
    color: Brand.white,
  },
});
