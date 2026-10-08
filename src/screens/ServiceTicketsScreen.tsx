import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import { fetchServiceTickets, type ServiceTicket, type ServiceTicketGroup } from '../api/serviceTickets';
import { DateCalendarModal, formatDisplayDate } from '../components/DateCalendarModal';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { statusTone, typeTone, type Tone } from '../theme/ticketTones';
import { ServiceTicketDetailScreen } from './ServiceTicketDetailScreen';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

const groupTabs: { key: ServiceTicketGroup; label: string; icon: McIcon; color: string; tint: string }[] = [
  { key: 'open', label: 'Open', icon: 'ticket-outline', color: Sky, tint: '#E8F3FD' },
  { key: 'escalated', label: 'Escalated', icon: 'alert-octagon-outline', color: '#DC2626', tint: '#FEF2F2' },
  { key: 'closed', label: 'Closed', icon: 'check-circle-outline', color: '#059669', tint: '#E7F7F0' },
];

const baseTypes = ['R&M', 'AMC', 'Supply', 'Projects', 'Home Care'];

const TypeIcons: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  'R&M': 'construct-outline',
  AMC: 'shield-checkmark-outline',
  Supply: 'cube-outline',
  Projects: 'business-outline',
  'Home Care': 'home-outline',
};

const shortStatus: Record<string, string> = {
  'work in progress': 'WIP',
  'quote approved': 'Quote OK',
  'quote sent approval pending': 'Quote Sent',
  'visit done quote pending': 'Quote Pending',
  'quote rejected by client': 'Quote Rejected',
  'submitted for closure': 'For Closure',
  'hold by customer': 'Hold · Customer',
  'hold by techxpert': 'Hold · Techxpert',
  'generate otp to start': 'OTP to Start',
  'need approval by company admin': 'Admin Approval',
};

const cardShadow = brandShadow('0 6px 18px rgba(11, 53, 110, 0.08)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
});

function statusLabel(status: string) {
  return shortStatus[status.toLowerCase()] ?? status;
}

/** Keeps counts short enough for the stats bar: 999, 1.2k, 12k */
function formatCount(value: number) {
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.floor(k)}k`;
}

function displayDate(value?: string) {
  if (!value) return '';
  return formatDisplayDate(value.slice(0, 10)) || value;
}

function daysUntil(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const due = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function dueBadge(ticket: ServiceTicket): { text: string; color: string; tint: string } | null {
  if (ticket.group === 'closed') return null;
  const days = daysUntil(ticket.dueDate);
  if (days === null) return null;
  if (days < 0) return { text: `Overdue ${-days}d`, color: '#DC2626', tint: '#FEF2F2' };
  if (days === 0) return { text: 'Due today', color: '#C2410C', tint: '#FFF7ED' };
  if (days === 1) return { text: 'Due tomorrow', color: '#B45309', tint: '#FFFBEB' };
  return { text: `Due in ${days} days`, color: '#0369A1', tint: '#F0F9FF' };
}

function SkeletonCard() {
  return (
    <View style={[styles.ticketCard, styles.skeletonCard]}>
      <View style={[styles.skeletonLine, { width: '50%', height: 16 }]} />
      <View style={[styles.skeletonLine, { width: '25%', marginTop: 10 }]} />
      <View style={[styles.skeletonLine, { width: '75%', marginTop: 18 }]} />
      <View style={[styles.skeletonLine, { width: '60%', marginTop: 10 }]} />
    </View>
  );
}

function InfoRow({ icon, value, muted }: { icon: McIcon; value: string; muted?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={15} color={Sky} />
      </View>
      <Text style={[styles.infoValue, muted && styles.infoValueMuted]} numberOfLines={muted ? 2 : 1}>
        {value}
      </Text>
    </View>
  );
}

type ServiceTicketsScreenProps = {
  user?: AuthUser | null;
  onBack: () => void;
};

export function ServiceTicketsScreen({ user, onBack }: ServiceTicketsScreenProps) {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [closedTruncated, setClosedTruncated] = useState(false);
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<ServiceTicketGroup>('open');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDateRange, setShowDateRange] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
  const [activeTicket, setActiveTicket] = useState<ServiceTicket | null>(null);

  const employeeId = user?.employeeId ? String(user.employeeId) : '';

  const loadTickets = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fetchServiceTickets(employeeId);
        setTickets(result.tickets);
        setClosedTruncated(result.closedTruncated);
        setWarning(result.warning);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tickets.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [employeeId],
  );

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (activeTicket) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pickerTarget) setPickerTarget(null);
      else onBack();
      return true;
    });
    return () => sub.remove();
  }, [activeTicket, pickerTarget, onBack]);

  const groupCounts = useMemo(() => {
    const counts: Record<ServiceTicketGroup, number> = { open: 0, escalated: 0, closed: 0 };
    for (const ticket of tickets) counts[ticket.group] += 1;
    return counts;
  }, [tickets]);

  const baseTickets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return tickets.filter((ticket) => {
      if (ticket.group !== group) return false;
      if (fromDate && (!ticket.date || ticket.date < fromDate)) return false;
      if (toDate && (!ticket.date || ticket.date > toDate)) return false;
      if (!q) return true;
      return [ticket.ticketCode, ticket.id, ticket.site, ticket.service, ticket.subService, ticket.city, ticket.message]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [tickets, group, fromDate, toDate, searchQuery]);

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>(baseTypes.map((type) => [type, 0]));
    for (const ticket of baseTickets) counts.set(ticket.type, (counts.get(ticket.type) ?? 0) + 1);
    return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
  }, [baseTickets]);

  const typeTickets = useMemo(
    () => (typeFilter === 'all' ? baseTickets : baseTickets.filter((ticket) => ticket.type === typeFilter)),
    [baseTickets, typeFilter],
  );

  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of typeTickets) counts.set(ticket.status, (counts.get(ticket.status) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [typeTickets]);

  const activeStatus = statusOptions.some((option) => option.status === statusFilter) ? statusFilter : 'all';
  const visibleTickets =
    activeStatus === 'all' ? typeTickets : typeTickets.filter((ticket) => ticket.status === activeStatus);

  const hasDateRange = Boolean(fromDate || toDate);
  const hasFilters = hasDateRange || searchQuery.trim().length > 0 || typeFilter !== 'all' || activeStatus !== 'all';
  const activeTab = groupTabs.find((tab) => tab.key === group) ?? groupTabs[0];
  const total = tickets.length;
  const rangeLabel = [fromDate ? formatDisplayDate(fromDate) : 'Any', toDate ? formatDisplayDate(toDate) : 'Any'].join(
    '  -  ',
  );

  function clearFilters() {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setTypeFilter('all');
    setStatusFilter('all');
  }

  if (activeTicket) {
    return (
      <ServiceTicketDetailScreen
        ticket={activeTicket}
        user={user}
        onBack={() => setActiveTicket(null)}
        onClosed={() => {
          setActiveTicket(null);
          void loadTickets(true);
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroGlowLarge} />
        <View style={styles.heroGlowSmall} />
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [styles.glassButton, pressed && styles.pressed]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color={Brand.white} />
            </Pressable>
            <View style={styles.headerTextBox}>
              <Text style={styles.headerTitle}>My Tickets</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Corporate & Home care  ·  {total} ticket{total === 1 ? '' : 's'}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowDateRange((prev) => !prev)}
              style={({ pressed }) => [
                styles.glassButton,
                (showDateRange || hasDateRange) && styles.glassButtonActive,
                pressed && styles.pressed,
              ]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Filter by date range"
              accessibilityState={{ expanded: showDateRange }}
            >
              <MaterialCommunityIcons name="calendar-month-outline" size={22} color={Brand.white} />
              {hasDateRange ? <View style={styles.activeDot} /> : null}
            </Pressable>
          </View>

          <View style={styles.statsBar}>
            {groupTabs.map((tab) => {
              const active = group === tab.key;
              const count = groupCounts[tab.key];
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
              const countText = `${formatCount(count)}${tab.key === 'closed' && closedTruncated ? '+' : ''}`;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setGroup(tab.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tab.label} ${countText}`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.statItem, active && styles.statItemActive, pressed && styles.pressed]}
                >
                  <Text
                    style={[styles.statValue, active && { color: Ink }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {countText}
                  </Text>
                  <View style={styles.statLabelRow}>
                    <MaterialCommunityIcons
                      name={tab.icon}
                      size={12}
                      color={active ? tab.color : 'rgba(255, 255, 255, 0.8)'}
                    />
                    <Text style={[styles.statLabel, active && { color: tab.color }]} numberOfLines={1}>
                      {tab.label}
                    </Text>
                    <Text style={[styles.statPercent, active && { color: Slate }]}>{percent}%</Text>
                  </View>
                  <View style={[styles.statTrack, active && { backgroundColor: '#EDF1F7' }]}>
                    <View
                      style={[styles.statFill, { width: `${percent}%`, backgroundColor: active ? tab.color : Brand.white }]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadTickets(true)} colors={[Sky]} tintColor={Sky} />
        }
      >
        <View style={[styles.searchBar, cardShadow]}>
          <Ionicons name="search-outline" size={20} color={Muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search ticket, branch, service or customer"
            placeholderTextColor={Muted}
            style={[styles.searchInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={Muted} />
            </Pressable>
          ) : null}
        </View>

        {showDateRange ? (
          <View style={[styles.dateRangePanel, cardShadow]}>
            <View style={styles.dateRangeHeader}>
              <MaterialCommunityIcons name="calendar-range" size={18} color={Sky} />
              <Text style={styles.dateRangeTitle}>Raised / booking date</Text>
              {hasDateRange ? (
                <Pressable
                  onPress={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkDanger}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.dateRangeRow}>
              {(['from', 'to'] as const).map((target) => {
                const value = target === 'from' ? fromDate : toDate;
                return (
                  <Pressable
                    key={target}
                    onPress={() => setPickerTarget(target)}
                    style={({ pressed }) => [styles.dateField, Boolean(value) && styles.dateFieldFilled, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${target === 'from' ? 'From' : 'To'} date ${value || 'not set'}`}
                  >
                    <Text style={styles.dateFieldLabel}>{target === 'from' ? 'From' : 'To'}</Text>
                    <View style={styles.dateFieldValueRow}>
                      <Text style={[styles.dateFieldValue, !value && styles.dateFieldPlaceholder]} numberOfLines={1}>
                        {value ? formatDisplayDate(value) : 'Select date'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={Slate} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller} contentContainerStyle={styles.chipRow}>
          {typeOptions.map((option) => (
            <FilterChip
              key={option.type}
              label={option.type}
              count={option.count}
              active={typeFilter === option.type}
              tone={typeTone(option.type)}
              icon={TypeIcons[option.type] ?? 'pricetag-outline'}
              onPress={() => setTypeFilter((current) => (current === option.type ? 'all' : option.type))}
            />
          ))}
        </ScrollView>

        {statusOptions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller} contentContainerStyle={styles.chipRow}>
            <FilterChip
              label="All status"
              count={typeTickets.length}
              active={activeStatus === 'all'}
              tone={{ color: Sky, tint: '#E8F3FD' }}
              onPress={() => setStatusFilter('all')}
            />
            {statusOptions.map((option) => (
              <FilterChip
                key={option.status}
                label={statusLabel(option.status)}
                count={option.count}
                active={activeStatus === option.status}
                tone={statusTone(option.status)}
                onPress={() => setStatusFilter(option.status)}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionAccent, { backgroundColor: activeTab.color }]} />
          <Text style={styles.sectionTitle}>{activeTab.label} Tickets</Text>
          <View style={[styles.countBadge, { backgroundColor: activeTab.tint }]}>
            <Text style={[styles.countBadgeText, { color: activeTab.color }]}>{visibleTickets.length}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {hasFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button">
              <Text style={styles.linkPrimary}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>

        {hasDateRange ? (
          <View style={styles.rangeChip}>
            <MaterialCommunityIcons name="calendar-range" size={14} color={Sky} />
            <Text style={styles.rangeChipText}>{rangeLabel}</Text>
            <Pressable
              onPress={() => {
                setFromDate('');
                setToDate('');
              }}
              hitSlop={8}
              accessibilityLabel="Clear date range"
            >
              <Ionicons name="close" size={14} color={Slate} />
            </Pressable>
          </View>
        ) : null}

        {group === 'closed' && closedTruncated && !loading ? (
          <Text style={styles.noteText}>Showing your latest closed corporate tickets.</Text>
        ) : null}

        {warning && !loading && !error ? (
          <View style={styles.warningBox}>
            <MaterialCommunityIcons name="alert-outline" size={16} color="#92400E" />
            <Text style={styles.warningText}>Some tickets could not be loaded. {warning}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.ticketsSection}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : error ? (
          <View style={[styles.stateCard, cardShadow]}>
            <View style={[styles.stateIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="cloud-offline-outline" size={28} color="#DC2626" />
            </View>
            <Text style={styles.stateTitle}>Could not load tickets</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              onPress={() => void loadTickets()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={16} color={Brand.white} />
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : visibleTickets.length === 0 ? (
          <View style={[styles.stateCard, cardShadow]}>
            <View style={[styles.stateIcon, { backgroundColor: activeTab.tint }]}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={30} color={activeTab.color} />
            </View>
            <Text style={styles.stateTitle}>No {activeTab.label.toLowerCase()} tickets</Text>
            <Text style={styles.stateText}>
              {hasFilters ? 'Nothing matches your filters.' : 'You are all caught up here.'}
            </Text>
            {hasFilters ? (
              <Pressable
                onPress={clearFilters}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.ticketsSection}>
            {visibleTickets.map((ticket) => (
              <TicketCard key={ticket.key} ticket={ticket} onPress={() => setActiveTicket(ticket)} />
            ))}
          </View>
        )}
      </ScrollView>

      <DateCalendarModal
        visible={pickerTarget !== null}
        title={pickerTarget === 'to' ? 'To Date' : 'From Date'}
        value={pickerTarget === 'to' ? toDate : fromDate}
        minDate={pickerTarget === 'to' ? fromDate || undefined : undefined}
        maxDate={pickerTarget === 'from' ? toDate || undefined : undefined}
        onClose={() => setPickerTarget(null)}
        onSelect={(iso) => {
          if (pickerTarget === 'to') setToDate(iso);
          else setFromDate(iso);
          setPickerTarget(null);
        }}
        onClear={() => {
          if (pickerTarget === 'to') setToDate('');
          else setFromDate('');
          setPickerTarget(null);
        }}
      />
    </View>
  );
}

function FilterChip({
  label,
  count,
  active,
  tone,
  icon,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: Tone;
  icon?: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? tone.color : tone.tint, borderColor: active ? tone.color : 'transparent' },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? Brand.white : tone.color} style={styles.chipIcon} /> : null}
      <Text style={[styles.chipText, { color: active ? Brand.white : tone.color }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.chipCount, { backgroundColor: active ? 'rgba(255, 255, 255, 0.24)' : Brand.white }]}>
        <Text style={[styles.chipCountText, { color: active ? Brand.white : tone.color }]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function TicketCard({ ticket, onPress }: { ticket: ServiceTicket; onPress: () => void }) {
  const status = statusTone(ticket.status);
  const type = typeTone(ticket.type);
  const due = dueBadge(ticket);
  const homeCare = ticket.source === 'homecare';
  const service = [ticket.service, ticket.subService].filter(Boolean).join(' · ');
  const site = homeCare ? [ticket.site, ticket.city].filter(Boolean).join(' - ') : ticket.site;
  const dateText = displayDate(ticket.date);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${ticket.ticketCode}`}
      style={({ pressed }) => [styles.ticketCard, cardShadow, pressed && styles.ticketPressed]}
    >
      <View style={[styles.ticketAccent, { backgroundColor: status.color }]} />

      <View style={styles.ticketBody}>
        <View style={styles.ticketTop}>
          <View style={[styles.statusPill, { backgroundColor: status.tint }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
              {ticket.status}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={[styles.typeTag, { backgroundColor: type.tint }]}>
            <Text style={[styles.typeTagText, { color: type.color }]}>{ticket.type}</Text>
          </View>
        </View>

        <View style={styles.codeRow}>
          <Text style={styles.ticketId}>#{ticket.id}</Text>
          <Text style={styles.ticketCode} numberOfLines={1}>
            {ticket.ticketCode}
          </Text>
        </View>

        {due || ticket.priority ? (
          <View style={styles.tagRow}>
            {due ? (
              <View style={[styles.smallTag, { backgroundColor: due.tint }]}>
                <MaterialCommunityIcons name="clock-outline" size={12} color={due.color} />
                <Text style={[styles.smallTagText, { color: due.color }]}>{due.text}</Text>
              </View>
            ) : null}
            {ticket.priority ? (
              <View style={[styles.smallTag, { backgroundColor: '#F1F5F9' }]}>
                <MaterialCommunityIcons name="flag-outline" size={12} color={Slate} />
                <Text style={[styles.smallTagText, { color: Slate }]}>{ticket.priority} priority</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.infoList}>
          {service ? <InfoRow icon="tools" value={service} /> : null}
          {site ? <InfoRow icon={homeCare ? 'account-outline' : 'office-building-outline'} value={site} /> : null}
          {ticket.message ? <InfoRow icon="message-text-outline" value={ticket.message} muted /> : null}
        </View>
      </View>

      <View style={styles.ticketFooter}>
        <View style={styles.footerDate}>
          <MaterialCommunityIcons name="calendar-month-outline" size={14} color={Muted} />
          <Text style={styles.footerHint} numberOfLines={1}>
            {dateText ? `${homeCare ? 'Booked' : 'Raised'} ${dateText}` : 'Date not set'}
          </Text>
        </View>
        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View details</Text>
          <Ionicons name="arrow-forward" size={14} color={Sky} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PageBg },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  hero: {
    paddingBottom: 18,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroGlowLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -60,
    backgroundColor: 'rgba(58, 171, 242, 0.28)',
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -40,
    bottom: -50,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  glassButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  glassButtonActive: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
    borderWidth: 1.5,
    borderColor: Brand.white,
  },
  headerTextBox: { flex: 1 },
  headerTitle: { color: Brand.white, fontSize: 21, fontFamily: 'Poppins_700Bold' },
  headerSubtitle: { color: 'rgba(255, 255, 255, 0.78)', fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: -2 },
  statsBar: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
    marginHorizontal: 16,
    padding: 5,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  statItem: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 14 },
  statItemActive: { backgroundColor: Brand.white },
  statValue: {
    alignSelf: 'stretch',
    textAlign: 'center',
    color: Brand.white,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: 'Poppins_700Bold',
    fontVariant: ['tabular-nums'],
  },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, maxWidth: '100%' },
  statLabel: {
    flexShrink: 1,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.2,
  },
  statPercent: { color: 'rgba(255, 255, 255, 0.6)', fontSize: 10, fontFamily: 'Poppins_500Medium' },
  statTrack: {
    alignSelf: 'stretch',
    marginTop: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  statFill: { height: '100%', borderRadius: 2 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 32 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Line,
  },
  searchInput: { flex: 1, color: Ink, fontSize: 14, fontFamily: 'Poppins_400Regular', paddingVertical: 0 },
  dateRangePanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Line,
  },
  dateRangeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dateRangeTitle: { flex: 1, color: Navy, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  dateRangeRow: { flexDirection: 'row', gap: 10 },
  dateField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: '#F8FAFD',
  },
  dateFieldFilled: { borderColor: '#BFE3F7', backgroundColor: '#F0F8FE' },
  dateFieldLabel: { color: Muted, fontSize: 11, fontFamily: 'Poppins_500Medium' },
  dateFieldValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dateFieldValue: { flex: 1, color: Ink, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  dateFieldPlaceholder: { color: Muted, fontFamily: 'Poppins_400Regular' },
  linkDanger: { color: '#E11D48', fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  linkPrimary: { color: Sky, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  chipScroller: { flexGrow: 0, flexShrink: 0, marginHorizontal: -16 },
  chipRow: { gap: 8, paddingTop: 12, paddingHorizontal: 16, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    height: 34,
    paddingLeft: 12,
    paddingRight: 5,
    borderRadius: 17,
    borderWidth: 1,
  },
  chipIcon: { marginRight: -1 },
  chipText: { fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  chipCount: { minWidth: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: 'center' },
  chipCountText: { fontSize: 11, lineHeight: 18, fontFamily: 'Poppins_700Bold' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 12 },
  sectionAccent: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { color: Ink, fontSize: 16, fontFamily: 'Poppins_700Bold' },
  countBadge: { minWidth: 26, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10, alignItems: 'center' },
  countBadgeText: { fontSize: 12, fontFamily: 'Poppins_700Bold' },
  rangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#E8F3FD',
  },
  rangeChipText: { color: Navy, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  noteText: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: -4, marginBottom: 12 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 17, fontFamily: 'Poppins_500Medium' },
  ticketsSection: { gap: 14 },
  ticketCard: {
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Line,
    overflow: 'hidden',
  },
  ticketPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  ticketAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  ticketBody: { paddingTop: 14, paddingHorizontal: 16, paddingLeft: 20 },
  ticketTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { flexShrink: 1, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  typeTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  typeTagText: { fontSize: 11.5, fontFamily: 'Poppins_700Bold', letterSpacing: 0.3 },
  codeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10 },
  ticketId: { color: Muted, fontSize: 13, fontFamily: 'Poppins_600SemiBold', fontVariant: ['tabular-nums'] },
  ticketCode: { flex: 1, color: Ink, fontSize: 16.5, fontFamily: 'Poppins_700Bold', letterSpacing: 0.2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  smallTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallTagText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  infoList: { marginTop: 12, gap: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FE',
  },
  infoValue: { flex: 1, color: Ink, fontSize: 13.5, fontFamily: 'Poppins_600SemiBold' },
  infoValueMuted: { color: Slate, fontFamily: 'Poppins_400Regular', fontSize: 13 },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingLeft: 20,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    backgroundColor: '#FAFCFE',
  },
  footerDate: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerHint: { flexShrink: 1, color: Slate, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#E8F3FD',
  },
  viewButtonText: { color: Sky, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  skeletonCard: { padding: 18 },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: '#E8EDF4' },
  stateCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Line,
  },
  stateIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { marginTop: 14, color: Ink, fontSize: 16, fontFamily: 'Poppins_700Bold' },
  stateText: { marginTop: 4, color: Slate, fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Sky,
  },
  primaryButtonText: { color: Brand.white, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  secondaryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFE3F7',
    backgroundColor: '#F0F8FE',
  },
  secondaryButtonText: { color: Sky, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
});
