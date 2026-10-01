import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
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
import { fetchAllPpmTickets, type PpmTicketItem } from '../api/ppmTickets';
import { downloadPpmServiceReportPdf } from '../api/ppmWork';
import { DateCalendarModal, formatDisplayDate } from '../components/DateCalendarModal';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { PpmTicketFormScreen } from './PpmTicketFormScreen';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const PdfRed = '#E11D48';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

type PpmFilter = 'Assigned' | 'Closed' | 'Unbilled' | 'Billed';

type MetricCard = {
  key: PpmFilter;
  label: string;
  icon: McIcon;
  color: string;
  tint: string;
};

const metricCards: MetricCard[] = [
  { key: 'Assigned', label: 'Assigned', icon: 'clipboard-clock-outline', color: Sky, tint: '#E8F3FD' },
  { key: 'Closed', label: 'Closed', icon: 'check-circle-outline', color: '#059669', tint: '#E7F7F0' },
  { key: 'Unbilled', label: 'Unbilled', icon: 'file-alert-outline', color: '#E11D48', tint: '#FDECEF' },
  { key: 'Billed', label: 'Billed', icon: 'cash-check', color: '#7C3AED', tint: '#F1EBFE' },
];

const cardShadow = brandShadow('0 6px 18px rgba(11, 53, 110, 0.08)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
});

function isClosed(ticket: PpmTicketItem) {
  return ticket.isCompleted || ticket.status === 'Closed' || ticket.status === 'Completed';
}

function matchesFilter(ticket: PpmTicketItem, filter: PpmFilter) {
  const billing = ticket.billingStatus.toLowerCase();
  switch (filter) {
    case 'Assigned':
      return !isClosed(ticket);
    case 'Closed':
      return isClosed(ticket);
    case 'Unbilled':
      return billing === 'unbilled' || ticket.status === 'Unbilled';
    case 'Billed':
      return billing === 'billed' || ticket.status === 'Billed';
  }
}

/** Keeps counts short enough for the stats bar: 999, 1.2k, 12k, 1.5M */
function formatCount(value: number) {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.floor(k)}k`;
  }
  const m = value / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.floor(m)}M`;
}

function displayDate(value?: string) {
  if (!value) return 'Not set';
  return formatDisplayDate(value.slice(0, 10)) || value;
}

/** Days from today until the due date (negative when overdue), null when there is no valid date */
function daysUntil(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const due = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function dueBadge(ticket: PpmTicketItem): { text: string; color: string; tint: string } | null {
  if (isClosed(ticket)) return null;
  const days = daysUntil(ticket.dueDate);
  if (days === null) return null;
  if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? '' : 's'}`, color: '#DC2626', tint: '#FEF2F2' };
  if (days === 0) return { text: 'Due today', color: '#C2410C', tint: '#FFF7ED' };
  if (days === 1) return { text: 'Due tomorrow', color: '#B45309', tint: '#FFFBEB' };
  return { text: `Due in ${days} days`, color: '#0369A1', tint: '#F0F9FF' };
}

function InfoCell({ icon, label, value, wide }: { icon: McIcon; label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.infoCell, wide && styles.infoCellWide]}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={16} color={Sky} />
      </View>
      <View style={styles.infoTextBox}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SkeletonCard() {
  return (
    <View style={[styles.ticketCard, styles.skeletonCard]}>
      <View style={[styles.skeletonLine, { width: '45%', height: 16 }]} />
      <View style={[styles.skeletonLine, { width: '25%', marginTop: 10 }]} />
      <View style={[styles.skeletonLine, { width: '80%', marginTop: 18 }]} />
      <View style={[styles.skeletonLine, { width: '60%', marginTop: 10 }]} />
    </View>
  );
}

type PpmTicketsScreenProps = {
  user?: AuthUser | null;
  onBack: () => void;
};

export function PpmTicketsScreen({ user, onBack }: PpmTicketsScreenProps) {
  const [tickets, setTickets] = useState<PpmTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<PpmFilter>('Assigned');
  const [activeTicket, setActiveTicket] = useState<PpmTicketItem | null>(null);
  const [showDateRange, setShowDateRange] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<{ id: string; message: string } | null>(null);

  const downloadReport = async (ticket: PpmTicketItem) => {
    if (downloadingId) return;
    setDownloadingId(String(ticket.id));
    setDownloadError(null);
    try {
      await downloadPpmServiceReportPdf(ticket.id, ticket.ticketCode);
    } catch (e) {
      setDownloadError({
        id: String(ticket.id),
        message: e instanceof Error ? e.message : 'Could not download the service report.',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const employeeId = user?.employeeId ? String(user.employeeId) : '';

  const loadTickets = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fetchAllPpmTickets(employeeId);
        setTickets(result.all);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PPM tickets.');
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
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTicket) {
        setActiveTicket(null);
        return true;
      }
      if (pickerTarget) {
        setPickerTarget(null);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [activeTicket, pickerTarget, onBack]);

  const counts = useMemo(() => {
    const result: Record<PpmFilter, number> = { Assigned: 0, Closed: 0, Unbilled: 0, Billed: 0 };
    for (const ticket of tickets) {
      for (const card of metricCards) {
        if (matchesFilter(ticket, card.key)) result[card.key] += 1;
      }
    }
    return result;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return tickets.filter((ticket) => {
      if (!matchesFilter(ticket, selectedFilter)) return false;
      const ppmDay = ticket.ppmDate.slice(0, 10);
      if (fromDate && (!ppmDay || ppmDay < fromDate)) return false;
      if (toDate && (!ppmDay || ppmDay > toDate)) return false;
      if (!q) return true;
      return (
        ticket.ticketCode.toLowerCase().includes(q) ||
        ticket.category.toLowerCase().includes(q) ||
        ticket.branch.toLowerCase().includes(q) ||
        ticket.equipment.toLowerCase().includes(q)
      );
    });
  }, [tickets, selectedFilter, fromDate, toDate, searchQuery]);

  const hasDateRange = Boolean(fromDate || toDate);
  const hasFilters = hasDateRange || searchQuery.trim().length > 0;

  function handleTicketSaved(updated: PpmTicketItem) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function clearFilters() {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
  }

  if (activeTicket) {
    return (
      <PpmTicketFormScreen
        ticket={activeTicket}
        user={user}
        onBack={() => setActiveTicket(null)}
        onSaved={handleTicketSaved}
      />
    );
  }

  const total = tickets.length;
  const activeCard = metricCards.find((card) => card.key === selectedFilter) ?? metricCards[0];
  const rangeLabel = [fromDate ? formatDisplayDate(fromDate) : 'Any', toDate ? formatDisplayDate(toDate) : 'Any'].join(
    '  -  ',
  );

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
              <Text style={styles.headerTitle}>PPM Tickets</Text>
              <Text style={styles.headerSubtitle}>
                Preventive maintenance  ·  {total} ticket{total === 1 ? '' : 's'}
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
            {metricCards.map((card) => {
              const active = selectedFilter === card.key;
              const percent = total > 0 ? Math.round((counts[card.key] / total) * 100) : 0;
              return (
                <Pressable
                  key={card.key}
                  onPress={() => setSelectedFilter(card.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.label} ${counts[card.key]}`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.statItem, active && styles.statItemActive, pressed && styles.pressed]}
                >
                  <Text
                    style={[styles.statValue, active && { color: Ink }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCount(counts[card.key])}
                  </Text>
                  <View style={styles.statLabelRow}>
                    <MaterialCommunityIcons
                      name={card.icon}
                      size={12}
                      color={active ? card.color : 'rgba(255, 255, 255, 0.8)'}
                    />
                    <Text style={[styles.statLabel, active && { color: card.color }]} numberOfLines={1}>
                      {card.label}
                    </Text>
                  </View>
                  <View style={[styles.statTrack, active && { backgroundColor: '#EDF1F7' }]}>
                    <View
                      style={[
                        styles.statFill,
                        { width: `${percent}%`, backgroundColor: active ? card.color : Brand.white },
                      ]}
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTickets(true)}
            colors={[Sky]}
            tintColor={Sky}
          />
        }
      >
        <View style={[styles.searchBar, cardShadow]}>
          <Ionicons name="search-outline" size={20} color={Muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search ticket, category, branch or asset"
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
              <Text style={styles.dateRangeTitle}>PPM date range</Text>
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
                    style={({ pressed }) => [
                      styles.dateField,
                      Boolean(value) && styles.dateFieldFilled,
                      pressed && styles.pressed,
                    ]}
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

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionAccent, { backgroundColor: activeCard.color }]} />
          <Text style={styles.sectionTitle}>{activeCard.label} Tickets</Text>
          <View style={[styles.countBadge, { backgroundColor: activeCard.tint }]}>
            <Text style={[styles.countBadgeText, { color: activeCard.color }]}>{filteredTickets.length}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {hasFilters ? (
            <Pressable onPress={clearFilters} hitSlop={8} accessibilityRole="button">
              <Text style={styles.linkPrimary}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>

        {hasDateRange ? (
          <View style={styles.filterChip}>
            <MaterialCommunityIcons name="calendar-range" size={14} color={Sky} />
            <Text style={styles.filterChipText}>{rangeLabel}</Text>
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
        ) : filteredTickets.length === 0 ? (
          <View style={[styles.stateCard, cardShadow]}>
            <View style={[styles.stateIcon, { backgroundColor: activeCard.tint }]}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={30} color={activeCard.color} />
            </View>
            <Text style={styles.stateTitle}>No {activeCard.label.toLowerCase()} tickets</Text>
            <Text style={styles.stateText}>
              {hasFilters ? 'Nothing matches your search or date range.' : 'You are all caught up here.'}
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
            {filteredTickets.map((ticket) => {
              const closed = isClosed(ticket);
              const accent = closed ? '#059669' : Sky;
              const due = dueBadge(ticket);
              const downloading = downloadingId === String(ticket.id);
              return (
                <Pressable
                  key={ticket.id}
                  onPress={() => setActiveTicket(ticket)}
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${ticket.ticketCode}`}
                  style={({ pressed }) => [styles.ticketCard, cardShadow, pressed && styles.ticketPressed]}
                >
                  <View style={[styles.ticketAccent, { backgroundColor: accent }]} />

                  <View style={styles.ticketBody}>
                    <View style={styles.ticketTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ticketCode}>{ticket.ticketCode}</Text>
                        <View style={styles.tagRow}>
                          {ticket.category ? (
                            <View style={styles.categoryTag}>
                              <Text style={styles.categoryTagText}>{ticket.category}</Text>
                            </View>
                          ) : null}
                          {due ? (
                            <View style={[styles.dueTag, { backgroundColor: due.tint }]}>
                              <MaterialCommunityIcons name="clock-outline" size={12} color={due.color} />
                              <Text style={[styles.dueTagText, { color: due.color }]}>{due.text}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: closed ? '#E7F7F0' : '#E8F3FD' }]}>
                        <View style={[styles.statusDot, { backgroundColor: accent }]} />
                        <Text style={[styles.statusText, { color: accent }]}>{ticket.status}</Text>
                      </View>
                    </View>

                    <View style={styles.infoGrid}>
                      {ticket.branch ? (
                        <InfoCell icon="office-building-outline" label="Branch" value={ticket.branch} wide />
                      ) : null}
                      {ticket.equipment ? (
                        <InfoCell icon="cog-outline" label="Asset" value={ticket.equipment} wide />
                      ) : null}
                      <InfoCell icon="calendar-month-outline" label="PPM Date" value={displayDate(ticket.ppmDate)} />
                      <InfoCell icon="calendar-clock-outline" label="Due Date" value={displayDate(ticket.dueDate)} />
                    </View>
                  </View>

                  <View style={styles.ticketFooter}>
                    {closed ? (
                      <Pressable
                        onPress={() => void downloadReport(ticket)}
                        disabled={downloadingId !== null}
                        hitSlop={6}
                        style={({ pressed }) => [styles.pdfButton, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`Download service report for ${ticket.ticketCode}`}
                      >
                        {downloading ? (
                          <ActivityIndicator size="small" color={PdfRed} />
                        ) : (
                          <MaterialCommunityIcons name="file-pdf-box" size={18} color={PdfRed} />
                        )}
                        <Text style={styles.pdfButtonText}>{downloading ? 'Preparing...' : 'Service Report'}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.footerHint}>Tap to start work</Text>
                    )}
                    <View style={styles.viewButton}>
                      <Text style={styles.viewButtonText}>View details</Text>
                      <Ionicons name="arrow-forward" size={14} color={Sky} />
                    </View>
                  </View>

                  {downloadError?.id === String(ticket.id) ? (
                    <Text style={styles.downloadErrorText}>{downloadError.message}</Text>
                  ) : null}
                </Pressable>
              );
            })}
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
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
  glassButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
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
  headerTextBox: {
    flex: 1,
  },
  headerTitle: {
    color: Brand.white,
    fontSize: 21,
    fontFamily: 'Poppins_700Bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    marginTop: -2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
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
  statItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  statItemActive: {
    backgroundColor: Brand.white,
  },
  statValue: {
    alignSelf: 'stretch',
    textAlign: 'center',
    color: Brand.white,
    fontSize: 19,
    lineHeight: 24,
    fontFamily: 'Poppins_700Bold',
    fontVariant: ['tabular-nums'],
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  statLabel: {
    flexShrink: 1,
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 10.5,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.2,
  },
  statTrack: {
    alignSelf: 'stretch',
    marginTop: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  statFill: {
    height: '100%',
    borderRadius: 2,
  },
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
  searchInput: {
    flex: 1,
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    paddingVertical: 0,
  },
  dateRangePanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Line,
  },
  dateRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateRangeTitle: {
    flex: 1,
    color: Navy,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: '#F8FAFD',
  },
  dateFieldFilled: {
    borderColor: '#BFE3F7',
    backgroundColor: '#F0F8FE',
  },
  dateFieldLabel: {
    color: Muted,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  dateFieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  dateFieldValue: {
    flex: 1,
    color: Ink,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  dateFieldPlaceholder: {
    color: Muted,
    fontFamily: 'Poppins_400Regular',
  },
  linkDanger: {
    color: PdfRed,
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  linkPrimary: {
    color: Sky,
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    color: Ink,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  countBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 10,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  filterChip: {
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
  filterChipText: {
    color: Navy,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  ticketsSection: {
    gap: 14,
  },
  ticketCard: {
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Line,
    overflow: 'hidden',
  },
  ticketPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  ticketAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  ticketBody: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingLeft: 20,
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ticketCode: {
    color: Ink,
    fontSize: 16.5,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  categoryTag: {
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EEF2F8',
  },
  categoryTagText: {
    color: Navy,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dueTagText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    rowGap: 12,
  },
  infoCell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  infoCellWide: {
    width: '100%',
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FE',
  },
  infoTextBox: {
    flex: 1,
  },
  infoLabel: {
    color: Muted,
    fontSize: 10.5,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    color: Ink,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    marginTop: -1,
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingLeft: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
    backgroundColor: '#FAFCFE',
  },
  footerHint: {
    color: Muted,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECDD3',
    backgroundColor: '#FFF1F2',
  },
  pdfButtonText: {
    color: PdfRed,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#E8F3FD',
  },
  viewButtonText: {
    color: Sky,
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  downloadErrorText: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    marginTop: -4,
    color: '#B91C1C',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    backgroundColor: '#FAFCFE',
  },
  skeletonCard: {
    padding: 18,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E8EDF4',
  },
  stateCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Line,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    marginTop: 14,
    color: Ink,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  stateText: {
    marginTop: 4,
    color: Slate,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
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
  primaryButtonText: {
    color: Brand.white,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  secondaryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFE3F7',
    backgroundColor: '#F0F8FE',
  },
  secondaryButtonText: {
    color: Sky,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
});
