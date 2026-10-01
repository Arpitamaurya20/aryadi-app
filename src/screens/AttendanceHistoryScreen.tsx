import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { fetchAttendanceRecords, formatJoiningDate, type AttendanceHistoryRecord } from '../api/attendance';
import type { AuthUser } from '../api/auth';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const Present = '#22C55E';
const PresentWash = '#DDF6E8';
const Holiday = '#16A34A';
const Pending = '#F59E0B';
const PendingWash = '#FFE8C2';
const Absent = '#EF4444';
const Rejected = '#7C3AED';
const LateRed = '#E11D48';

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DayStatus = 'present' | 'holiday' | 'absent' | 'pending' | 'rejected';
type AttendanceLog = AttendanceHistoryRecord;

type AttendanceHistoryScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

export function AttendanceHistoryScreen({ user, onBack }: AttendanceHistoryScreenProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [tab, setTab] = useState<'trend' | 'breakdown'>('trend');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const joiningLabel = formatJoiningDate(user.joiningDate) || '—';
  const selectedLog = logs.find((item) => item.day === selectedDay) ?? null;
  const statusByDay = useMemo(() => {
    const map: Record<number, DayStatus> = {};
    logs.forEach((item) => {
      map[item.day] = item.dayStatus;
    });
    return map;
  }, [logs]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecords() {
      if (!user.employeeId || user.employeeId <= 0) {
        setLogs([]);
        setLoadError('Employee ID is missing. Sign in again.');
        return;
      }
      setLoading(true);
      setLoadError('');
      try {
        const records = await fetchAttendanceRecords(user.employeeId, cursor.getFullYear(), cursor.getMonth() + 1);
        if (!cancelled) setLogs(records);
      } catch (error) {
        if (!cancelled) {
          setLogs([]);
          setLoadError(error instanceof Error ? error.message : 'Unable to load attendance records.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRecords();
    return () => {
      cancelled = true;
    };
  }, [cursor, user.employeeId]);

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);
  const analytics = useMemo(() => buildAnalytics(logs), [logs]);

  function shiftMonth(delta: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    const days = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    const preferred =
      next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
        ? Math.min(today.getDate(), days)
        : 1;
    setSelectedDay(preferred);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={22} color={LogoNavy} />
          </Pressable>
          <Text style={styles.headerTitle}>Attendance History</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.monthBand}>
          <View style={styles.monthNav}>
            <Pressable onPress={() => shiftMonth(-1)} style={styles.monthBtn} accessibilityRole="button" accessibilityLabel="Previous month">
              <MaterialCommunityIcons name="chevron-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.monthTitle}>
              {monthNames[cursor.getMonth()]} {cursor.getFullYear()}
            </Text>
            <Pressable onPress={() => shiftMonth(1)} style={styles.monthBtn} accessibilityRole="button" accessibilityLabel="Next month">
              <MaterialCommunityIcons name="chevron-right" size={22} color={Brand.white} />
            </Pressable>
          </View>
        </LinearGradient>

        <View
          style={[
            styles.card,
            styles.calendarCard,
            brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }),
          ]}
        >
          <Text style={styles.employeeName}>{user.username.toUpperCase()}</Text>
          <Text style={styles.joined}>Joined: {joiningLabel.replace(',', '')}</Text>

          <View style={styles.weekRow}>
            {weekDays.map((day) => (
              <Text key={day} style={[styles.weekLabel, day === 'SUN' ? styles.weekSunday : null]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {cells.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
              const future = date.getTime() > today.getTime();
              const status = !future ? statusByDay[day] : undefined;
              const selected = day === selectedDay;
              return (
                <Pressable
                  key={day}
                  disabled={future}
                  onPress={() => setSelectedDay(day)}
                  style={styles.dayCell}
                  accessibilityRole="button"
                  accessibilityLabel={`${day} ${monthNames[cursor.getMonth()]}`}
                >
                  <View style={[styles.dayBubble, bubbleStyle(status, selected, future)]}>
                    <Text style={[styles.dayText, dayTextStyle(status, selected, future)]}>{day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legend}>
            <LegendDot color={Present} label="Present" />
            <LegendDot color={Holiday} label="Holiday" />
            <LegendDot color={Absent} label="Absent" />
            <LegendDot color={Pending} label="Pending" />
          </View>
          <View style={styles.legendCenter}>
            <LegendDot color={Rejected} label="Rejected" />
          </View>
        </View>

        <View
          style={[
            styles.card,
            brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }),
          ]}
        >
          <Text style={styles.sectionTitle}>Attendance Analytics</Text>
          <View style={styles.tabs}>
            <Pressable
              onPress={() => setTab('trend')}
              style={[styles.tab, tab === 'trend' ? styles.tabActive : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.tabText, tab === 'trend' ? styles.tabTextActive : null]}>IN-TIME TREND</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('breakdown')}
              style={[styles.tab, tab === 'breakdown' ? styles.tabActive : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.tabText, tab === 'breakdown' ? styles.tabTextActive : null]}>BREAKDOWN</Text>
            </Pressable>
          </View>

          <View style={styles.statRow}>
            <StatBox label="AVG. IN-TIME" value={analytics.avgInTime} />
            <StatBox label="ON-TIME DAYS" value={analytics.onTime} />
            <StatBox label="LOGGED DAYS" value={String(analytics.logged)} />
          </View>

          {tab === 'trend' ? (
            <InTimeChart logs={[...logs].reverse()} />
          ) : (
            <BreakdownPanel logs={logs} />
          )}
        </View>

        <View
          style={[
            styles.card,
            brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }),
          ]}
        >
          <View style={styles.summaryHead}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeDay}>{String(selectedDay).padStart(2, '0')}</Text>
              <Text style={styles.dateBadgeMonth}>{monthShort[cursor.getMonth()].toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.summaryTitle}>Daily Summary</Text>
              <Text style={styles.summaryDate}>
                {selectedDay} {monthShort[cursor.getMonth()]} {cursor.getFullYear()}
              </Text>
            </View>
          </View>

          <PunchRow icon="login" label="PUNCH IN TIME" value={selectedLog?.inTime ?? '--:--'} />
          <PunchRow icon="logout" label="PUNCH OUT TIME" value={selectedLog?.outTime ?? '--:--'} />

          <View style={styles.durationBox}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={Mute} />
            <View style={styles.durationCopy}>
              <Text style={styles.durationLabel}>TOTAL DURATION</Text>
              <Text style={styles.durationValue}>{selectedLog?.duration ?? 'N.A.'}</Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.card,
            brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }),
          ]}
        >
          <Text style={styles.sectionTitle}>Monthly Log</Text>
          <Text style={styles.logHint}>
            All records for {monthNames[cursor.getMonth()]} {cursor.getFullYear()}
          </Text>
          <View style={styles.logHead}>
            <Text style={[styles.logHeadText, styles.logDateCol]}>DATE</Text>
            <Text style={[styles.logHeadText, styles.logPunchCol]}>PUNCH IN / OUT</Text>
            <Text style={[styles.logHeadText, styles.logDurationCol]}>DURATION</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={LogoMid} style={styles.loader} />
          ) : loadError ? (
            <Text style={styles.emptyLog}>{loadError}</Text>
          ) : logs.length === 0 ? (
            <Text style={styles.emptyLog}>No attendance records for this month.</Text>
          ) : (
            logs.map((item) => {
              const date = new Date(cursor.getFullYear(), cursor.getMonth(), item.day);
              const chip = logChipStyle(item.status);
              return (
                <Pressable key={item.day} onPress={() => setSelectedDay(item.day)} style={styles.logRow}>
                  <View style={styles.logDateCol}>
                    <Text style={styles.logDay}>{String(item.day).padStart(2, '0')}</Text>
                    <Text style={styles.logWeek}>{weekdayShort[date.getDay()]}</Text>
                    <View style={[styles.statusChip, chip.box]}>
                      <Text style={[styles.statusText, chip.text]}>{chip.label}</Text>
                    </View>
                  </View>
                  <View style={styles.logPunchCol}>
                    <View style={styles.punchLine}>
                      <MaterialCommunityIcons name="login" size={14} color={Present} />
                      <Text style={styles.punchTime}>{item.inTime}</Text>
                    </View>
                    <View style={styles.punchLine}>
                      <MaterialCommunityIcons name="logout" size={14} color={LogoMid} />
                      <Text style={styles.punchTime}>{item.outTime ?? '--:--'}</Text>
                    </View>
                  </View>
                  <View style={styles.logDurationCol}>
                    <View style={styles.durationPill}>
                      <Text style={styles.durationPillText}>{item.duration ?? 'N.A.'}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function PunchRow({ icon, label, value }: { icon: 'login' | 'logout'; label: string; value: string }) {
  return (
    <View style={styles.punchRow}>
      <View style={[styles.punchIcon, icon === 'login' ? styles.punchIconIn : styles.punchIconOut]}>
        <MaterialCommunityIcons name={icon} size={16} color={icon === 'login' ? Present : LogoMid} />
      </View>
      <View>
        <Text style={styles.punchLabel}>{label}</Text>
        <Text style={styles.punchValue}>{value}</Text>
      </View>
    </View>
  );
}

function InTimeChart({ logs }: { logs: AttendanceLog[] }) {
  const timed = logs.filter((item) => /^\d{1,2}:\d{2}/.test(item.inTime));
  if (timed.length === 0) {
    return <Text style={styles.emptyLog}>No in-time trend for this month.</Text>;
  }

  const width = 320;
  const height = 180;
  const padLeft = 46;
  const padRight = 8;
  const padTop = 12;
  const padBottom = 28;
  const minMin = 8 * 60;
  const maxMin = 13 * 60;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = timed.map((item, index) => {
    const minutes = timeToMinutes(item.inTime);
    const x = padLeft + (timed.length === 1 ? plotW / 2 : (index / (timed.length - 1)) * plotW);
    const y = padTop + ((maxMin - minutes) / (maxMin - minMin)) * plotH;
    return { x, y, day: item.day };
  });
  const lateY = padTop + ((maxMin - 10 * 60) / (maxMin - minMin)) * plotH;
  const poly = points.map((point) => `${point.x},${point.y}`).join(' ');
  const ticks = [13, 12, 11, 10, 9, 8];

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {ticks.map((hour) => {
          const y = padTop + ((maxMin - hour * 60) / (maxMin - minMin)) * plotH;
          return (
            <SvgText key={hour} x={0} y={y + 4} fill={Mute} fontSize="9">
              {hour === 12 ? '12:00 PM' : hour === 13 ? '1:00 PM' : `${hour}:00 AM`}
            </SvgText>
          );
        })}
        <Line x1={padLeft} y1={lateY} x2={width - padRight} y2={lateY} stroke={LateRed} strokeDasharray="4 3" strokeWidth="1" />
        <SvgText x={padLeft + 8} y={lateY - 4} fill={LateRed} fontSize="9">
          Late Limit (10:00 AM)
        </SvgText>
        <Polyline points={poly} fill="none" stroke={LogoMid} strokeWidth="2.5" />
        {points.map((point) => (
          <Circle key={point.day} cx={point.x} cy={point.y} r="3.5" fill={Brand.white} stroke={LogoMid} strokeWidth="2" />
        ))}
      </Svg>
    </View>
  );
}

function logChipStyle(status: AttendanceLog['status']) {
  if (status === 'approved') {
    return { box: styles.statusApproved, text: styles.statusApprovedText, label: 'APPROVED' };
  }
  if (status === 'rejected') {
    return { box: styles.statusRejected, text: styles.statusRejectedText, label: 'REJECTED' };
  }
  return { box: styles.statusPending, text: styles.statusPendingText, label: 'PENDING' };
}

function BreakdownPanel({ logs }: { logs: AttendanceLog[] }) {
  const approved = logs.filter((item) => item.status === 'approved').length;
  const pending = logs.filter((item) => item.status === 'pending').length;
  const rejected = logs.filter((item) => item.status === 'rejected').length;
  const rows = [
    { label: 'Approved', value: approved, color: Present },
    { label: 'Pending', value: pending, color: Pending },
    { label: 'Holiday', value: 0, color: Holiday },
    { label: 'Absent', value: 0, color: Absent },
    { label: 'Rejected', value: rejected, color: Rejected },
  ];
  return (
    <View style={styles.breakdown}>
      {rows.map((row) => (
        <View key={row.label} style={styles.breakdownRow}>
          <View style={[styles.legendDot, { backgroundColor: row.color }]} />
          <Text style={styles.breakdownLabel}>{row.label}</Text>
          <Text style={styles.breakdownValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function bubbleStyle(status: DayStatus | undefined, selected: boolean, future: boolean) {
  if (selected) return { backgroundColor: LogoNavy };
  if (future || !status) return null;
  if (status === 'pending') return { backgroundColor: PendingWash };
  if (status === 'absent') return { backgroundColor: '#FEE2E2' };
  if (status === 'rejected') return { backgroundColor: '#EDE9FE' };
  return { backgroundColor: PresentWash };
}

function dayTextStyle(status: DayStatus | undefined, selected: boolean, future: boolean) {
  if (selected) return { color: Brand.white };
  if (future) return { color: '#C5D0DC' };
  if (!status) return { color: Mute };
  return { color: LogoNavy };
}

function buildMonthCells(monthStart: Date) {
  const firstWeekday = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1).getDay();
  const days = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function buildAnalytics(logs: AttendanceLog[]) {
  const timed = logs.filter((item) => /^\d{1,2}:\d{2}/.test(item.inTime));
  if (timed.length === 0) {
    return { avgInTime: '--', onTime: '--', logged: logs.length };
  }
  const minutes = timed.map((item) => timeToMinutes(item.inTime));
  const avg = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length);
  const onTimeCount = minutes.filter((value) => value <= 10 * 60).length;
  const percent = Math.round((onTimeCount / timed.length) * 100);
  return {
    avgInTime: formatClock(avg),
    onTime: `${percent}%`,
    logged: logs.length,
  };
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function formatClock(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  topBar: {
    backgroundColor: Brand.white,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: LogoNavy,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  content: {
    paddingBottom: 28,
  },
  monthBand: {
    marginHorizontal: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 36,
  },
  monthNav: {
    minHeight: 64,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: Brand.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  calendarCard: {
    marginTop: -28,
  },
  employeeName: {
    textAlign: 'center',
    color: LogoNavy,
    fontSize: 16,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_700Bold',
  },
  joined: {
    marginTop: 2,
    marginBottom: 12,
    textAlign: 'center',
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  weekSunday: {
    color: LateRed,
  },
  dayGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  legend: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendCenter: {
    marginTop: 8,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  sectionTitle: {
    color: LogoNavy,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  tabs: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: SoftBlue,
    padding: 4,
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: Brand.white,
  },
  tabText: {
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  tabTextActive: {
    color: LogoMid,
  },
  statRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7E8F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statLabel: {
    color: Mute,
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
  },
  statValue: {
    marginTop: 4,
    color: LogoMid,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  chartWrap: {
    marginTop: 8,
  },
  breakdown: {
    marginTop: 12,
  },
  breakdownRow: {
    minHeight: 42,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: SoftBlue,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownLabel: {
    flex: 1,
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  breakdownValue: {
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateBadge: {
    width: 58,
    height: 58,
    marginRight: 12,
    borderRadius: 16,
    backgroundColor: LogoNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeDay: {
    color: Brand.white,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: 'Poppins_700Bold',
  },
  dateBadgeMonth: {
    color: LogoSky,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  summaryTitle: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  summaryDate: {
    marginTop: 2,
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  punchRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  punchIcon: {
    width: 36,
    height: 36,
    marginRight: 10,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchIconIn: {
    backgroundColor: PresentWash,
  },
  punchIconOut: {
    backgroundColor: SoftBlue,
  },
  punchLabel: {
    color: Mute,
    fontSize: 11,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_600SemiBold',
  },
  punchValue: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  durationBox: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D5E4F2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationCopy: {
    marginLeft: 10,
  },
  durationLabel: {
    color: Mute,
    fontSize: 11,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_600SemiBold',
  },
  durationValue: {
    color: LogoMid,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  logHint: {
    marginTop: 4,
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  logHead: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logHeadText: {
    color: Mute,
    fontSize: 11,
    letterSpacing: 0.4,
    fontFamily: 'Poppins_600SemiBold',
  },
  logRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SoftBlue,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logDateCol: {
    width: 78,
  },
  logPunchCol: {
    flex: 1,
  },
  logDurationCol: {
    width: 64,
    alignItems: 'flex-end',
  },
  logDay: {
    color: LogoMid,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  logWeek: {
    color: Mute,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  statusChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusApproved: {
    backgroundColor: PresentWash,
  },
  statusPending: {
    backgroundColor: '#FFF4D6',
  },
  statusText: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
  },
  statusApprovedText: {
    color: Holiday,
  },
  statusPendingText: {
    color: '#D97706',
  },
  statusRejected: {
    backgroundColor: '#EDE9FE',
  },
  statusRejectedText: {
    color: Rejected,
  },
  loader: {
    marginVertical: 16,
  },
  punchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  punchTime: {
    marginLeft: 6,
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  durationPill: {
    minWidth: 54,
    borderRadius: 10,
    backgroundColor: SoftBlue,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  durationPillText: {
    color: LogoMid,
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  emptyLog: {
    marginTop: 16,
    color: Mute,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
});
