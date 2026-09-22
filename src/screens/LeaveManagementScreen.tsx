import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { formatJoiningDate, isBeforeJoiningDate, parseJoiningDate } from '../api/attendance';
import { fetchLeaveApplyScreen, fetchLeaveHistory, fetchCompOff, validateLeave } from '../api/leave';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#F4F8FC';
const FieldBg = '#F3F7FB';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const SickRed = '#E11D48';
const CompOrange = '#FF6A2A';
const UnpaidGray = '#64748B';
const SuccessGreen = '#15803D';

type TabKey = 'request' | 'history' | 'compoff';
type Duration = 'Full Day' | 'First Half' | 'Second Half';
type LeaveCode = string;

type LeaveType = {
  code: LeaveCode;
  label: string;
  short: string;
  balance: number;
  color: string;
  wash: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  trackBalance: boolean;
};

type LeaveRequest = {
  id: string;
  type: string;
  from: string;
  to: string;
  duration: string;
  reason: string;
  days: number;
  status: string;
  rejectionReason?: string | null;
};

type CompOffRequest = {
  id: string;
  workDate: string;
  creditDays: number;
  reason: string;
  status: string;
  expiresAt: string | null;
};

const durations: Duration[] = ['Full Day', 'First Half', 'Second Half'];
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const leaveMeta: Record<
  string,
  {
    short: string;
    color: string;
    wash: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    trackBalance: boolean;
  }
> = {
  CL: { short: 'CL', color: LogoNavy, wash: '#E4EEFF', icon: 'calendar-account', trackBalance: true },
  SL: { short: 'SL', color: SickRed, wash: '#FFE8EC', icon: 'medical-bag', trackBalance: true },
  COMPOFF: { short: 'CO', color: CompOrange, wash: '#FFF1E6', icon: 'gift-outline', trackBalance: true },
  UNPAID: { short: 'UL', color: UnpaidGray, wash: '#EEF2F7', icon: 'cash-off', trackBalance: false },
};

type LeaveManagementScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

export function LeaveManagementScreen({ user, onBack }: LeaveManagementScreenProps) {
  const [tab, setTab] = useState<TabKey>('request');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balanceCards, setBalanceCards] = useState<LeaveType[]>([]);
  const [leaveType, setLeaveType] = useState<LeaveCode>('CL');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [duration, setDuration] = useState<Duration>('Full Day');
  const [reason, setReason] = useState('');
  const [sheet, setSheet] = useState<'type' | 'duration' | 'from' | 'to' | null>(null);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applyHint, setApplyHint] = useState('Loading leave policy…');
  const [maxDaysPerApplication, setMaxDaysPerApplication] = useState(2);
  const [halfDayEnabled, setHalfDayEnabled] = useState(true);
  const [compOffAvailable, setCompOffAvailable] = useState(0);
  const [compOffPending, setCompOffPending] = useState(0);
  const [compOffItems, setCompOffItems] = useState<CompOffRequest[]>([]);
  const [compOffLoading, setCompOffLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validateFeedback, setValidateFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const selected = leaveTypes.find((item) => item.code === leaveType) ?? leaveTypes[0];
  const durationOptions = halfDayEnabled ? durations : (['Full Day'] as Duration[]);
  const joiningDate = parseJoiningDate(user.joiningDate);
  const joiningLabel = formatJoiningDate(user.joiningDate);
  const beforeJoining = isBeforeJoiningDate(user.joiningDate);

  const loadScreen = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLeaveApplyScreen(user.employeeId);
      const balanceByCode: Record<string, number> = {
        CL: data.cl.available,
        SL: data.sl.available,
        COMPOFF: data.compOffAvailable,
        UNPAID: Number.POSITIVE_INFINITY,
      };

      const mapped = data.leaveTypes.map((item) => {
        const meta = leaveMeta[item.code] ?? {
          short: item.code.slice(0, 2).toUpperCase(),
          color: LogoNavy,
          wash: SoftBlue,
          icon: 'calendar-blank' as const,
          trackBalance: true,
        };
        return {
          code: item.code,
          label: item.name || item.label,
          short: meta.short,
          balance: balanceByCode[item.code] ?? 0,
          color: meta.color,
          wash: meta.wash,
          icon: meta.icon,
          trackBalance: meta.trackBalance,
        } satisfies LeaveType;
      });

      const cards = (['CL', 'SL', 'COMPOFF'] as const)
        .map((code) => mapped.find((item) => item.code === code))
        .filter((item): item is LeaveType => Boolean(item));

      setLeaveTypes(mapped);
      setBalanceCards(cards.length > 0 ? cards : mapped.slice(0, 3));
      setLeaveType(mapped[0]?.code ?? 'CL');
      setApplyHint(data.applyHint);
      setMaxDaysPerApplication(data.maxDaysPerApplication);
      setHalfDayEnabled(data.halfDayEnabled);
      setCompOffAvailable(data.compOffAvailable);
      if (!data.halfDayEnabled) setDuration('Full Day');
    } catch (error) {
      // Keep request tab usable if apply-screen bootstrap fails.
    } finally {
      setLoading(false);
    }
  }, [user.employeeId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchLeaveHistory(user.employeeId, { limit: 50, includeBalance: true });

      setHistory(
        data.leaves.map((item) => {
          const code = item.typeOfLeave.toUpperCase();
          const meta = leaveMeta[code];
          const label = meta ? `${meta.short} · ${leaveTypeName(code)}` : item.typeOfLeave || 'Leave';
          return {
            id: String(item.id || `${item.fromDate}-${item.toDate}-${item.status}`),
            type: label,
            from: formatApiDateDisplay(item.fromDate),
            to: formatApiDateDisplay(item.toDate),
            duration: formatHistoryDuration(item.duration, item.halfDaySession),
            reason: item.reason || '—',
            days: item.leaveDays,
            status: item.status || 'Pending',
            rejectionReason: item.rejectionReason,
          };
        }),
      );

      if (data.balance) {
        setCompOffAvailable(data.balance.compOffAvailable);
        setBalanceCards((current) =>
          current.map((card) => {
            if (card.code === 'CL') return { ...card, balance: data.balance!.clAvailable };
            if (card.code === 'SL') return { ...card, balance: data.balance!.slAvailable };
            if (card.code === 'COMPOFF') return { ...card, balance: data.balance!.compOffAvailable };
            return card;
          }),
        );
        setLeaveTypes((current) =>
          current.map((item) => {
            if (item.code === 'CL') return { ...item, balance: data.balance!.clAvailable };
            if (item.code === 'SL') return { ...item, balance: data.balance!.slAvailable };
            if (item.code === 'COMPOFF') return { ...item, balance: data.balance!.compOffAvailable };
            return item;
          }),
        );
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user.employeeId]);

  const loadCompOff = useCallback(async () => {
    setCompOffLoading(true);
    try {
      const data = await fetchCompOff(user.employeeId);
      setCompOffAvailable(data.available);
      setCompOffPending(data.pendingCount);
      setCompOffItems(
        data.items.map((item) => ({
          id: String(item.id || `${item.workDate}-${item.status}`),
          workDate: formatApiDateDisplay(item.workDate),
          creditDays: item.creditDays,
          reason: item.reason || '—',
          status: item.status || 'Pending',
          expiresAt: item.expiresAt ? formatApiDateDisplay(item.expiresAt) : null,
        })),
      );
      setBalanceCards((current) =>
        current.map((card) => (card.code === 'COMPOFF' ? { ...card, balance: data.available } : card)),
      );
      setLeaveTypes((current) =>
        current.map((item) => (item.code === 'COMPOFF' ? { ...item, balance: data.available } : item)),
      );
    } catch {
      setCompOffItems([]);
    } finally {
      setCompOffLoading(false);
    }
  }, [user.employeeId]);

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  useEffect(() => {
    if (tab === 'history') {
      void loadHistory();
    }
    if (tab === 'compoff') {
      void loadCompOff();
    }
  }, [tab, loadHistory, loadCompOff]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  async function submit() {
    if (validating) return;
    setValidateFeedback(null);

    if (beforeJoining) {
      setValidateFeedback({
        ok: false,
        message: joiningLabel
          ? `Leave can be applied only on or after your joining date (${joiningLabel}).`
          : 'Leave can be applied only on or after your joining date.',
      });
      return;
    }
    if (!selected) {
      setValidateFeedback({ ok: false, message: 'Leave types are still loading.' });
      return;
    }
    if (!fromDate) {
      setValidateFeedback({ ok: false, message: 'Please select a from date.' });
      return;
    }
    if (!toDate) {
      setValidateFeedback({ ok: false, message: 'Please select a to date.' });
      return;
    }
    if (joiningDate && startOfDay(fromDate).getTime() < startOfDay(joiningDate).getTime()) {
      setValidateFeedback({
        ok: false,
        message: joiningLabel
          ? `From date cannot be before joining date (${joiningLabel}).`
          : 'From date cannot be before joining date.',
      });
      return;
    }
    if (joiningDate && startOfDay(toDate).getTime() < startOfDay(joiningDate).getTime()) {
      setValidateFeedback({
        ok: false,
        message: joiningLabel
          ? `To date cannot be before joining date (${joiningLabel}).`
          : 'To date cannot be before joining date.',
      });
      return;
    }
    if (startOfDay(toDate).getTime() < startOfDay(fromDate).getTime()) {
      setValidateFeedback({ ok: false, message: 'To date cannot be before from date.' });
      return;
    }
    if (!reason.trim()) {
      setValidateFeedback({ ok: false, message: 'Please enter a leave reason.' });
      return;
    }
    if (!user.employeeId) {
      setValidateFeedback({ ok: false, message: 'Employee id missing. Please log in again.' });
      return;
    }

    const apiDuration = toApiDuration(duration);

    setValidating(true);
    try {
      const result = await validateLeave({
        employeeId: user.employeeId,
        typeOfLeave: selected.code,
        fromDate: toApiDate(fromDate),
        toDate: toApiDate(toDate),
        duration: apiDuration.Duration,
        halfDaySession: apiDuration.HalfDaySession,
        reasonOfLeave: reason.trim(),
      });

      setSheet(null);
      setValidateFeedback({ ok: true, message: result.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Leave validation failed.';
      setValidateFeedback({ ok: false, message });
    } finally {
      setValidating(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <LinearGradient colors={['#D6EEFC', '#EAF6FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={LogoNavy} />
            </Pressable>
            <Text style={styles.headerTitle}>Leave Management</Text>
          </View>
        </SafeAreaView>
        <View
          style={[
            styles.tabBar,
            brandShadow('0 8px 14px rgba(11, 53, 110, 0.12)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 10,
              elevation: 6,
            }),
          ]}
        >
          <TabButton label="Request" active={tab === 'request'} onPress={() => { setTab('request'); setSheet(null); }} />
          <TabButton label="History" active={tab === 'history'} onPress={() => { setTab('history'); setSheet(null); }} />
          <TabButton label="Comp-off" active={tab === 'compoff'} onPress={() => { setTab('compoff'); setSheet(null); }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={LogoMid} />
            <Text style={styles.loadingText}>Loading leave balances…</Text>
          </View>
        ) : (
          <>
            <View style={styles.body}>
              {tab === 'request' && beforeJoining ? (
                <View style={styles.joiningBlockedBox}>
                  <MaterialCommunityIcons name="calendar-remove" size={42} color={LogoMid} />
                  <Text style={styles.joiningBlockedTitle}>Leave not available yet</Text>
                  <Text style={styles.joiningBlockedText}>
                    {joiningLabel
                      ? `Your joining date is ${joiningLabel}. You can apply leave only from that day onwards.`
                      : 'You can apply leave only from your joining date onwards.'}
                  </Text>
                </View>
              ) : null}
              {tab === 'request' && selected && !beforeJoining ? (
                <RequestTab
                  balanceCards={balanceCards}
                  selected={selected}
                  fromDate={fromDate}
                  toDate={toDate}
                  duration={duration}
                  reason={reason}
                  applyHint={applyHint}
                  joiningLabel={joiningLabel}
                  feedback={validateFeedback}
                  onOpenType={() => {
                    setValidateFeedback(null);
                    setSheet('type');
                  }}
                  onOpenDate={(field) => {
                    setValidateFeedback(null);
                    setSheet(field);
                  }}
                  onOpenDuration={() => {
                    setValidateFeedback(null);
                    setSheet('duration');
                  }}
                  onChangeReason={(value) => {
                    setValidateFeedback(null);
                    setReason(value);
                  }}
                />
              ) : null}
              {tab === 'history' ? (
                <HistoryTab items={history} loading={historyLoading} />
              ) : null}
              {tab === 'compoff' ? (
                <CompOffTab
                  available={compOffAvailable}
                  pending={compOffPending}
                  items={compOffItems}
                  loading={compOffLoading}
                />
              ) : null}
            </View>
            {tab === 'request' && !beforeJoining ? (
              <SafeAreaView edges={['bottom']} style={styles.footer}>
                <Pressable
                  onPress={() => {
                    void submit();
                  }}
                  disabled={validating}
                  accessibilityRole="button"
                  accessibilityLabel="Validate Leave"
                  style={[
                    styles.submitWrap,
                    validating ? styles.submitDisabled : null,
                    brandShadow('0 8px 16px rgba(11, 53, 110, 0.22)', {
                      shadowColor: LogoNavy,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.22,
                      shadowRadius: 10,
                      elevation: 6,
                    }),
                  ]}
                >
                  <LinearGradient colors={[LogoNavy, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                    {validating ? (
                      <ActivityIndicator color={Brand.white} />
                    ) : (
                      <Text style={styles.submitText}>Validate Leave</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </SafeAreaView>
            ) : (
              <SafeAreaView edges={['bottom']} />
            )}
          </>
        )}
      </KeyboardAvoidingView>

      <ChoiceModal
        visible={sheet === 'type'}
        title="Select leave type"
        onClose={() => setSheet(null)}
      >
        {leaveTypes.map((item) => (
          <Pressable
            key={item.code}
            onPress={() => {
              setLeaveType(item.code);
              setSheet(null);
            }}
            style={[styles.sheetRow, item.code === selected?.code ? styles.sheetRowActive : null]}
          >
            <View style={[styles.optionIcon, { backgroundColor: item.wash }]}>
              <MaterialCommunityIcons name={item.icon} size={16} color={item.color} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.optionText}>{item.short} · {item.label}</Text>
              <Text style={styles.optionMeta}>
                {item.trackBalance ? `${formatBalance(item.balance)} days available` : 'No balance limit'}
              </Text>
            </View>
            {item.code === selected?.code ? <MaterialCommunityIcons name="check-circle" size={20} color={LogoMid} /> : null}
          </Pressable>
        ))}
      </ChoiceModal>

      <ChoiceModal
        visible={sheet === 'duration'}
        title="Select duration"
        onClose={() => setSheet(null)}
      >
        {durationOptions.map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setDuration(item);
              setSheet(null);
            }}
            style={[styles.sheetRow, item === duration ? styles.sheetRowActive : null]}
          >
            <MaterialCommunityIcons name="clock-outline" size={18} color={LogoMid} />
            <Text style={[styles.optionText, styles.flex]}>{item}</Text>
            {item === duration ? <MaterialCommunityIcons name="check-circle" size={20} color={LogoMid} /> : null}
          </Pressable>
        ))}
      </ChoiceModal>

      <DatePickerModal
        visible={!beforeJoining && (sheet === 'from' || sheet === 'to')}
        title={sheet === 'to' ? 'Select to date' : 'Select from date'}
        subtitle={
          joiningLabel
            ? sheet === 'to'
              ? `Choose from ${fromDate ? formatDate(fromDate) : joiningLabel} onwards`
              : `Available from joining date (${joiningLabel})`
            : null
        }
        value={sheet === 'to' ? toDate : fromDate}
        minDate={
          sheet === 'to'
            ? fromDate && joiningDate
              ? startOfDay(fromDate).getTime() > startOfDay(joiningDate).getTime()
                ? fromDate
                : joiningDate
              : fromDate ?? joiningDate
            : joiningDate
        }
        onClose={() => setSheet(null)}
        onSelect={(date) => {
          if (sheet === 'to') {
            setToDate(date);
          } else {
            setFromDate(date);
            if (toDate && startOfDay(toDate).getTime() < startOfDay(date).getTime()) {
              setToDate(null);
            }
          }
          setSheet(null);
        }}
      />
    </View>
  );
}

function RequestTab({
  balanceCards,
  selected,
  fromDate,
  toDate,
  duration,
  reason,
  applyHint,
  joiningLabel,
  feedback,
  onOpenType,
  onOpenDate,
  onOpenDuration,
  onChangeReason,
}: {
  balanceCards: LeaveType[];
  selected: LeaveType;
  fromDate: Date | null;
  toDate: Date | null;
  duration: Duration;
  reason: string;
  applyHint: string;
  joiningLabel: string | null;
  feedback: { ok: boolean; message: string } | null;
  onOpenType: () => void;
  onOpenDate: (field: 'from' | 'to') => void;
  onOpenDuration: () => void;
  onChangeReason: (value: string) => void;
}) {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.requestScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.balanceRow}>
        {balanceCards.map((item) => (
          <View
            key={item.code}
            style={[
              styles.balanceCard,
              { borderTopColor: item.color },
              brandShadow('0 8px 14px rgba(11, 53, 110, 0.08)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 3,
              }),
            ]}
          >
            <View style={[styles.balanceIcon, { backgroundColor: item.wash }]}>
              <MaterialCommunityIcons name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={styles.balanceLabel}>{item.short}</Text>
            <Text style={[styles.balanceValue, { color: item.color }]} numberOfLines={1}>
              {formatBalance(item.balance)}
            </Text>
            <Text style={styles.balanceHint}>Days left</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <MaterialCommunityIcons name="shield-check-outline" size={16} color={LogoMid} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>Leave policy</Text>
          <Text style={styles.infoText}>{applyHint}</Text>
          {joiningLabel ? <Text style={styles.infoText}>Joining date: {joiningLabel}</Text> : null}
        </View>
      </View>

      <View
        style={[
          styles.formCard,
          brandShadow('0 10px 18px rgba(11, 53, 110, 0.07)', {
            shadowColor: LogoNavy,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.07,
            shadowRadius: 12,
            elevation: 4,
          }),
        ]}
      >
        <FieldButton
          label="Leave type"
          icon={selected.icon}
          value={`${selected.short} · ${selected.label}`}
          placeholder="Select leave type"
          onPress={onOpenType}
        />

        <FieldButton
          label="From"
          icon="calendar-start"
          value={fromDate ? formatDate(fromDate) : ''}
          placeholder="Select date"
          onPress={() => onOpenDate('from')}
        />

        <FieldButton
          label="To"
          icon="calendar-end"
          value={toDate ? formatDate(toDate) : ''}
          placeholder="Select date"
          onPress={() => onOpenDate('to')}
        />

        <FieldButton
          label="Duration"
          icon="clock-outline"
          value={duration}
          placeholder="Select duration"
          onPress={onOpenDuration}
        />

        <Text style={styles.label}>Reason</Text>
        <View style={[styles.field, styles.reasonField]}>
          <MaterialCommunityIcons name="text-box-outline" size={18} color={LogoMid} />
          <TextInput
            value={reason}
            onChangeText={onChangeReason}
            placeholder="Write a short reason for this leave"
            placeholderTextColor={Mute}
            style={styles.input}
            multiline
            textAlignVertical="top"
          />
        </View>

        {feedback ? (
          <View style={[styles.feedbackBox, feedback.ok ? styles.feedbackOk : styles.feedbackError]}>
            <MaterialCommunityIcons
              name={feedback.ok ? 'check-circle-outline' : 'alert-circle-outline'}
              size={18}
              color={feedback.ok ? SuccessGreen : SickRed}
            />
            <Text style={[styles.feedbackText, feedback.ok ? styles.feedbackOkText : styles.feedbackErrorText]}>
              {feedback.message}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function HistoryTab({ items, loading }: { items: LeaveRequest[]; loading: boolean }) {
  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={LogoMid} />
        <Text style={styles.loadingText}>Loading leave history…</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.emptyCard, styles.flex]}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons name="calendar-clock-outline" size={28} color={LogoMid} />
        </View>
        <Text style={styles.emptyTitle}>No leave history</Text>
        <Text style={styles.emptyText}>Submitted requests will appear here with their current status.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
      {items.map((item) => {
        const tone = statusTone(item.status);
        return (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.historyTop}>
              <Text style={styles.historyType}>{item.type}</Text>
              <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                <Text style={[styles.statusText, { color: tone.fg }]}>{formatStatusLabel(item.status)}</Text>
              </View>
            </View>
            <Text style={styles.historyMeta}>
              {item.from} — {item.to} · {item.duration} · {formatBalance(item.days)} day(s)
            </Text>
            <Text style={styles.historyReason}>{item.reason}</Text>
            {item.rejectionReason ? (
              <Text style={styles.historyRejection}>Reason: {item.rejectionReason}</Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function CompOffTab({
  available,
  pending,
  items,
  loading,
}: {
  available: number;
  pending: number;
  items: CompOffRequest[];
  loading: boolean;
}) {
  const cardShadow = brandShadow('0 6px 10px rgba(11, 53, 110, 0.06)', {
    shadowColor: LogoNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  });

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={LogoMid} />
        <Text style={styles.loadingText}>Loading comp-off…</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.compStatRow}>
        <View style={[styles.compStatCard, styles.compAvailable, cardShadow]}>
          <Text style={styles.compStatLabel}>AVAILABLE</Text>
          <Text style={styles.compAvailableValue}>{formatBalance(available)}</Text>
          <Text style={styles.compAvailableHint}>Net balance</Text>
        </View>
        <View style={[styles.compStatCard, cardShadow]}>
          <Text style={styles.compStatLabel}>PENDING</Text>
          <Text style={styles.compPendingValue}>{pending}</Text>
          <Text style={styles.compPendingHint}>Applications</Text>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={[styles.compEmpty, styles.flex]}>
          <View style={styles.compGift}>
            <MaterialCommunityIcons name="gift-outline" size={28} color={LogoMid} />
          </View>
          <Text style={styles.compEmptyTitle}>
            {available > 0 ? 'Comp-Off Credits' : 'No Comp-Off Credits'}
          </Text>
          <Text style={styles.compEmptyText}>
            {available > 0
              ? `You have ${formatBalance(available)} comp-off day(s) available.`
              : 'You have no comp-off balance available.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const tone = statusTone(item.status);
            return (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <Text style={styles.historyType}>
                    {formatBalance(item.creditDays)} day{item.creditDays === 1 ? '' : 's'}
                  </Text>
                  <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusText, { color: tone.fg }]}>
                      {formatStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.historyMeta}>
                  Worked on {item.workDate}
                  {item.expiresAt ? ` · Expires ${item.expiresAt}` : ''}
                </Text>
                <Text style={styles.historyReason}>{item.reason}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tabBtn} accessibilityRole="button">
      {active ? (
        <LinearGradient colors={[LogoSky, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tabFill}>
          <Text style={styles.tabTextActive}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.tabFill}>
          <Text style={styles.tabText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ChoiceModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheetCard,
            brandShadow('0 16px 24px rgba(11, 53, 110, 0.18)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 16,
              elevation: 10,
            }),
          ]}
        >
          <Text style={styles.modalTitle}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FieldButton({
  label,
  icon,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} style={styles.field} accessibilityRole="button" accessibilityLabel={label}>
        <MaterialCommunityIcons name={icon} size={18} color={LogoMid} />
        <Text style={[styles.fieldValue, !value ? styles.placeholder : null]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={Mute} />
      </Pressable>
    </View>
  );
}

function DatePickerModal({
  visible,
  title,
  subtitle,
  value,
  minDate,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  value: Date | null;
  minDate?: Date | null;
  onClose: () => void;
  onSelect: (date: Date) => void;
}) {
  const fallback = minDate ?? value ?? new Date();
  const initial =
    value && (!minDate || startOfDay(value).getTime() >= startOfDay(minDate).getTime())
      ? value
      : fallback;
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  useEffect(() => {
    if (!visible) return;
    const next =
      value && (!minDate || startOfDay(value).getTime() >= startOfDay(minDate).getTime())
        ? value
        : (minDate ?? value ?? new Date());
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [value, visible, minDate]);

  const days = useMemo(() => buildCalendar(cursor), [cursor]);
  const minDay = minDate ? startOfDay(minDate) : null;
  const canGoPrevMonth =
    !minDay ||
    new Date(cursor.getFullYear(), cursor.getMonth(), 1).getTime() >
      new Date(minDay.getFullYear(), minDay.getMonth(), 1).getTime();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View
          style={[
            styles.modalCard,
            brandShadow('0 16px 24px rgba(11, 53, 110, 0.18)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.18,
              shadowRadius: 16,
              elevation: 10,
            }),
          ]}
          // Keep taps inside the calendar from closing the modal (esp. on web)
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.modalTitle}>{title}</Text>
          {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => {
                if (!canGoPrevMonth) return;
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
              }}
              disabled={!canGoPrevMonth}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={22}
                color={canGoPrevMonth ? LogoNavy : '#C5D3E3'}
              />
            </Pressable>
            <Text style={styles.monthTitle}>
              {monthNames[cursor.getMonth()]} {cursor.getFullYear()}
            </Text>
            <Pressable
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <MaterialCommunityIcons name="chevron-right" size={22} color={LogoNavy} />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.dayGrid}>
            {days.map((day, index) => {
              const isBeforeMin =
                Boolean(day && minDay) && startOfDay(day!).getTime() < minDay!.getTime();
              const isJoiningDay =
                Boolean(day && minDay) && startOfDay(day!).getTime() === minDay!.getTime();
              const disabled = !day || isBeforeMin;
              const selected = Boolean(value && day && !disabled && sameDay(day, value));
              return (
                <Pressable
                  key={index}
                  disabled={disabled}
                  onPress={() => {
                    if (!day || disabled) return;
                    onSelect(day);
                  }}
                  style={[
                    styles.dayCell,
                    selected ? styles.daySelected : null,
                    !selected && isJoiningDay ? styles.dayJoining : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected ? styles.dayTextSelected : null,
                      disabled && day ? styles.dayTextDisabled : null,
                      !selected && isJoiningDay ? styles.dayTextJoining : null,
                    ]}
                  >
                    {day ? day.getDate() : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function formatBalance(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatDate(date: Date) {
  return `${date.getDate()} ${monthNames[date.getMonth()]}, ${date.getFullYear()}`;
}

function formatApiDateDisplay(value: string) {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return `${day} ${monthNames[month]}, ${year}`;
}

function leaveTypeName(code: string) {
  switch (code) {
    case 'CL':
      return 'Casual Leave';
    case 'SL':
      return 'Sick Leave';
    case 'COMPOFF':
      return 'Compensatory Off';
    case 'UNPAID':
      return 'Unpaid Leave';
    default:
      return code;
  }
}

function formatHistoryDuration(duration: string, halfDaySession: string | null) {
  const normalized = duration.trim().toLowerCase();
  if (normalized.includes('half')) {
    const session = (halfDaySession || '').toLowerCase();
    if (session.includes('second')) return 'Second Half';
    if (session.includes('first')) return 'First Half';
    return 'Half Day';
  }
  return duration.trim() || 'Full Day';
}

function formatStatusLabel(status: string) {
  if (status === 'SupervisorApproved') return 'Supervisor Approved';
  return status;
}

function statusTone(status: string) {
  const key = status.toLowerCase();
  if (key.includes('reject') || key.includes('cancel') || key.includes('denied')) {
    return { bg: '#FFE8EC', fg: SickRed };
  }
  if (key.includes('approv')) {
    return { bg: '#DCFCE7', fg: '#15803D' };
  }
  return { bg: '#FFF4D6', fg: '#B45309' };
}

function toApiDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toApiDuration(duration: Duration): { Duration: string; HalfDaySession?: string } {
  if (duration === 'First Half') {
    return { Duration: 'Half Day', HalfDaySession: 'first_half' };
  }
  if (duration === 'Second Half') {
    return { Duration: 'Half Day', HalfDaySession: 'second_half' };
  }
  return { Duration: 'Full Day' };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function countLeaveDays(from: Date, to: Date, duration: Duration) {
  let days = 0;
  const cursor = startOfDay(from);
  const end = startOfDay(to);
  while (cursor.getTime() <= end.getTime()) {
    if (!isWeekend(cursor)) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  if (duration !== 'Full Day') {
    return Math.max(0.5, days - 0.5);
  }
  return days;
}

function buildCalendar(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= last.getDate(); day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
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
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: LogoNavy,
    fontSize: 17,
    fontFamily: 'Poppins_600SemiBold',
  },
  tabBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: Brand.white,
    padding: 4,
    flexDirection: 'row',
    zIndex: 2,
  },
  tabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabFill: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    color: Mute,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  tabTextActive: {
    color: Brand.white,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
    minHeight: 0,
  },
  requestScroll: {
    flexGrow: 1,
    paddingBottom: 28,
    gap: 12,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: Mute,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  joiningBlockedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  joiningBlockedTitle: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  joiningBlockedText: {
    color: Mute,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  balanceCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Brand.white,
    borderRadius: 14,
    borderTopWidth: 3,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  balanceLabel: {
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  balanceValue: {
    marginTop: 2,
    fontSize: 22,
    lineHeight: 26,
    fontFamily: 'Poppins_700Bold',
  },
  balanceHint: {
    marginTop: 2,
    color: Mute,
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
  },
  infoCard: {
    backgroundColor: SoftBlue,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  infoTitle: {
    color: LogoNavy,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  infoText: {
    marginTop: 2,
    color: Mute,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'Poppins_400Regular',
  },
  formCard: {
    backgroundColor: Brand.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  feedbackBox: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  feedbackOk: {
    backgroundColor: '#DCFCE7',
  },
  feedbackError: {
    backgroundColor: '#FFE8EC',
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Poppins_500Medium',
  },
  feedbackOkText: {
    color: SuccessGreen,
  },
  feedbackErrorText: {
    color: SickRed,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  dateCol: {
    flex: 1,
    minWidth: 0,
  },
  fieldBlock: {
    marginBottom: 8,
    zIndex: 2,
  },
  label: {
    marginBottom: 5,
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  field: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: FieldBg,
    borderWidth: 1,
    borderColor: '#D7E6F3',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonField: {
    height: 104,
    alignItems: 'flex-start',
    paddingTop: 12,
    paddingBottom: 12,
  },
  fieldValue: {
    flex: 1,
    marginLeft: 8,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  placeholder: {
    color: Mute,
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    marginLeft: 8,
    paddingVertical: 0,
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  sheetCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 16,
  },
  sheetRow: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: FieldBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetRowActive: {
    backgroundColor: SoftBlue,
    borderWidth: 1,
    borderColor: '#BFD8F2',
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  optionMeta: {
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  optionActive: {
    fontFamily: 'Poppins_600SemiBold',
    color: LogoMid,
  },
  footer: {
    backgroundColor: PageBg,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D7E6F3',
  },
  submitWrap: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  submitDisabled: {
    opacity: 0.75,
  },
  submit: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  emptyCard: {
    backgroundColor: Brand.white,
    borderRadius: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  emptyText: {
    marginTop: 6,
    color: Mute,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 14,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyType: {
    flex: 1,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  statusChip: {
    backgroundColor: '#FFF4D6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    color: '#B45309',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  historyMeta: {
    marginTop: 6,
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  historyReason: {
    marginTop: 6,
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  historyRejection: {
    marginTop: 6,
    color: SickRed,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  compStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  compStatCard: {
    flex: 1,
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  compAvailable: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#F8D7DA',
  },
  compStatLabel: {
    color: Mute,
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: 'Poppins_600SemiBold',
  },
  compAvailableValue: {
    marginTop: 4,
    color: SickRed,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: 'Poppins_700Bold',
  },
  compAvailableHint: {
    color: SickRed,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  compPendingValue: {
    marginTop: 4,
    color: '#16A34A',
    fontSize: 26,
    lineHeight: 32,
    fontFamily: 'Poppins_700Bold',
  },
  compPendingHint: {
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  compEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  compGift: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  compEmptyTitle: {
    color: LogoNavy,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  compEmptyText: {
    marginTop: 8,
    color: Mute,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 29, 55, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 16,
  },
  modalTitle: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  modalSubtitle: {
    marginTop: 6,
    color: Mute,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  monthRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  weekRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  weekDay: {
    width: '14.28%',
    textAlign: 'center',
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: LogoMid,
    borderRadius: 19,
  },
  dayJoining: {
    borderWidth: 1.5,
    borderColor: LogoMid,
    borderRadius: 19,
  },
  dayText: {
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  dayTextSelected: {
    color: Brand.white,
    fontFamily: 'Poppins_600SemiBold',
  },
  dayTextJoining: {
    color: LogoMid,
    fontFamily: 'Poppins_600SemiBold',
  },
  dayTextDisabled: {
    color: '#C5D3E3',
  },
});
