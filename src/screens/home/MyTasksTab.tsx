import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { dueLabel, type HomeData, type MyTask, type TaskKind } from '../../hooks/useHomeData';
import { Brand } from '../../theme/colors';
import { brandShadow } from '../../theme/shadow';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';

type KindFilter = 'all' | TaskKind;
type UrgencyFilter = 'all' | 'overdue' | 'today' | 'escalated';

const KindMeta: Record<TaskKind, { label: string; icon: IconName; color: string; bg: string }> = {
  ticket: { label: 'Tickets', icon: 'ticket-confirmation-outline', color: Sky, bg: '#E8F3FD' },
  ppm: { label: 'PPM', icon: 'wrench-clock', color: '#7C3AED', bg: '#F1EBFE' },
  visit: { label: 'Site Visits', icon: 'map-marker-radius-outline', color: '#0E9F6E', bg: '#E3F8EF' },
};

function urgencyTone(task: MyTask) {
  if (task.urgency === 'overdue') return { color: '#DC2626', bg: '#FEF2F2' };
  if (task.escalated) return { color: '#C2410C', bg: '#FFF7ED' };
  if (task.urgency === 'today') return { color: '#B45309', bg: '#FFFBEB' };
  if (task.urgency === 'soon') return { color: Sky, bg: '#EEF6FE' };
  return { color: Slate, bg: '#F1F5F9' };
}

type MyTasksTabProps = {
  data: HomeData;
  onOpen: (kind: TaskKind) => void;
};

export function MyTasksTab({ data, onOpen }: MyTasksTabProps) {
  const [kind, setKind] = useState<KindFilter>('all');
  const [urgency, setUrgency] = useState<UrgencyFilter>('all');
  const { tasks } = data;

  const stats = useMemo(
    () => ({
      total: tasks.length,
      overdue: tasks.filter((task) => task.urgency === 'overdue').length,
      today: tasks.filter((task) => task.urgency === 'today').length,
      escalated: tasks.filter((task) => task.escalated).length,
    }),
    [tasks],
  );

  const visible = useMemo(
    () =>
      tasks.filter((task) => {
        if (kind !== 'all' && task.kind !== kind) return false;
        if (urgency === 'overdue') return task.urgency === 'overdue';
        if (urgency === 'today') return task.urgency === 'today';
        if (urgency === 'escalated') return task.escalated;
        return true;
      }),
    [kind, tasks, urgency],
  );

  const kindCount = (value: KindFilter) => (value === 'all' ? tasks.length : tasks.filter((task) => task.kind === value).length);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} colors={[Sky]} tintColor={Sky} />}
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>My Tasks</Text>
          <Text style={styles.subtitle}>
            {data.updatedAt ? `Updated ${data.updatedAt.toTimeString().slice(0, 5)}` : 'Your open work in one place'}
          </Text>
        </View>
        <Pressable
          onPress={data.refresh}
          disabled={data.refreshing}
          style={styles.refreshBtn}
          accessibilityRole="button"
          accessibilityLabel="Refresh tasks"
        >
          {data.refreshing ? <ActivityIndicator size="small" color={Sky} /> : <MaterialCommunityIcons name="refresh" size={20} color={Sky} />}
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Open" value={stats.total} icon="clipboard-list-outline" color={Navy} active={urgency === 'all'} onPress={() => setUrgency('all')} />
        <StatCard label="Overdue" value={stats.overdue} icon="calendar-alert" color="#DC2626" active={urgency === 'overdue'} onPress={() => setUrgency('overdue')} />
        <StatCard label="Today" value={stats.today} icon="calendar-today" color="#B45309" active={urgency === 'today'} onPress={() => setUrgency('today')} />
        <StatCard label="Escalated" value={stats.escalated} icon="alert-decagram-outline" color="#C2410C" active={urgency === 'escalated'} onPress={() => setUrgency('escalated')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {(['all', 'ticket', 'ppm', 'visit'] as KindFilter[]).map((value) => {
          const active = kind === value;
          return (
            <Pressable
              key={value}
              onPress={() => setKind(value)}
              style={[styles.chip, active && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextOn]}>
                {value === 'all' ? 'All' : KindMeta[value].label}
              </Text>
              <View style={[styles.chipCount, active && styles.chipCountOn]}>
                <Text style={[styles.chipCountText, active && styles.chipCountTextOn]}>{kindCount(value)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {data.warning ? (
        <View style={styles.warning}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#B45309" />
          <Text style={styles.warningText}>{data.warning}</Text>
        </View>
      ) : null}

      {data.loading ? (
        [0, 1, 2].map((item) => <View key={item} style={styles.skeleton} />)
      ) : data.error ? (
        <StateCard icon="cloud-alert-outline" title="Couldn't load tasks" text={data.error} actionLabel="Try again" onAction={data.refresh} />
      ) : visible.length === 0 ? (
        <StateCard
          icon="check-decagram-outline"
          title={tasks.length === 0 ? "You're all caught up" : 'Nothing matches this filter'}
          text={tasks.length === 0 ? 'No open tickets, PPM work or site visits right now.' : 'Try a different filter to see more tasks.'}
          actionLabel={tasks.length === 0 ? undefined : 'Clear filters'}
          onAction={
            tasks.length === 0
              ? undefined
              : () => {
                  setKind('all');
                  setUrgency('all');
                }
          }
        />
      ) : (
        visible.map((task) => <TaskCard key={task.key} task={task} onPress={() => onOpen(task.kind)} />)
      )}
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  active,
  onPress,
}: {
  label: string;
  value: number;
  icon: IconName;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.stat, active && { borderColor: color, backgroundColor: '#FFFFFF' }]}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      accessibilityState={{ selected: active }}
    >
      <MaterialCommunityIcons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function TaskCard({ task, onPress }: { task: MyTask; onPress: () => void }) {
  const meta = KindMeta[task.kind];
  const tone = urgencyTone(task);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.code} ${task.title}. ${dueLabel(task)}`}
      style={({ pressed }) => [styles.card, cardShadow, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      <View style={[styles.stripe, { backgroundColor: tone.color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={[styles.kindIcon, { backgroundColor: meta.bg }]}>
            <MaterialCommunityIcons name={meta.icon} size={18} color={meta.color} />
          </View>
          <View style={styles.cardHead}>
            <Text style={styles.code} numberOfLines={1}>
              {task.code}
            </Text>
            <Text style={[styles.typeLabel, { color: meta.color }]} numberOfLines={1}>
              {task.typeLabel}
            </Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText} numberOfLines={1}>
              {task.status}
            </Text>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {task.title}
        </Text>
        {task.subtitle ? (
          <View style={styles.placeRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={13} color={Muted} />
            <Text style={styles.place} numberOfLines={1}>
              {task.subtitle}
            </Text>
          </View>
        ) : null}
        <View style={styles.cardFoot}>
          <View style={[styles.duePill, { backgroundColor: tone.bg }]}>
            <MaterialCommunityIcons
              name={task.urgency === 'overdue' ? 'calendar-alert' : task.kind === 'visit' ? 'progress-clock' : 'calendar-blank-outline'}
              size={13}
              color={tone.color}
            />
            <Text style={[styles.dueText, { color: tone.color }]}>{dueLabel(task)}</Text>
          </View>
          {task.escalated ? (
            <View style={styles.escalated}>
              <MaterialCommunityIcons name="alert-decagram-outline" size={13} color="#C2410C" />
              <Text style={styles.escalatedText}>Escalated</Text>
            </View>
          ) : null}
          <MaterialCommunityIcons name="chevron-right" size={20} color={Muted} style={styles.chevron} />
        </View>
      </View>
    </Pressable>
  );
}

export function StateCard({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <MaterialCommunityIcons name={icon} size={30} color={Sky} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.stateBtn} accessibilityRole="button">
          <Text style={styles.stateBtnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const cardShadow = brandShadow('0 6px 16px rgba(11, 53, 110, 0.06)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Ink, fontSize: 20, fontFamily: 'Poppins_700Bold' },
  subtitle: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: -2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F3FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Line,
    backgroundColor: '#FAFCFE',
  },
  statValue: { marginTop: 2, fontSize: 18, fontFamily: 'Poppins_700Bold' },
  statLabel: { color: Slate, fontSize: 10.5, fontFamily: 'Poppins_500Medium', marginTop: -2 },
  chips: { gap: 8, paddingVertical: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: Brand.white,
  },
  chipOn: { backgroundColor: Navy, borderColor: Navy },
  chipText: { color: Slate, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  chipTextOn: { color: Brand.white },
  chipCount: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: '#EEF2F7', alignItems: 'center', justifyContent: 'center' },
  chipCountOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  chipCountText: { color: Slate, fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  chipCountTextOn: { color: Brand.white },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  warningText: { flex: 1, color: '#92400E', fontSize: 12, fontFamily: 'Poppins_500Medium' },
  skeleton: { height: 118, borderRadius: 18, backgroundColor: '#E9EEF5', marginBottom: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Line,
    marginBottom: 12,
    overflow: 'hidden',
  },
  stripe: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardHead: { flex: 1, minWidth: 0 },
  code: { color: Ink, fontSize: 13.5, fontFamily: 'Poppins_700Bold' },
  typeLabel: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', marginTop: -2 },
  statusPill: { maxWidth: '40%', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#F1F5F9' },
  statusText: { color: '#334155', fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  cardTitle: { marginTop: 10, color: Ink, fontSize: 14.5, lineHeight: 20, fontFamily: 'Poppins_600SemiBold' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  place: { flex: 1, color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  duePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  dueText: { fontSize: 11.5, fontFamily: 'Poppins_600SemiBold' },
  escalated: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: '#FFF7ED' },
  escalatedText: { color: '#C2410C', fontSize: 11.5, fontFamily: 'Poppins_600SemiBold' },
  chevron: { marginLeft: 'auto' },
  state: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Line,
  },
  stateIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8F3FD', alignItems: 'center', justifyContent: 'center' },
  stateTitle: { marginTop: 12, color: Ink, fontSize: 16, fontFamily: 'Poppins_700Bold', textAlign: 'center' },
  stateText: { marginTop: 4, color: Slate, fontSize: 13, lineHeight: 19, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  stateBtn: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 12, backgroundColor: Sky },
  stateBtnText: { color: Brand.white, fontSize: 13.5, fontFamily: 'Poppins_600SemiBold' },
});
