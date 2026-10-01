import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  formatJoiningDate,
  isBeforeJoiningDate,
  normalizeRegularizationTime,
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

type WorkFromHomeScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

export function WorkFromHomeScreen({ user, onBack }: WorkFromHomeScreenProps) {
  const today = useMemo(() => new Date(), []);
  const dateLabel = formatDate(today);
  const joiningLabel = formatJoiningDate(user.joiningDate) || 'Not set';
  const beforeJoining = isBeforeJoiningDate(user.joiningDate, today);

  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [reasonFocused, setReasonFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitting) return true;
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, submitting]);

  async function submit() {
    if (submitting) return;
    setFormError('');
    setFormSuccess('');

    if (beforeJoining) {
      setFormError(`WFH is not allowed before joining date (${joiningLabel}).`);
      return;
    }
    if (!normalizeRegularizationTime(inTime) || !normalizeRegularizationTime(outTime)) {
      setFormError('Please enter in/out time as HH:MM.');
      return;
    }
    if (!reason.trim()) {
      setFormError('Please enter a reason for WFH.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestAttendanceRegularization({
        employeeId: user.employeeId,
        type: 'WFH',
        reason: reason.trim(),
        entries: [
          {
            recordDate: toIsoDate(today),
            inTime,
            outTime,
            reason: reason.trim(),
          },
        ],
      });
      setFormSuccess(result.message);
      setReason('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit WFH request.');
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
            <Text style={styles.headerTitle}>Work From Home</Text>
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
                  <View style={styles.homeIcon}>
                    <MaterialCommunityIcons name="home-outline" size={20} color={LogoMid} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.username}
                    </Text>
                    <Text style={styles.userMeta} numberOfLines={1}>
                      Joining · {joiningLabel}
                    </Text>
                  </View>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Today</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Date</Text>
                <View style={styles.field}>
                  <MaterialCommunityIcons name="calendar-month-outline" size={18} color={LogoMid} />
                  <Text style={styles.fieldValue}>{dateLabel}</Text>
                  <Text style={styles.chip}>Today only</Text>
                </View>
              </View>

              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.label}>In Time</Text>
                  <View style={styles.field}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color={LogoMid} />
                    <TextInput
                      value={inTime}
                      onChangeText={(value) => {
                        setInTime(value);
                        setFormError('');
                        setFormSuccess('');
                      }}
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
                      value={outTime}
                      onChangeText={(value) => {
                        setOutTime(value);
                        setFormError('');
                        setFormSuccess('');
                      }}
                      placeholder="18:00"
                      placeholderTextColor={Mute}
                      style={[styles.input, webInputReset]}
                      editable={!submitting}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Reason</Text>
                <View style={[styles.field, styles.reasonField, reasonFocused ? styles.fieldFocused : null]}>
                  <MaterialCommunityIcons name="text-box-outline" size={18} color={LogoMid} style={styles.reasonIcon} />
                  <TextInput
                    value={reason}
                    onChangeText={(value) => {
                      setReason(value);
                      setFormError('');
                      setFormSuccess('');
                    }}
                    placeholder="Reason for WFH today..."
                    placeholderTextColor={Mute}
                    style={[styles.input, styles.reasonInput, webInputReset]}
                    multiline
                    textAlignVertical="top"
                    editable={!submitting}
                    onFocus={() => setReasonFocused(true)}
                    onBlur={() => setReasonFocused(false)}
                  />
                </View>
              </View>

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              {formSuccess ? <Text style={styles.formSuccess}>{formSuccess}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  void submit();
                }}
                disabled={submitting || beforeJoining}
                accessibilityRole="button"
                accessibilityLabel="Submit WFH request"
              >
                <LinearGradient colors={[LogoNavy, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                  {submitting ? (
                    <ActivityIndicator color={Brand.white} />
                  ) : (
                    <Text style={styles.submitText}>SUBMIT REQUEST</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
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
    paddingBottom: 12,
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
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  body: {
    flex: 1,
    marginTop: -8,
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
    paddingBottom: 8,
    flexGrow: 1,
  },
  userBanner: {
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: SoftBlue,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  homeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    color: LogoNavy,
    fontSize: 14,
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
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  section: {
    marginBottom: 12,
  },
  label: {
    marginBottom: 6,
    color: LogoNavy,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  field: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FieldStroke,
    backgroundColor: '#F8FBFE',
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
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  chip: {
    color: LogoMid,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  timeRow: {
    marginBottom: 12,
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
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  reasonField: {
    height: 110,
    alignItems: 'flex-start',
    paddingTop: 12,
    paddingBottom: 12,
  },
  reasonIcon: {
    marginTop: 2,
  },
  reasonInput: {
    alignSelf: 'stretch',
    height: '100%',
  },
  formError: {
    marginBottom: 8,
    color: SickRed,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins_500Medium',
  },
  formSuccess: {
    marginBottom: 8,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: Brand.white,
    fontSize: 14,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_700Bold',
  },
});
