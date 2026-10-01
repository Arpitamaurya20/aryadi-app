import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HomeData, Notice, NoticeAction, NoticeTone } from '../../hooks/useHomeData';
import { Brand } from '../../theme/colors';
import { StateCard } from './MyTasksTab';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const Ink = '#0F172A';
const Slate = '#64748B';
const Line = '#E6ECF4';

const ToneMeta: Record<NoticeTone, { color: string; bg: string }> = {
  danger: { color: '#DC2626', bg: '#FEF2F2' },
  warning: { color: '#B45309', bg: '#FFFBEB' },
  info: { color: Sky, bg: '#EEF6FE' },
};

const ActionLabel: Record<NoticeAction, string> = {
  tickets: 'Open tickets',
  visits: 'Open site visits',
  workZone: 'Open Work Zone',
};

type NotificationsTabProps = {
  data: HomeData;
  onAction: (action: NoticeAction) => void;
  onOpenSettings: () => void;
};

export function NotificationsTab({ data, onAction, onOpenSettings }: NotificationsTabProps) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { notices, readSet } = data;

  const visible = useMemo(
    () => (unreadOnly ? notices.filter((notice) => !readSet.has(notice.id)) : notices),
    [notices, readSet, unreadOnly],
  );
  const urgent = visible.filter((notice) => notice.tone === 'danger' || notice.category === 'attendance');
  const reminders = visible.filter((notice) => !(notice.tone === 'danger' || notice.category === 'attendance'));
  const allOff = !Object.values(data.prefs).some(Boolean);

  const open = (notice: Notice) => {
    data.markRead(notice.id);
    onAction(notice.action);
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} colors={[Sky]} tintColor={Sky} />}
    >
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {data.unreadCount > 0 ? `${data.unreadCount} unread alert${data.unreadCount === 1 ? '' : 's'}` : 'You have read everything'}
          </Text>
        </View>
        <Pressable
          onPress={data.markAllRead}
          disabled={data.unreadCount === 0}
          style={[styles.markBtn, data.unreadCount === 0 && { opacity: 0.45 }]}
          accessibilityRole="button"
          accessibilityLabel="Mark all as read"
        >
          <MaterialCommunityIcons name="check-all" size={16} color={Sky} />
          <Text style={styles.markText}>Mark all read</Text>
        </Pressable>
      </View>

      <View style={styles.segment}>
        {[
          { key: false, label: `All (${notices.length})` },
          { key: true, label: `Unread (${data.unreadCount})` },
        ].map((item) => {
          const active = unreadOnly === item.key;
          return (
            <Pressable
              key={item.label}
              onPress={() => setUnreadOnly(item.key)}
              style={[styles.segmentBtn, active && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextOn]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {data.loading ? (
        [0, 1, 2].map((item) => <View key={item} style={styles.skeleton} />)
      ) : allOff ? (
        <StateCard
          icon="bell-off-outline"
          title="Alerts are turned off"
          text="Turn on the alerts you want to receive in Settings."
          actionLabel="Open Settings"
          onAction={onOpenSettings}
        />
      ) : visible.length === 0 ? (
        <StateCard
          icon="bell-check-outline"
          title={unreadOnly ? 'No unread alerts' : 'No alerts right now'}
          text={
            data.error
              ? `Some alerts may be missing: ${data.error}`
              : 'We will let you know about overdue work, escalations, attendance and site visits.'
          }
          actionLabel={data.error ? 'Try again' : undefined}
          onAction={data.error ? data.refresh : undefined}
        />
      ) : (
        <>
          {urgent.length ? <Section title="Action needed" count={urgent.length} notices={urgent} data={data} onOpen={open} /> : null}
          {reminders.length ? <Section title="Reminders" count={reminders.length} notices={reminders} data={data} onOpen={open} /> : null}
        </>
      )}
    </ScrollView>
  );
}

function Section({
  title,
  count,
  notices,
  data,
  onOpen,
}: {
  title: string;
  count: number;
  notices: Notice[];
  data: HomeData;
  onOpen: (notice: Notice) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      <View style={styles.sectionCard}>
        {notices.map((notice, index) => {
          const tone = ToneMeta[notice.tone];
          const unread = !data.readSet.has(notice.id);
          return (
            <Pressable
              key={notice.id}
              onPress={() => onOpen(notice)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivider,
                unread && styles.rowUnread,
                pressed && { backgroundColor: '#F1F6FC' },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${unread ? 'Unread. ' : ''}${notice.title}. ${notice.body}`}
            >
              <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                <MaterialCommunityIcons name={notice.icon} size={20} color={tone.color} />
              </View>
              <View style={styles.rowText}>
                <View style={styles.rowTitleLine}>
                  <Text style={[styles.rowTitle, unread && styles.rowTitleUnread]} numberOfLines={2}>
                    {notice.title}
                  </Text>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.rowBody} numberOfLines={3}>
                  {notice.body}
                </Text>
                <View style={styles.rowAction}>
                  <Text style={[styles.rowActionText, { color: tone.color }]}>{ActionLabel[notice.action]}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color={tone.color} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: Ink, fontSize: 20, fontFamily: 'Poppins_700Bold' },
  subtitle: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: -2 },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#E8F3FD',
  },
  markText: { color: Sky, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  segment: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 14,
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#E9EEF5',
  },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 11 },
  segmentOn: { backgroundColor: Brand.white },
  segmentText: { color: Slate, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  segmentTextOn: { color: Navy },
  skeleton: { height: 86, borderRadius: 16, backgroundColor: '#E9EEF5', marginBottom: 10 },
  section: { marginBottom: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginLeft: 2 },
  sectionTitle: { color: Navy, fontSize: 13, letterSpacing: 0.6, fontFamily: 'Poppins_700Bold', textTransform: 'uppercase' },
  sectionCount: {
    color: Slate,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    backgroundColor: '#E9EEF5',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sectionCard: { backgroundColor: Brand.white, borderRadius: 18, borderWidth: 1, borderColor: Line, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, padding: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#EEF2F8' },
  rowUnread: { backgroundColor: '#F7FBFF' },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { flex: 1, color: '#334155', fontSize: 13.5, lineHeight: 19, fontFamily: 'Poppins_500Medium' },
  rowTitleUnread: { color: Ink, fontFamily: 'Poppins_700Bold' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Sky, marginTop: 6 },
  rowBody: { marginTop: 2, color: Slate, fontSize: 12.5, lineHeight: 18, fontFamily: 'Poppins_400Regular' },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  rowActionText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
});
