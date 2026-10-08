import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fetchAttendanceStatus, type AttendanceStatus } from '../api/attendance';
import type { AuthUser } from '../api/auth';
import { IndustrialIconBadge, type IndustrialModule } from '../components/IndustrialIcons';
import { useHomeData, type NoticeAction, type TaskKind } from '../hooks/useHomeData';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { MyTasksTab } from './home/MyTasksTab';
import { NotificationsTab } from './home/NotificationsTab';
import { SettingsTab } from './home/SettingsTab';

const PageBg = '#F4F7FB';
const HeroStart = '#0A4F9C';
const HeroEnd = '#0870D6';
const PresentGreen = '#22C55E';
const PunchInGreen = '#16A34A';
const PunchOutRed = '#E11D48';
const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const ActiveBlue = '#087FE8';

const modules: { title: string; subtitle: string; kind: IndustrialModule }[] = [
  { title: 'My All Tickets', subtitle: 'Ticket desk', kind: 'corporate' },
  { title: 'Site Visits', subtitle: 'On-site work', kind: 'siteVisits' },
  { title: 'Mapped Assets', subtitle: 'Locations', kind: 'mappedAssets' },
  { title: 'My Work Zone', subtitle: 'Daily tasks', kind: 'workZone' },
  { title: 'Speak Up', subtitle: 'Support desk', kind: 'speakUp' },
  { title: 'Vendors', subtitle: 'Registration', kind: 'vendors' },
];

const tabs = [
  { label: 'Dashboard', icon: 'home' as const, iconOutline: 'home-outline' as const },
  { label: 'My Tasks', icon: 'clipboard' as const, iconOutline: 'clipboard-outline' as const },
  { label: 'Notifications', icon: 'notifications' as const, iconOutline: 'notifications-outline' as const },
  { label: 'Settings', icon: 'settings' as const, iconOutline: 'settings-outline' as const },
];

const DashboardTab = 0;
const TasksTab = 1;
const NotificationsTabIndex = 2;
const SettingsTabIndex = 3;

/** Home unmounts while another module is open; this brings the user back to the tab they left. */
let lastSelectedTab = DashboardTab;

type HomeScreenProps = {
  user: AuthUser;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenTickets: () => void;
  onOpenSiteVisits: () => void;
  onOpenMappedAssets: () => void;
  onOpenWorkZone: () => void;
  onOpenSpeakUp: () => void;
  onOpenVendors: () => void;
};

export function HomeScreen({
  user,
  onLogout,
  onOpenProfile,
  onOpenTickets,
  onOpenSiteVisits,
  onOpenMappedAssets,
  onOpenWorkZone,
  onOpenSpeakUp,
  onOpenVendors,
}: HomeScreenProps) {
  const [selectedTab, setSelectedTabState] = useState(lastSelectedTab);
  const [attendance, setAttendance] = useState<AttendanceStatus | null>(null);
  const homeData = useHomeData(user, attendance);

  const setSelectedTab = useCallback((index: number) => {
    lastSelectedTab = index;
    setSelectedTabState(index);
  }, []);

  useEffect(() => {
    if (selectedTab === DashboardTab) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedTab(DashboardTab);
      return true;
    });
    return () => sub.remove();
  }, [selectedTab, setSelectedTab]);

  const openTask = (kind: TaskKind) => (kind === 'visit' ? onOpenSiteVisits() : onOpenTickets());
  const openNotice = (action: NoticeAction) => {
    if (action === 'visits') onOpenSiteVisits();
    else if (action === 'workZone') onOpenWorkZone();
    else onOpenTickets();
  };
  const signOut = () => {
    lastSelectedTab = DashboardTab;
    onLogout();
  };
  const displayName = user.username || 'Technician';
  const role = user.user_type || user.accountType || 'Employee';
  const employeeLabel = user.employee_code
    ? user.employee_code
    : user.employeeId > 0
      ? `EMP · ${user.employeeId}`
      : null;
  const initials = displayName
    .trim()
    .split(' ')
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  const loadAttendance = useCallback(async () => {
    if (!user.employeeId) return;
    try {
      const status = await fetchAttendanceStatus(user.employeeId);
      setAttendance(status);
    } catch {
      // Keep placeholder times if status API fails
    }
  }, [user.employeeId]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const punchInTime = attendance?.inTimeStatus && attendance.inTime ? attendance.inTime : '--:--';
  const punchOutTime = attendance?.outTimeStatus && attendance.outTime ? attendance.outTime : '--:--';
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <View style={styles.topBar} accessibilityRole="header" accessibilityLabel="Aryadi Business Pvt. Ltd.">
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoFull}
            resizeMode="contain"
            accessibilityLabel="Aryadi Business Pvt. Ltd. logo"
          />
        </View>
      </SafeAreaView>

      {selectedTab === TasksTab ? (
        <MyTasksTab data={homeData} onOpen={openTask} />
      ) : selectedTab === NotificationsTabIndex ? (
        <NotificationsTab data={homeData} onAction={openNotice} onOpenSettings={() => setSelectedTab(SettingsTabIndex)} />
      ) : selectedTab === SettingsTabIndex ? (
        <SettingsTab
          user={user}
          data={homeData}
          onOpenProfile={onOpenProfile}
          onOpenWorkZone={onOpenWorkZone}
          onOpenSpeakUp={onOpenSpeakUp}
          onLogout={signOut}
        />
      ) : (
      <View style={styles.body}>
        <View
          style={[
            styles.heroWrap,
            brandShadow('0 10px 18px rgba(10, 79, 156, 0.28)', {
              shadowColor: HeroStart,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.28,
              shadowRadius: 12,
              elevation: 8,
            }),
          ]}
        >
          <LinearGradient colors={[HeroStart, HeroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.hero}>
            <FactoryBackdrop />
            <View style={styles.heroRow}>
              <View style={styles.avatar}>
                {user.photo_uri ? (
                  <Image source={{ uri: user.photo_uri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.initials}>{initials}</Text>
                )}
              </View>
              <View style={styles.heroInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <View style={[styles.statusDot, user.is_active === 1 ? styles.statusOn : styles.statusOff]} />
                </View>
                <Text style={styles.role} numberOfLines={1}>
                  {role}
                </Text>
                {user.email ? (
                  <View style={styles.emailRow}>
                    <Ionicons name="mail-outline" size={12} color="rgba(255,255,255,0.78)" />
                    <Text style={styles.email} numberOfLines={1}>
                      {user.email}
                    </Text>
                  </View>
                ) : employeeLabel ? (
                  <View style={styles.emailRow}>
                    <Ionicons name="id-card-outline" size={12} color="rgba(255,255,255,0.78)" />
                    <Text style={styles.email} numberOfLines={1}>
                      {employeeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.heroLine} />

            <View style={styles.punchRow}>
              <PunchStat icon="in" color={PunchInGreen} label="PUNCH IN" time={punchInTime} />
              <View style={styles.punchDivider} />
              <PunchStat icon="out" color={PunchOutRed} label="PUNCH OUT" time={punchOutTime} />
            </View>
          </LinearGradient>
        </View>

        <Text style={styles.sectionTitle}>Quick Access</Text>

        <View style={styles.grid}>
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.gridRow}>
              {modules.slice(row * 2, row * 2 + 2).map((item, col) => (
                <QuickTile
                  key={item.kind}
                  title={item.title}
                  subtitle={item.subtitle}
                  kind={item.kind}
                  delay={(row * 2 + col) * 80}
                  onPress={
                    item.kind === 'corporate'
                      ? onOpenTickets
                      : item.kind === 'siteVisits'
                        ? onOpenSiteVisits
                        : item.kind === 'mappedAssets'
                          ? onOpenMappedAssets
                          : item.kind === 'workZone'
                            ? onOpenWorkZone
                            : item.kind === 'speakUp'
                              ? onOpenSpeakUp
                              : item.kind === 'vendors'
                                ? onOpenVendors
                                : undefined
                  }
                />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.fabRow}>
          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
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
              <PunchOutGlyph size={20} />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
      )}

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          {tabs.map((tab, index) => {
            const active = selectedTab === index;
            return (
              <Pressable
                key={tab.label}
                onPress={() => setSelectedTab(index)}
                style={styles.tab}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
              >
                <View>
                  <Ionicons
                    name={active ? tab.icon : tab.iconOutline}
                    size={22}
                    color={active ? ActiveBlue : Brand.placeholder}
                  />
                  {index === NotificationsTabIndex && homeData.unreadCount > 0 ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{homeData.unreadCount > 99 ? '99+' : homeData.unreadCount}</Text>
                    </View>
                  ) : index === TasksTab && homeData.tasks.length > 0 ? (
                    <View style={[styles.tabBadge, styles.tabBadgeNeutral]}>
                      <Text style={styles.tabBadgeText}>{homeData.tasks.length > 99 ? '99+' : homeData.tasks.length}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

function PunchStat({
  icon,
  color,
  label,
  time,
}: {
  icon: 'in' | 'out';
  color: string;
  label: string;
  time: string;
}) {
  return (
    <View style={styles.punchStat}>
      <View style={[styles.punchIcon, { backgroundColor: color }]}>
        {icon === 'in' ? <PunchInGlyph /> : <PunchOutGlyph />}
      </View>
      <View>
        <Text style={styles.punchLabel}>{label}</Text>
        <Text style={styles.punchTime}>{time}</Text>
        <Text style={styles.punchDay}>Today</Text>
      </View>
    </View>
  );
}

function PunchInGlyph({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M11 7L9.6 8.4 12.2 11H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"
        fill={Brand.white}
      />
    </Svg>
  );
}

function PunchOutGlyph({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
        fill={Brand.white}
      />
    </Svg>
  );
}

function QuickTile({
  title,
  subtitle,
  kind,
  delay,
  onPress,
}: {
  title: string;
  subtitle: string;
  kind: IndustrialModule;
  delay: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.tile,
        pressed ? styles.tilePressed : null,
        brandShadow('0 4px 10px rgba(10, 29, 55, 0.05)', {
          shadowColor: Brand.navy,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 3,
        }),
      ]}
    >
      <IndustrialIconBadge kind={kind} delay={delay} />
      <View style={styles.tileCopy}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Brand.placeholder} />
    </Pressable>
  );
}

function FactoryBackdrop() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Rect x="62" y="38" width="9" height="62" rx="2" fill="rgba(255,255,255,0.07)" />
      <Rect x="73" y="28" width="13" height="72" rx="2" fill="rgba(255,255,255,0.07)" />
      <Rect x="88" y="42" width="9" height="58" rx="2" fill="rgba(255,255,255,0.07)" />
      <Circle cx="94" cy="16" r="18" fill="rgba(255,255,255,0.06)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  topSafe: {
    backgroundColor: Brand.white,
  },
  topBar: {
    height: 104,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFull: {
    width: 100,
    height: 88.75,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  heroWrap: {
    borderRadius: 20,
  },
  hero: {
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: HeroStart,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  heroInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    flexShrink: 1,
    color: Brand.white,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  statusOn: {
    backgroundColor: PresentGreen,
  },
  statusOff: {
    backgroundColor: '#94A3B8',
  },
  role: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  emailRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  email: {
    flex: 1,
    marginLeft: 4,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  heroLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 16,
    marginBottom: 12,
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  punchStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  punchIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  punchLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.5,
  },
  punchTime: {
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  punchDay: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  punchDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    marginLeft: 2,
    color: Brand.navy,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  grid: {
    flex: 1,
    gap: 10,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tilePressed: {
    transform: [{ scale: 0.96 }],
  },
  tileCopy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 4,
    minWidth: 0,
  },
  tileTitle: {
    color: Brand.navy,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  tileSubtitle: {
    color: Brand.placeholder,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Poppins_400Regular',
  },
  fabRow: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
  },
  fabFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSafe: {
    backgroundColor: Brand.white,
  },
  bottomBar: {
    height: 62,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    marginTop: 4,
    fontSize: 10,
    color: Brand.placeholder,
    fontFamily: 'Poppins_500Medium',
  },
  tabLabelActive: {
    color: Brand.navy,
    fontFamily: 'Poppins_600SemiBold',
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: PunchOutRed,
    borderWidth: 2,
    borderColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeNeutral: {
    backgroundColor: LogoMid,
  },
  tabBadgeText: {
    color: Brand.white,
    fontSize: 9,
    lineHeight: 11,
    fontFamily: 'Poppins_700Bold',
  },
});
