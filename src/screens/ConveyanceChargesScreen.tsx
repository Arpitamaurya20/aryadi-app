import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { BackHandler, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import { addEmployeeConvenience, fetchEmployeeConvenience, type ConvenienceItem } from '../api/convenience';
import { formatDisplayDate } from '../components/DateCalendarModal';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { AddConveyanceScreen, type ConveyanceFormValues } from './AddConveyanceScreen';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];
type ClaimGroup = 'pending' | 'paid' | 'rejected';
type ClaimFilter = 'all' | ClaimGroup;

const groupStyle: Record<ClaimGroup, { label: string; color: string; tint: string; icon: McIcon }> = {
  pending: { label: 'Pending', color: '#B45309', tint: '#FFF7E6', icon: 'progress-clock' },
  paid: { label: 'Paid', color: '#047857', tint: '#E7F7F0', icon: 'check-decagram-outline' },
  rejected: { label: 'Rejected', color: '#DC2626', tint: '#FEF2F2', icon: 'close-octagon-outline' },
};

const filters: { key: ClaimFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'rejected', label: 'Rejected' },
];

const cardShadow = brandShadow('0 6px 18px rgba(11, 53, 110, 0.07)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 2,
});

function claimGroup(status: string): ClaimGroup {
  if (/^rejected/i.test(status)) return 'rejected';
  if (/payment done|paid/i.test(status)) return 'paid';
  return 'pending';
}

function formatAmount(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function displayDate(value: string) {
  return formatDisplayDate(value.slice(0, 10)) || value;
}

type ClaimScope = 'ticket' | 'all';

type ConveyanceChargesScreenProps = {
  user: AuthUser;
  /** Prefills Reference / Remarks, e.g. the ticket code when opened from a ticket */
  defaultReference?: string;
  /** Ticket code whose claims can be listed on their own, matched against the claim reference */
  ticketReference?: string;
  /** History only: new claims cannot be added (e.g. the ticket is closed) */
  readOnly?: boolean;
  onBack: () => void;
};

export function ConveyanceChargesScreen({
  user,
  defaultReference = '',
  ticketReference = '',
  readOnly = false,
  onBack,
}: ConveyanceChargesScreenProps) {
  const [items, setItems] = useState<ConvenienceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<ClaimFilter>('all');
  const [scope, setScope] = useState<ClaimScope>(ticketReference && readOnly ? 'ticket' : 'all');

  const loadItems = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError('');
      try {
        setItems(await fetchEmployeeConvenience(user.employeeId));
      } catch (e) {
        setItems([]);
        setLoadError(e instanceof Error ? e.message : 'Unable to load conveyance charges.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user.employeeId],
  );

  useEffect(() => {
    if (showForm) return;
    void loadItems();
  }, [loadItems, showForm]);

  useEffect(() => {
    if (showForm) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, showForm]);

  const scopedItems = useMemo(() => {
    const reference = ticketReference.trim().toLowerCase();
    if (scope === 'all' || !reference) return items;
    return items.filter((item) => item.remarks.toLowerCase().includes(reference));
  }, [items, scope, ticketReference]);

  const summary = useMemo(() => {
    const totals: Record<ClaimGroup, { amount: number; count: number }> = {
      pending: { amount: 0, count: 0 },
      paid: { amount: 0, count: 0 },
      rejected: { amount: 0, count: 0 },
    };
    let total = 0;
    for (const item of scopedItems) {
      const group = claimGroup(item.status);
      totals[group].amount += item.amount;
      totals[group].count += 1;
      if (group !== 'rejected') total += item.amount;
    }
    return { total, totals };
  }, [scopedItems]);

  const visibleItems = useMemo(
    () => (filter === 'all' ? scopedItems : scopedItems.filter((item) => claimGroup(item.status) === filter)),
    [scopedItems, filter],
  );
  const ticketScoped = scope === 'ticket' && Boolean(ticketReference);
  const emptyTitle =
    filter !== 'all' ? `No ${filter} claims` : ticketScoped ? 'No claims for this ticket' : 'No claims yet';
  const emptyText =
    filter !== 'all'
      ? 'Try another filter.'
      : ticketScoped
        ? readOnly
          ? `No conveyance was claimed with reference ${ticketReference}.`
          : `Tap "New Claim" to add a conveyance charge for ${ticketReference}.`
        : readOnly
          ? 'You have not submitted any conveyance claims.'
          : 'Tap "New Claim" to add your first conveyance charge.';

  async function handleSubmit(values: ConveyanceFormValues) {
    setSubmitting(true);
    try {
      await addEmployeeConvenience({
        employeeId: user.employeeId,
        from: values.from,
        to: values.to,
        amount: Number(values.amount),
        date: values.date,
        reference: values.remarks,
        createdBy: user.loginName || user.username || user.employee_code || String(user.employeeId),
      });
      setShowForm(false);
      await loadItems();
    } finally {
      setSubmitting(false);
    }
  }

  if (showForm && !readOnly) {
    return (
      <AddConveyanceScreen
        onBack={() => {
          if (!submitting) setShowForm(false);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        initialRemarks={defaultReference}
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
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{readOnly ? 'Conveyance History' : 'Conveyance Charges'}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {scopedItems.length} claim{scopedItems.length === 1 ? '' : 's'}
                {ticketScoped ? ` for ${ticketReference}` : ' submitted'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryPanel}>
            <View style={styles.summaryTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Total claimed</Text>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  ₹{formatAmount(summary.total)}
                </Text>
              </View>
              <View style={styles.walletIcon}>
                <MaterialCommunityIcons name="wallet-outline" size={24} color={Brand.white} />
              </View>
            </View>
            <View style={styles.summaryStats}>
              {(Object.keys(groupStyle) as ClaimGroup[]).map((group, index) => (
                <View key={group} style={[styles.summaryStat, index > 0 && styles.summaryStatDivider]}>
                  <Text style={styles.summaryStatLabel}>{groupStyle[group].label}</Text>
                  <Text style={styles.summaryStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    ₹{formatAmount(summary.totals[group].amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadItems(true)} colors={[Sky]} tintColor={Sky} />
        }
      >
        {readOnly ? (
          <View style={styles.readOnlyBanner}>
            <Ionicons name="lock-closed-outline" size={16} color="#92400E" />
            <Text style={styles.readOnlyText}>
              This ticket is closed. You can view your conveyance history, but new requests are not allowed.
            </Text>
          </View>
        ) : null}

        {ticketReference ? (
          <View style={styles.scopeToggle}>
            {(
              [
                { key: 'ticket', label: 'This ticket' },
                { key: 'all', label: 'All claims' },
              ] as const
            ).map((option) => {
              const active = scope === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setScope(option.key)}
                  style={[styles.scopeOption, active && styles.scopeOptionActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.scopeText, active && styles.scopeTextActive]} numberOfLines={1}>
                    {option.key === 'ticket' ? `${option.label} · ${ticketReference}` : option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map((option) => {
            const active = filter === option.key;
            const count = option.key === 'all' ? scopedItems.length : summary.totals[option.key].count;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFilter(option.key)}
                style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterTextActive]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((key) => (
              <View key={key} style={[styles.claimCard, styles.skeletonCard]}>
                <View style={[styles.skeletonLine, { width: '40%', height: 14 }]} />
                <View style={[styles.skeletonLine, { width: '75%', marginTop: 16 }]} />
                <View style={[styles.skeletonLine, { width: '55%', marginTop: 10 }]} />
              </View>
            ))}
          </View>
        ) : loadError ? (
          <View style={[styles.stateCard, cardShadow]}>
            <View style={[styles.stateIcon, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="cloud-offline-outline" size={28} color="#DC2626" />
            </View>
            <Text style={styles.stateTitle}>Could not load claims</Text>
            <Text style={styles.stateText}>{loadError}</Text>
            <Pressable
              onPress={() => void loadItems()}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={16} color={Brand.white} />
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={[styles.stateCard, cardShadow]}>
            <View style={[styles.stateIcon, { backgroundColor: '#EEF6FE' }]}>
              <MaterialCommunityIcons name="map-marker-path" size={30} color={Sky} />
            </View>
            <Text style={styles.stateTitle}>{emptyTitle}</Text>
            <Text style={styles.stateText}>{emptyText}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visibleItems.map((item) => {
              const group = groupStyle[claimGroup(item.status)];
              const hasReference = item.remarks && item.remarks !== '—';
              return (
                <View key={String(item.id)} style={[styles.claimCard, cardShadow]}>
                  <View style={styles.claimTop}>
                    <View style={styles.dateBox}>
                      <MaterialCommunityIcons name="calendar-month-outline" size={16} color={Sky} />
                      <Text style={styles.dateText}>{displayDate(item.date)}</Text>
                    </View>
                    <Text style={styles.amount}>₹{formatAmount(item.amount)}</Text>
                  </View>

                  <View style={styles.route}>
                    <View style={styles.routeRail}>
                      <View style={[styles.routeDot, { backgroundColor: Sky }]} />
                      <View style={styles.routeLine} />
                      <MaterialCommunityIcons name="map-marker" size={16} color={Navy} />
                    </View>
                    <View style={styles.routeStops}>
                      <View>
                        <Text style={styles.routeLabel}>From</Text>
                        <Text style={styles.routeValue} numberOfLines={2}>
                          {item.from}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.routeLabel}>To</Text>
                        <Text style={styles.routeValue} numberOfLines={2}>
                          {item.to}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.claimFooter}>
                    <View style={styles.referenceBox}>
                      <MaterialCommunityIcons name="file-document-outline" size={15} color={Muted} />
                      <Text style={[styles.referenceText, !hasReference && { color: Muted }]} numberOfLines={1}>
                        {hasReference ? item.remarks : 'No reference'}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: group.tint }]}>
                      <MaterialCommunityIcons name={group.icon} size={13} color={group.color} />
                      <Text style={[styles.statusText, { color: group.color }]} numberOfLines={1}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {readOnly ? null : (
        <SafeAreaView edges={['bottom']} style={styles.fabSafe} pointerEvents="box-none">
          <Pressable
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Add conveyance"
          >
            <LinearGradient
              colors={[Navy, Sky]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.fab,
                brandShadow('0 10px 20px rgba(11, 53, 110, 0.3)', {
                  shadowColor: Navy,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  elevation: 8,
                }),
              ]}
            >
              <Ionicons name="add" size={22} color={Brand.white} />
              <Text style={styles.fabText}>New Claim</Text>
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      )}
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
  headerTitle: {
    color: Brand.white,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    marginTop: -2,
  },
  summaryPanel: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11.5,
    fontFamily: 'Poppins_500Medium',
    letterSpacing: 0.3,
  },
  summaryValue: {
    color: Brand.white,
    fontSize: 28,
    lineHeight: 36,
    fontFamily: 'Poppins_700Bold',
    fontVariant: ['tabular-nums'],
  },
  walletIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  summaryStats: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
  },
  summaryStat: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  summaryStatDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.16)',
  },
  summaryStatLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10.5,
    fontFamily: 'Poppins_500Medium',
  },
  summaryStatValue: {
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    fontVariant: ['tabular-nums'],
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 14,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  readOnlyText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'Poppins_500Medium',
  },
  scopeToggle: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#E8EEF6',
  },
  scopeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 11,
  },
  scopeOptionActive: {
    backgroundColor: Brand.white,
  },
  scopeText: {
    color: Slate,
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  scopeTextActive: {
    color: Navy,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Line,
  },
  filterChipActive: {
    backgroundColor: Navy,
    borderColor: Navy,
  },
  filterText: {
    color: Slate,
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  filterTextActive: {
    color: Brand.white,
  },
  filterCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    backgroundColor: '#EEF2F7',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterCountText: {
    color: Slate,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: 'Poppins_700Bold',
  },
  list: {
    gap: 12,
  },
  claimCard: {
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Line,
    padding: 16,
  },
  claimTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EEF6FE',
  },
  dateText: {
    color: Navy,
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  amount: {
    color: Ink,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    fontVariant: ['tabular-nums'],
  },
  route: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  routeRail: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 6,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#CFE6FB',
  },
  routeLine: {
    flex: 1,
    width: 0,
    minHeight: 18,
    marginVertical: 3,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#C9DDF3',
  },
  routeStops: {
    flex: 1,
    gap: 12,
  },
  routeLabel: {
    color: Muted,
    fontSize: 10.5,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  routeValue: {
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    textTransform: 'capitalize',
  },
  claimFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  referenceBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  referenceText: {
    flex: 1,
    color: '#334155',
    fontSize: 12.5,
    fontFamily: 'Poppins_500Medium',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '55%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11.5,
    fontFamily: 'Poppins_600SemiBold',
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
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Sky,
  },
  retryText: {
    color: Brand.white,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  fabSafe: {
    position: 'absolute',
    right: 18,
    bottom: 18,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 52,
    paddingLeft: 16,
    paddingRight: 20,
    borderRadius: 26,
  },
  fabText: {
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
});
