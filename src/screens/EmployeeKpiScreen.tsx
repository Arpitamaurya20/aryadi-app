import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const FieldStroke = '#D5E4F2';
const PresentGreen = '#0F9F6E';
const AbsentRed = '#E11D48';
const LeaveAmber = '#D97706';

type EmployeeKpiScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

type KpiSnapshot = {
  overallScore: number;
  calculatedSalary: number;
  attendanceScore: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
};

export function EmployeeKpiScreen({ user, onBack }: EmployeeKpiScreenProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const defaultStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [draftStart, setDraftStart] = useState(defaultStart);
  const [draftEnd, setDraftEnd] = useState(today);
  const [datePickerFor, setDatePickerFor] = useState<'start' | 'end' | null>(null);
  const [kpi, setKpi] = useState<KpiSnapshot>(() => buildKpiSnapshot(defaultStart, today));

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (datePickerFor) {
        setDatePickerFor(null);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, datePickerFor]);

  const dateOptions = useMemo(
    () => buildDateOptions(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()), today),
    [today],
  );

  function applyFilter() {
    let from = startOfDay(draftStart);
    let to = startOfDay(draftEnd);
    if (from.getTime() > to.getTime()) {
      const swap = from;
      from = to;
      to = swap;
    }
    setStartDate(from);
    setEndDate(to);
    setDraftStart(from);
    setDraftEnd(to);
    setKpi(buildKpiSnapshot(from, to));
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
            <Text style={styles.headerTitle}>KPI Dashboard</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.filterCard,
            brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }),
          ]}
        >
          <View style={styles.filterHead}>
            <MaterialCommunityIcons name="filter-variant" size={18} color={LogoNavy} />
            <Text style={styles.filterTitle}>Filter by Period</Text>
          </View>
          <View style={styles.filterRule} />

          <Text style={styles.fieldLabel}>START DATE</Text>
          <Pressable onPress={() => setDatePickerFor('start')} style={styles.dateField} accessibilityRole="button">
            <MaterialCommunityIcons name="calendar-month-outline" size={18} color={LogoMid} />
            <Text style={styles.dateValue}>{formatDisplayDate(draftStart)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color={Mute} />
          </Pressable>

          <Text style={styles.fieldLabel}>END DATE</Text>
          <Pressable onPress={() => setDatePickerFor('end')} style={styles.dateField} accessibilityRole="button">
            <MaterialCommunityIcons name="calendar-month-outline" size={18} color={LogoMid} />
            <Text style={styles.dateValue}>{formatDisplayDate(draftEnd)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color={Mute} />
          </Pressable>

          <Pressable onPress={applyFilter} accessibilityRole="button">
            <LinearGradient colors={[LogoNavy, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.applyBtn}>
              <MaterialCommunityIcons name="check" size={18} color={Brand.white} />
              <Text style={styles.applyText}>Apply Date Filter</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View
          style={[
            styles.scoreCard,
            brandShadow('0 14px 24px rgba(11, 53, 110, 0.22)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.22,
              shadowRadius: 18,
              elevation: 8,
            }),
          ]}
        >
          <LinearGradient colors={['#0A2A58', LogoNavy, '#0E3A72']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scoreCardInner}>
            <Text style={styles.scoreTitle}>Overall Score</Text>
            <Text style={styles.scoreSubtitle}>Based on your cumulative KPI results</Text>

            <View style={styles.scoreRingOuter}>
              <View style={styles.scoreRingInner}>
                <Text style={styles.gaugePercent}>{kpi.overallScore.toFixed(2)}%</Text>
                <Text style={styles.gaugeCaption}>SCORE</Text>
              </View>
            </View>

            <Text style={styles.salaryLabel}>CALCULATED SALARY</Text>
            <Text style={styles.salaryValue}>{formatCurrency(kpi.calculatedSalary)}</Text>
            <Text style={styles.salaryHint}>Adjusted based on performance index</Text>
            <Text style={styles.periodChip}>
              {formatDisplayDate(startDate)} – {formatDisplayDate(endDate)}
            </Text>
          </LinearGradient>
        </View>

        <Text style={styles.sectionTitle}>Performance Metrics</Text>

        <View
          style={[
            styles.metricCard,
            brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 5,
            }),
          ]}
        >
          <View style={styles.metricAccent} />
          <View style={styles.metricHead}>
            <View style={styles.metricIcon}>
              <MaterialCommunityIcons name="account-group" size={18} color={PresentGreen} />
            </View>
            <Text style={styles.metricTitle}>Attendance KPI</Text>
          </View>

          <View style={styles.metricScoreBox}>
            <Text style={styles.metricScoreValue}>{kpi.attendanceScore.toFixed(2)}%</Text>
            <Text style={styles.metricScoreLabel}>Attendance Score</Text>
          </View>

          <MetricRow icon="check" iconBg={PresentGreen} label="Present Days" value={String(kpi.presentDays)} />
          <MetricRow icon="close" iconBg={AbsentRed} label="Absent Days" value={String(kpi.absentDays)} />
          <MetricRow icon="calendar" iconBg={LeaveAmber} label="Leaves" value={String(kpi.leaveDays)} last />
        </View>

        <Text style={styles.employeeNoteText}>
          {user.username} · Employee KPI summary
        </Text>
      </ScrollView>

      <Modal visible={!!datePickerFor} transparent animationType="fade" onRequestClose={() => setDatePickerFor(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setDatePickerFor(null)}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>{datePickerFor === 'start' ? 'Select start date' : 'Select end date'}</Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {dateOptions.map((date) => {
                const active =
                  datePickerFor === 'start'
                    ? draftStart.toDateString() === date.toDateString()
                    : draftEnd.toDateString() === date.toDateString();
                return (
                  <Pressable
                    key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                    onPress={() => {
                      if (datePickerFor === 'start') setDraftStart(date);
                      else setDraftEnd(date);
                      setDatePickerFor(null);
                    }}
                    style={[styles.sheetRow, active ? styles.sheetRowActive : null]}
                  >
                    <Text style={[styles.sheetRowText, active ? styles.sheetRowTextActive : null]}>
                      {formatDisplayDate(date)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function MetricRow({
  icon,
  iconBg,
  label,
  value,
  last,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconBg: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.metricRow, last ? null : styles.metricRowSpacing]}>
      <View style={[styles.metricRowIcon, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={14} color={Brand.white} />
      </View>
      <Text style={styles.metricRowLabel}>{label}</Text>
      <Text style={styles.metricRowValue}>{value}</Text>
    </View>
  );
}

function buildKpiSnapshot(from: Date, to: Date): KpiSnapshot {
  const days = Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000) + 1);
  const presentDays = Math.min(days, Math.max(1, Math.round(days * 0.35)));
  const leaveDays = Math.min(days - presentDays, Math.max(0, Math.round(days * 0.05)));
  const absentDays = Math.max(0, days - presentDays - leaveDays);
  const attendanceScore = Number(((presentDays / days) * 100).toFixed(2));
  const overallScore = Number((attendanceScore * 0.92 + 2.4).toFixed(2));
  const calculatedSalary = Number((overallScore * 70).toFixed(1));

  return {
    overallScore,
    calculatedSalary,
    attendanceScore,
    presentDays,
    absentDays,
    leaveDays,
  };
}

function formatDisplayDate(date: Date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function formatCurrency(value: number) {
  const fixed = value.toFixed(1);
  const [whole, decimal] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₹${withCommas}.${decimal}`;
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
    if (dates.length >= 90) break;
  }
  return dates;
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
    paddingHorizontal: 4,
    paddingBottom: 14,
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
    color: Brand.white,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  filterCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  filterHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTitle: {
    marginLeft: 8,
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  filterRule: {
    marginTop: 12,
    marginBottom: 14,
    height: 1,
    backgroundColor: SoftBlue,
  },
  fieldLabel: {
    marginBottom: 7,
    color: Mute,
    fontSize: 11,
    letterSpacing: 0.7,
    fontFamily: 'Poppins_600SemiBold',
  },
  dateField: {
    minHeight: 48,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FieldStroke,
    backgroundColor: '#F8FBFE',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateValue: {
    flex: 1,
    marginHorizontal: 8,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  applyBtn: {
    marginTop: 2,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    marginLeft: 8,
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  scoreCard: {
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  scoreCardInner: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: 'center',
  },
  scoreTitle: {
    color: Brand.white,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  scoreSubtitle: {
    marginTop: 4,
    color: 'rgba(232, 244, 253, 0.78)',
    fontSize: 12,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  scoreRingOuter: {
    marginTop: 18,
    marginBottom: 16,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 12,
    borderColor: '#2A4A78',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(58, 171, 242, 0.12)',
  },
  scoreRingInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePercent: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: LogoNavy,
  },
  gaugeCaption: {
    marginTop: 2,
    color: Mute,
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'Poppins_600SemiBold',
  },
  salaryLabel: {
    color: 'rgba(232, 244, 253, 0.7)',
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: 'Poppins_600SemiBold',
  },
  salaryValue: {
    marginTop: 4,
    color: LogoSky,
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
  },
  salaryHint: {
    marginTop: 4,
    color: 'rgba(232, 244, 253, 0.62)',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  periodChip: {
    marginTop: 14,
    color: SoftBlue,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    color: LogoNavy,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  metricCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  metricAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: PresentGreen,
  },
  metricHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F8F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  metricTitle: {
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  metricScoreBox: {
    alignItems: 'center',
    marginVertical: 14,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: SoftBlue,
  },
  metricScoreValue: {
    color: LogoNavy,
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
  },
  metricScoreLabel: {
    marginTop: 4,
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  metricRow: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: SoftBlue,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricRowSpacing: {
    marginBottom: 8,
  },
  metricRowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  metricRowLabel: {
    flex: 1,
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  metricRowValue: {
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  employeeNoteText: {
    marginTop: 16,
    textAlign: 'center',
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
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
    paddingTop: 14,
    paddingBottom: 16,
  },
  sheetTitle: {
    color: LogoNavy,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
    marginBottom: 10,
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
  },
  sheetRowActive: {
    backgroundColor: LogoMid,
  },
  sheetRowText: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  sheetRowTextActive: {
    color: Brand.white,
  },
});
