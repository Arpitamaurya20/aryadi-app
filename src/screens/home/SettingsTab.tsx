import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import appConfig from '../../../app.json';
import { playAryadiChime, stopAryadiChime } from '../../audio/alertTones';
import type { AuthUser } from '../../api/auth';
import { API_ENV, getApiBaseUrl } from '../../api/config';
import type { HomeData, NoticeCategory } from '../../hooks/useHomeData';
import { formatReminderTime, readPunchReminderTime, savePunchReminderTime } from '../../storage/punchReminder';
import { Brand } from '../../theme/colors';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const Danger = '#E11D48';

const AlertOptions: { key: NoticeCategory; icon: IconName; title: string; text: string }[] = [
  { key: 'attendance', icon: 'clock-check-outline', title: 'Attendance reminders', text: 'Punch in and punch out reminders' },
  { key: 'due', icon: 'calendar-alert', title: 'Due & overdue work', text: 'Tickets and PPM due today or late' },
  { key: 'escalation', icon: 'alert-decagram-outline', title: 'Escalations', text: 'When a ticket is escalated' },
  { key: 'visit', icon: 'map-marker-path', title: 'Site visit reminders', text: 'Unfinished observation or summary' },
];

const Hours = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const Minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type SettingsTabProps = {
  user: AuthUser;
  data: HomeData;
  onOpenProfile: () => void;
  onEditProfile: () => void;
  onOpenWorkZone: () => void;
  onOpenSpeakUp: () => void;
  onLogout: () => void;
};

export function SettingsTab({ user, data, onOpenProfile, onEditProfile, onOpenWorkZone, onOpenSpeakUp, onLogout }: SettingsTabProps) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [draftHour, setDraftHour] = useState(9);
  const [draftMinute, setDraftMinute] = useState(30);
  const [draftPeriod, setDraftPeriod] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    let active = true;
    void readPunchReminderTime(user).then((time) => {
      if (active) setReminderTime(time);
    });
    return () => {
      active = false;
      stopAryadiChime();
    };
  }, [user]);

  const openTimePicker = () => {
    const [h, m] = (reminderTime ?? '09:30').split(':').map(Number);
    setDraftHour(h % 12 === 0 ? 12 : h % 12);
    setDraftMinute(m - (m % 5));
    setDraftPeriod(h >= 12 ? 'PM' : 'AM');
    setTimePickerOpen(true);
  };

  const closeTimePicker = () => {
    setTimePickerOpen(false);
    stopAryadiChime();
  };

  const saveReminder = (time: string | null) => {
    setReminderTime(time);
    void savePunchReminderTime(user, time);
    closeTimePicker();
  };

  const draftTime = `${String((draftHour % 12) + (draftPeriod === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(draftMinute).padStart(2, '0')}`;

  const displayName = user.username || user.loginName || 'Employee';
  const role = user.user_type || user.accountType || 'Employee';
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');
  const employeeCode = user.employee_code || (user.employeeId > 0 ? `EMP-${user.employeeId}` : '');

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Manage your account and app preferences</Text>

      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profile}>
        <View style={styles.glow} />
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            {user.photo_uri ? <Image source={{ uri: user.photo_uri }} style={styles.avatarImage} /> : <Text style={styles.initials}>{initials || 'U'}</Text>}
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.profileRole} numberOfLines={1}>
              {role}
            </Text>
            <View style={styles.profileTags}>
              {employeeCode ? <Tag icon="card-account-details-outline" label={employeeCode} /> : null}
              {user.department ? <Tag icon="office-building-outline" label={user.department} /> : null}
            </View>
          </View>
        </View>
        <Pressable onPress={onOpenProfile} style={styles.profileBtn} accessibilityRole="button" accessibilityLabel="View profile">
          <Text style={styles.profileBtnText}>View full profile</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={Navy} />
        </Pressable>
      </LinearGradient>

      <Group title="Account">
        <Row icon="account-edit-outline" title="Edit Profile" text="Update your contact information" onPress={onEditProfile} />
        <Row icon="briefcase-clock-outline" title="Attendance & Leave" text="Punch in, leave, WFH and conveyance" onPress={onOpenWorkZone} divider />
      </Group>

      <Group title="Alerts" hint="Choose what shows in Notifications">
        {AlertOptions.map((option, index) => (
          <Fragment key={option.key}>
            <View style={[styles.row, index > 0 && styles.rowDivider]}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={option.icon} size={20} color={Sky} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{option.title}</Text>
                <Text style={styles.rowSub}>{option.text}</Text>
              </View>
              <Switch
                value={data.prefs[option.key]}
                onValueChange={(value) => data.setPref(option.key, value)}
                trackColor={{ false: '#D5DEE9', true: '#9CCBF3' }}
                thumbColor={data.prefs[option.key] ? Sky : '#F8FAFC'}
                accessibilityLabel={option.title}
              />
            </View>
            {option.key === 'attendance' && data.prefs.attendance ? (
              <Pressable
                onPress={openTimePicker}
                style={({ pressed }) => [styles.reminderRow, pressed && { backgroundColor: '#EAF3FD' }]}
                accessibilityRole="button"
                accessibilityLabel={reminderTime ? `Punch-in reminder at ${formatReminderTime(reminderTime)}` : 'Set punch-in reminder time'}
              >
                <MaterialCommunityIcons name="alarm" size={18} color={Sky} />
                <View style={styles.rowText}>
                  <Text style={styles.reminderTitle}>Punch-in reminder</Text>
                  <Text style={styles.rowSub}>{reminderTime ? 'Rings Aryadi Chime if not punched in' : 'Set a time to ring Aryadi Chime'}</Text>
                </View>
                <View style={[styles.timeChip, !reminderTime && styles.timeChipEmpty]}>
                  <Text style={[styles.timeChipText, !reminderTime && { color: Sky }]}>{reminderTime ? formatReminderTime(reminderTime) : 'Set time'}</Text>
                </View>
              </Pressable>
            ) : null}
          </Fragment>
        ))}
      </Group>

      <Group title="Help & Support">
        <Row icon="message-alert-outline" title="Speak Up" text="Raise a concern or get help" onPress={onOpenSpeakUp} />
      </Group>

      <Group title="About">
        <InfoRow icon="information-outline" label="App version" value={`${appConfig.expo.name} v${appConfig.expo.version}`} />
        <InfoRow
          icon="server-network"
          label="Server"
          value={`${API_ENV === 'live' ? 'Live' : 'Local'} · ${getApiBaseUrl().replace(/^https?:\/\//, '')}`}
          divider
        />
        <InfoRow icon="account-key-outline" label="Signed in as" value={user.loginName || displayName} divider />
      </Group>

      <Pressable
        onPress={() => setConfirmLogout(true)}
        style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <MaterialCommunityIcons name="logout" size={20} color={Danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>

      <Modal visible={timePickerOpen} transparent animationType="slide" onRequestClose={closeTimePicker}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTimePicker} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View style={styles.sheetHeadIcon}>
                <MaterialCommunityIcons name="alarm" size={22} color={Brand.white} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.sheetTitle}>Punch-in reminder</Text>
                <Text style={styles.sheetSub}>Aryadi Chime rings at this time if you haven't punched in</Text>
              </View>
              <Pressable onPress={closeTimePicker} hitSlop={10} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={20} color={Slate} />
              </Pressable>
            </View>

            <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent} showsVerticalScrollIndicator={false}>
              <View style={styles.timePreview}>
                <Text style={styles.timePreviewText}>{formatReminderTime(draftTime)}</Text>
                <View style={styles.periodToggle}>
                  {(['AM', 'PM'] as const).map((period) => (
                    <Pressable
                      key={period}
                      onPress={() => setDraftPeriod(period)}
                      style={[styles.periodBtn, draftPeriod === period && styles.periodBtnOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: draftPeriod === period }}
                    >
                      <Text style={[styles.periodText, draftPeriod === period && styles.periodTextOn]}>{period}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Text style={styles.pickLabel}>Hour</Text>
              <View style={styles.pickGrid}>
                {Hours.map((hour) => (
                  <Pressable
                    key={hour}
                    onPress={() => setDraftHour(hour)}
                    style={[styles.pickChip, draftHour === hour && styles.pickChipOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draftHour === hour }}
                    accessibilityLabel={`${hour} o'clock`}
                  >
                    <Text style={[styles.pickText, draftHour === hour && styles.pickTextOn]}>{hour}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.pickLabel}>Minute</Text>
              <View style={styles.pickGrid}>
                {Minutes.map((minute) => (
                  <Pressable
                    key={minute}
                    onPress={() => setDraftMinute(minute)}
                    style={[styles.pickChip, draftMinute === minute && styles.pickChipOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draftMinute === minute }}
                    accessibilityLabel={`${minute} minutes`}
                  >
                    <Text style={[styles.pickText, draftMinute === minute && styles.pickTextOn]}>{String(minute).padStart(2, '0')}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={playAryadiChime}
                style={({ pressed }) => [styles.testSound, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel="Play Aryadi Chime"
              >
                <MaterialCommunityIcons name="volume-high" size={18} color={Sky} />
                <Text style={styles.testSoundText}>Test sound · Aryadi Chime</Text>
              </Pressable>
            </ScrollView>

            <Pressable
              onPress={() => saveReminder(draftTime)}
              style={({ pressed }) => [styles.sheetDone, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetDoneFill}>
                <MaterialCommunityIcons name="check" size={18} color={Brand.white} />
                <Text style={styles.sheetDoneText}>Set reminder for {formatReminderTime(draftTime)}</Text>
              </LinearGradient>
            </Pressable>
            {reminderTime ? (
              <Pressable onPress={() => saveReminder(null)} style={styles.turnOff} accessibilityRole="button">
                <Text style={styles.turnOffText}>Turn off reminder</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <MaterialCommunityIcons name="logout" size={26} color={Danger} />
            </View>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalText}>You will need to sign in again to use the app.</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirmLogout(false)} style={[styles.modalBtn, styles.modalCancel]} accessibilityRole="button">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmLogout(false);
                  onLogout();
                }}
                style={[styles.modalBtn, styles.modalConfirm]}
                accessibilityRole="button"
              >
                <Text style={styles.modalConfirmText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Tag({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.tag}>
      <MaterialCommunityIcons name={icon} size={12} color={Brand.white} />
      <Text style={styles.tagText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text style={styles.groupTitle}>{title}</Text>
        {hint ? <Text style={styles.groupHint}>{hint}</Text> : null}
      </View>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function Row({ icon, title, text, onPress, divider = false }: { icon: IconName; title: string; text: string; onPress: () => void; divider?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && { backgroundColor: '#F1F6FC' }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={Sky} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{text}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={Muted} />
    </Pressable>
  );
}

function InfoRow({ icon, label, value, divider = false }: { icon: IconName; label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.rowDivider]}>
      <View style={[styles.rowIcon, { backgroundColor: '#F1F5F9' }]}>
        <MaterialCommunityIcons name={icon} size={19} color={Slate} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  title: { color: Ink, fontSize: 20, fontFamily: 'Poppins_700Bold' },
  subtitle: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: -2 },
  profile: { marginTop: 14, borderRadius: 22, padding: 16, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -70,
    right: -50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarImage: { width: '100%', height: '100%' },
  initials: { color: Navy, fontSize: 20, fontFamily: 'Poppins_700Bold' },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { color: Brand.white, fontSize: 17, fontFamily: 'Poppins_700Bold' },
  profileRole: { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, fontFamily: 'Poppins_500Medium', marginTop: -2 },
  profileTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 170,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tagText: { color: Brand.white, fontSize: 11, fontFamily: 'Poppins_500Medium' },
  profileBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    backgroundColor: Brand.white,
  },
  profileBtnText: { color: Navy, fontSize: 13.5, fontFamily: 'Poppins_600SemiBold' },
  group: { marginTop: 18 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, marginHorizontal: 2 },
  groupTitle: { color: Navy, fontSize: 13, letterSpacing: 0.6, fontFamily: 'Poppins_700Bold', textTransform: 'uppercase' },
  groupHint: { color: Muted, fontSize: 11, fontFamily: 'Poppins_500Medium' },
  groupCard: { backgroundColor: Brand.white, borderRadius: 18, borderWidth: 1, borderColor: Line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#EEF2F8' },
  rowIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#E8F3FD', alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: Ink, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  rowSub: { color: Slate, fontSize: 11.5, fontFamily: 'Poppins_400Regular', marginTop: -1 },
  infoLabel: { color: Slate, fontSize: 13, fontFamily: 'Poppins_500Medium' },
  infoValue: { flex: 1, textAlign: 'right', color: Ink, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  logout: {
    marginTop: 20,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  logoutText: { color: Danger, fontSize: 15, fontFamily: 'Poppins_700Bold' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: Brand.white, borderRadius: 22, padding: 22, alignItems: 'center' },
  modalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { marginTop: 12, color: Ink, fontSize: 18, fontFamily: 'Poppins_700Bold' },
  modalText: { marginTop: 4, color: Slate, fontSize: 13, textAlign: 'center', fontFamily: 'Poppins_400Regular' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
  modalBtn: { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  modalCancel: { backgroundColor: '#F1F5F9' },
  modalCancelText: { color: '#334155', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  modalConfirm: { backgroundColor: Danger },
  modalConfirmText: { color: Brand.white, fontSize: 14, fontFamily: 'Poppins_700Bold' },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: -2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F2F8FE',
    borderWidth: 1,
    borderColor: '#D6E8FA',
  },
  reminderTitle: { color: Navy, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  timeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: Sky },
  timeChipEmpty: { backgroundColor: Brand.white, borderWidth: 1, borderColor: '#9CCBF3' },
  timeChipText: { color: Brand.white, fontSize: 13, fontFamily: 'Poppins_700Bold' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: Brand.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
  },
  sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#D5DEE9', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  sheetHeadIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: Sky, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { color: Ink, fontSize: 17, fontFamily: 'Poppins_700Bold' },
  sheetSub: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: -2 },
  sheetClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  sheetList: { flexGrow: 0 },
  sheetListContent: { gap: 8, paddingVertical: 4 },
  timePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#F2F8FE',
    borderWidth: 1,
    borderColor: '#D6E8FA',
  },
  timePreviewText: { color: Navy, fontSize: 30, lineHeight: 38, fontFamily: 'Poppins_700Bold' },
  periodToggle: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: Brand.white, borderWidth: 1, borderColor: Line },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  periodBtnOn: { backgroundColor: Sky },
  periodText: { color: Slate, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  periodTextOn: { color: Brand.white },
  pickLabel: { marginTop: 6, color: Navy, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: 'Poppins_700Bold' },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickChip: {
    flexBasis: '14%',
    flexGrow: 1,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: Brand.white,
  },
  pickChipOn: { backgroundColor: Sky, borderColor: Sky },
  pickText: { color: Ink, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  pickTextOn: { color: Brand.white },
  testSound: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9CCBF3',
    backgroundColor: '#F2F8FE',
  },
  testSoundText: { color: Sky, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  turnOff: { marginTop: 6, height: 40, alignItems: 'center', justifyContent: 'center' },
  turnOffText: { color: Danger, fontSize: 13.5, fontFamily: 'Poppins_600SemiBold' },
  sheetDone: { marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  sheetDoneFill: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sheetDoneText: { color: Brand.white, fontSize: 15, fontFamily: 'Poppins_700Bold' },
});
