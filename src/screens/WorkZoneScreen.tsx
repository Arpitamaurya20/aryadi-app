import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAttendanceStatus, type AttendanceStatus } from '../api/attendance';
import type { AuthUser } from '../api/auth';
import { AnimatedWorkIcon, type WorkKind } from '../components/WorkZoneIcons';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const PunchInWash = '#D7EEFB';
const PunchOutWash = '#F3F7FB';
const TileBorder = '#D7EEFB';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const SoftPeach = '#FFE8DC';
const SoftMint = '#DFF5F0';

type WorkItem = {
  title: string;
  subtitle: string;
  kind: WorkKind;
};

const modules: WorkItem[] = [
  { title: 'Profile', subtitle: 'Personal info', kind: 'profile' },
  { title: 'Leave', subtitle: 'Apply and track', kind: 'leave' },
  { title: 'Attendance', subtitle: 'Punch in/out', kind: 'attendance' },
  { title: 'Convenience', subtitle: 'Claims & charges', kind: 'convenience' },
  { title: 'History', subtitle: 'Working ledger', kind: 'history' },
  { title: 'Employee KPI', subtitle: 'Performance', kind: 'kpi' },
  { title: 'HR Helpdesk', subtitle: 'Support & help', kind: 'helpdesk' },
  { title: 'Regularization', subtitle: 'WFH / Corrections', kind: 'regularization' },
];

type WorkZoneScreenProps = {
  user: AuthUser;
  onBack: () => void;
  onOpenProfile: () => void;
  onOpenLeave: () => void;
  onOpenAttendance: () => void;
  onOpenConvenience: () => void;
  onOpenHrHelpdesk: () => void;
  onOpenWfh: () => void;
  onOpenRegularization: () => void;
};

export function WorkZoneScreen({
  user,
  onBack,
  onOpenProfile,
  onOpenLeave,
  onOpenAttendance,
  onOpenConvenience,
  onOpenHrHelpdesk,
  onOpenWfh,
  onOpenRegularization,
}: WorkZoneScreenProps) {
  const firstName = user.username.trim().split(' ')[0] || 'there';
  const [showChooseOption, setShowChooseOption] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);

  const loadAttendance = useCallback(async () => {
    if (!user.employeeId) {
      setAttendanceLoading(false);
      return;
    }
    setAttendanceLoading(true);
    try {
      const status = await fetchAttendanceStatus(user.employeeId);
      setAttendance(status);
    } catch {
      setAttendance(null);
    } finally {
      setAttendanceLoading(false);
    }
  }, [user.employeeId]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showChooseOption) {
        setShowChooseOption(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, showChooseOption]);

  const punchInTime =
    attendance?.inTimeStatus && attendance.inTime ? attendance.inTime : '--:--';
  const punchOutTime =
    attendance?.outTimeStatus && attendance.outTime ? attendance.outTime : '--:--';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>My Work Zone</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.body}>
        <View
          style={[
            styles.shiftCard,
            brandShadow('0 10px 16px rgba(11, 53, 110, 0.12)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 8,
            }),
          ]}
        >
          <LinearGradient
            colors={[LogoSky, LogoMid, LogoNavy]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shiftHead}
          >
            <Text style={styles.hello}>Hello, {firstName}</Text>
            <Text style={styles.attendanceTitle}>Today's attendance</Text>
          </LinearGradient>
          <View style={styles.shiftRow}>
            {attendanceLoading ? (
              <View style={styles.attendanceLoading}>
                <ActivityIndicator color={LogoMid} />
                <Text style={styles.attendanceLoadingText}>Loading punch status…</Text>
              </View>
            ) : (
              <>
                <ShiftChip
                  icon="login"
                  label="Punch In"
                  value={punchInTime}
                  background={PunchInWash}
                  iconTint={LogoMid}
                  onPress={onOpenAttendance}
                />
                <ShiftChip
                  icon="logout"
                  label="Punch Out"
                  value={punchOutTime}
                  background={PunchOutWash}
                  iconTint={LogoNavy}
                  onPress={onOpenAttendance}
                />
              </>
            )}
          </View>
        </View>

        <View style={styles.sectionRow}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>My Workspace</Text>
        </View>
        <Text style={styles.sectionHint}>Open a module to continue your work.</Text>

        <View style={styles.grid}>
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={styles.gridRow}>
              {modules.slice(row * 2, row * 2 + 2).map((item, col) => (
                <WorkTile
                  key={item.kind}
                  item={item}
                  delay={(row * 2 + col) * 90}
                  onPress={
                    item.kind === 'profile'
                      ? onOpenProfile
                      : item.kind === 'leave'
                        ? onOpenLeave
                        : item.kind === 'attendance'
                          ? onOpenAttendance
                          : item.kind === 'convenience'
                            ? onOpenConvenience
                            : item.kind === 'helpdesk'
                              ? onOpenHrHelpdesk
                              : item.kind === 'regularization'
                                ? () => setShowChooseOption(true)
                                : undefined
                  }
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      <ChooseOptionModal
        visible={showChooseOption}
        onClose={() => setShowChooseOption(false)}
        onSelect={(option) => {
          setShowChooseOption(false);
          if (option === 'wfh') {
            onOpenWfh();
            return;
          }
          onOpenRegularization();
        }}
      />
    </View>
  );
}

function ChooseOptionModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (option: 'regularization' | 'wfh') => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            brandShadow('0 16px 28px rgba(11, 53, 110, 0.2)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 18,
              elevation: 12,
            }),
          ]}
        >
          <LinearGradient
            colors={[LogoSky, LogoMid, LogoNavy, LogoMid, LogoSky]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalStripe}
          />
          <Pressable onPress={onClose} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Close">
            <MaterialCommunityIcons name="close" size={16} color={LogoNavy} />
          </Pressable>

          <Text style={styles.modalTitle}>Choose Option</Text>
          <Text style={styles.modalHint}>Select Regularization or Work From Home</Text>

          <View style={styles.optionRow}>
            <Pressable
              onPress={() => onSelect('regularization')}
              style={styles.optionCard}
              accessibilityRole="button"
              accessibilityLabel="Regularization"
            >
              <View style={[styles.optionIcon, { backgroundColor: SoftPeach }]}>
                <MaterialCommunityIcons name="calendar-clock" size={28} color={LogoMid} />
              </View>
              <Text style={styles.optionTitle}>Regularization</Text>
              <Text style={styles.optionSubtitle}>Attendance Correction</Text>
            </Pressable>

            <Pressable
              onPress={() => onSelect('wfh')}
              style={styles.optionCard}
              accessibilityRole="button"
              accessibilityLabel="Work From Home"
            >
              <View style={[styles.optionIcon, { backgroundColor: SoftMint }]}>
                <MaterialCommunityIcons name="home-account" size={28} color={LogoNavy} />
              </View>
              <Text style={styles.optionTitle}>WFH</Text>
              <Text style={styles.optionSubtitle}>Work From Home</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ShiftChip({
  icon,
  label,
  value,
  background,
  iconTint,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  background: string;
  iconTint: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      style={[styles.chip, { backgroundColor: background }]}
    >
      <View style={[styles.chipIcon, { borderColor: `${iconTint}29` }]}>
        <MaterialIcons name={icon} size={18} color={iconTint} />
      </View>
      <View style={styles.chipCopy}>
        <Text style={styles.chipLabel}>{label}</Text>
        <Text style={styles.chipValue}>{value}</Text>
      </View>
    </Pressable>
  );
}

function WorkTile({
  item,
  delay,
  onPress,
}: {
  item: WorkItem;
  delay: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} ${item.subtitle}`}
      style={[
        styles.tile,
        brandShadow('0 6px 10px rgba(11, 53, 110, 0.08)', {
          shadowColor: LogoNavy,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 4,
        }),
      ]}
    >
      <View style={styles.tileIcon}>
        <AnimatedWorkIcon kind={item.kind} delay={delay} />
      </View>
      <Text style={[styles.tileTitle, webTitle]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[styles.tileSubtitle, webTitle]} numberOfLines={1}>
        {item.subtitle}
      </Text>
    </Pressable>
  );
}

const webTitle =
  Platform.OS === 'web'
    ? {
        wordBreak: 'normal' as const,
        overflowWrap: 'normal' as const,
      }
    : null;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  header: {
    paddingHorizontal: 6,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  shiftCard: {
    backgroundColor: Brand.white,
    borderRadius: 22,
    overflow: 'hidden',
  },
  shiftHead: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hello: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  attendanceTitle: {
    color: Brand.white,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  shiftRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
    minHeight: 78,
    alignItems: 'center',
  },
  attendanceLoading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  attendanceLoadingText: {
    color: Mute,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  chip: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.white,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chipCopy: {
    flex: 1,
    minWidth: 0,
  },
  chipLabel: {
    color: Brand.placeholder,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  chipValue: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  sectionRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: LogoMid,
    marginRight: 8,
  },
  sectionTitle: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  sectionHint: {
    marginTop: 2,
    marginBottom: 10,
    color: Brand.placeholder,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  grid: {
    flex: 1,
    gap: 8,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: TileBorder,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIcon: {
    width: 36,
    height: 36,
    marginBottom: 4,
  },
  tileTitle: {
    width: '100%',
    color: LogoNavy,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  tileSubtitle: {
    width: '100%',
    color: Brand.placeholder,
    fontSize: 10,
    lineHeight: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 53, 110, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.white,
    borderRadius: 22,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
  },
  modalStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalTitle: {
    marginTop: 8,
    color: LogoNavy,
    fontSize: 18,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  modalHint: {
    marginTop: 6,
    marginBottom: 16,
    color: Mute,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TileBorder,
    backgroundColor: Brand.white,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  optionTitle: {
    color: LogoNavy,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  optionSubtitle: {
    marginTop: 3,
    color: Mute,
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
});
