import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BackHandler, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { formatApiDate, type AuthUser } from '../api/auth';
import { fetchEmployeeProfile } from '../api/profile';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#F4F8FC';
const ActiveGreen = '#22C55E';
const SoftBlue = '#E8F4FD';

type InfoRow = {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type MyProfileScreenProps = {
  user: AuthUser;
  onBack: () => void;
  onEditProfile: () => void;
  onHome: () => void;
  onOpenTickets: () => void;
  onUpdateUser: (user: AuthUser) => void;
};

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

export function MyProfileScreen({
  user,
  onBack,
  onEditProfile,
  onHome,
  onOpenTickets,
  onUpdateUser,
}: MyProfileScreenProps) {
  const initials =
    user.username
      .trim()
      .split(' ')
      .map((part) => part[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join('') || 'AB';

  const memberSince = formatApiDate(user.createdDate) || '—';

  const rows: InfoRow[] = [
    { label: 'Name', value: displayValue(user.username), icon: 'account-outline' },
    { label: 'Email', value: displayValue(user.email), icon: 'email-outline' },
    { label: 'Phone Number', value: displayValue(user.phone), icon: 'phone-outline' },
    { label: 'Employee Number', value: displayValue(user.employee_code), icon: 'badge-account-horizontal-outline' },
    { label: 'UAN Number', value: displayValue(user.uan), icon: 'card-account-details-outline' },
    { label: 'Bank Account Name', value: displayValue(user.bank_account_name), icon: 'bank-outline' },
    { label: 'Bank Account Number', value: displayValue(user.bank_account_number), icon: 'credit-card-outline' },
    { label: 'PAN Number', value: displayValue(user.pan), icon: 'file-document-outline' },
    { label: 'Aadhaar Number', value: displayValue(user.aadhaar), icon: 'card-account-details-outline' },
  ];

  const profileFields = [
    user.username,
    user.email,
    user.phone,
    user.employee_code,
    user.uan,
    user.bank_account_name,
    user.bank_account_number,
    user.pan,
    user.aadhaar,
  ];
  const filledCount = profileFields.filter((value) => Boolean(value && String(value).trim())).length;
  const completed = Math.round((filledCount / profileFields.length) * 100);
  const isActive = user.is_active === 1;
  const [headerHeight, setHeaderHeight] = useState(52);
  const [cardHeight, setCardHeight] = useState(88);
  const blueHeight = headerHeight + 6 + cardHeight / 2;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const enriched = await fetchEmployeeProfile(user);
        if (!cancelled) onUpdateUser(enriched);
      } catch {
        // Keep existing login data if profile API fails
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.employeeId]);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    onUpdateUser({ ...user, photo_uri: result.assets[0].uri });
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#082A5C', '#0B4F9E', '#1E8BE0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroBg, { height: blueHeight }]}
      />

      <SafeAreaView
        edges={['top']}
        style={styles.headerSafe}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={24} color={Brand.white} />
          </Pressable>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Pressable style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="More">
            <MaterialCommunityIcons name="dots-vertical" size={22} color={Brand.white} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <View
          style={[
            styles.profileCard,
            brandShadow('0 12px 24px rgba(11, 53, 110, 0.12)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 8,
            }),
          ]}
          onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
        >
          <Svg pointerEvents="none" style={styles.blob} width="180" height="120" viewBox="0 0 180 120">
            <Path
              d="M70 0 C120 10 180 20 180 70 C180 110 130 120 90 110 C40 98 20 70 18 40 C16 12 40 0 70 0 Z"
              fill="rgba(58,171,242,0.16)"
            />
            <Path
              d="M110 20 C150 28 180 48 180 82 C180 112 150 120 118 112 C86 104 78 78 84 52 C90 28 98 16 110 20 Z"
              fill="rgba(30,139,224,0.12)"
            />
          </Svg>

          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                {user.photo_uri ? (
                  <Image source={{ uri: user.photo_uri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.initials}>{initials}</Text>
                )}
              </View>
              <Pressable
                onPress={pickPhoto}
                style={styles.cameraBadge}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <MaterialIcons name="photo-camera" size={13} color={Brand.white} />
              </Pressable>
            </View>

            <View style={styles.profileCopy}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user.username}
              </Text>
              <Text style={styles.profileRole} numberOfLines={1}>
                {user.user_type || 'Technician'}
              </Text>
              <View style={styles.activePill}>
                <View style={[styles.dot, { backgroundColor: isActive ? ActiveGreen : '#94A3B8' }]} />
                <Text style={[styles.activeText, { color: isActive ? '#16A34A' : Brand.placeholder }]}>
                  {isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statInner}>
              <View style={styles.statIcon}>
                <MaterialCommunityIcons name="account-outline" size={18} color={LogoMid} />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>Profile Completed</Text>
                <Text style={styles.statPercent}>{completed}%</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completed}%` }]} />
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statInner}>
              <View style={[styles.statIcon, styles.statIconGreen]}>
                <MaterialCommunityIcons name="shield-check-outline" size={18} color={ActiveGreen} />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>Account Status</Text>
                <View style={styles.statusLine}>
                  <View style={[styles.dot, { backgroundColor: isActive ? ActiveGreen : '#94A3B8' }]} />
                  <Text style={[styles.statStatus, { color: isActive ? ActiveGreen : Brand.placeholder }]}>
                    {isActive ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statInner}>
              <View style={styles.statIcon}>
                <MaterialCommunityIcons name="calendar-month-outline" size={18} color={LogoMid} />
              </View>
              <View style={styles.statCopy}>
                <Text style={styles.statLabel}>Member Since</Text>
                <Text style={styles.statDate}>{memberSince}</Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.infoCard,
            brandShadow('0 10px 18px rgba(11, 53, 110, 0.06)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.06,
              shadowRadius: 10,
              elevation: 4,
            }),
          ]}
        >
          <View style={styles.infoHead}>
            <MaterialCommunityIcons name="account-outline" size={18} color={LogoNavy} />
            <Text style={styles.infoTitle}>Personal Information</Text>
            <Pressable
              onPress={onEditProfile}
              style={styles.infoEditWrap}
              accessibilityRole="button"
              accessibilityLabel="Edit personal information"
              hitSlop={8}
            >
              <MaterialCommunityIcons name="pencil-outline" size={14} color={LogoMid} />
              <Text style={styles.infoEdit}>Edit</Text>
            </Pressable>
          </View>

          {rows.map((row, index) => (
            <View key={row.label} style={styles.infoRowWrap}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <MaterialCommunityIcons name={row.icon} size={16} color={LogoMid} />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {row.value}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          <TabButton icon="home-outline" label="Home" onPress={onHome} />
          <TabButton icon="calendar-outline" label="Tickets" onPress={onOpenTickets} />
          <TabButton icon="notifications-outline" label="Notifications" badge={3} />
          <TabButton icon="person" label="Profile" active />
        </View>
      </SafeAreaView>
    </View>
  );
}

function TabButton({
  icon,
  label,
  active,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  badge?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tab} accessibilityRole="button" accessibilityLabel={label}>
      <View>
        <Ionicons name={icon} size={22} color={active ? LogoMid : '#9AADC2'} />
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
      {active ? <View style={styles.tabLine} /> : <View style={styles.tabLineSpacer} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerSafe: {
    zIndex: 2,
  },
  header: {
    height: 46,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 4,
    color: Brand.white,
    fontSize: 20,
    fontFamily: 'Poppins_600SemiBold',
  },
  body: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  profileCard: {
    borderRadius: 22,
    backgroundColor: Brand.white,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  blob: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 64,
    height: 64,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: SoftBlue,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Brand.white,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  initials: {
    color: LogoNavy,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#123A6B',
    borderWidth: 2,
    borderColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    minWidth: 0,
  },
  profileName: {
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  profileRole: {
    marginTop: 1,
    color: '#7B8FA8',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  activePill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F8ED',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  activeText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  statsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  statInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  statIconGreen: {
    backgroundColor: '#E7F8ED',
  },
  statCopy: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    color: '#8AA0B5',
    fontSize: 9,
    lineHeight: 12,
    fontFamily: 'Poppins_500Medium',
  },
  statPercent: {
    marginTop: 1,
    color: LogoMid,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  statStatus: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  statDate: {
    marginTop: 1,
    color: LogoNavy,
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },
  progressTrack: {
    marginTop: 8,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#E4EEF7',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: LogoMid,
  },
  statusLine: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCard: {
    flex: 1,
    marginTop: 8,
    backgroundColor: Brand.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  infoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoTitle: {
    flex: 1,
    marginLeft: 8,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  infoEditWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoEdit: {
    marginLeft: 4,
    color: LogoMid,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  infoRowWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF3F8',
    marginLeft: 44,
  },
  infoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
    minWidth: 0,
  },
  infoLabel: {
    color: '#8AA0B5',
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
  },
  infoValue: {
    color: LogoNavy,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  bottomSafe: {
    backgroundColor: Brand.white,
  },
  bottomBar: {
    height: 58,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Brand.white,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  tabLabel: {
    marginTop: 3,
    fontSize: 11,
    color: '#9AADC2',
    fontFamily: 'Poppins_500Medium',
  },
  tabLabelActive: {
    color: LogoMid,
    fontFamily: 'Poppins_600SemiBold',
  },
  tabLine: {
    marginTop: 6,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: LogoMid,
  },
  tabLineSpacer: {
    marginTop: 6,
    height: 3,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Brand.white,
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
  },
});
