import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import { downloadSiteVisitPdf, fetchSiteVisits, type SiteVisit } from '../api/siteVisits';
import { formatDisplayDate } from '../components/DateCalendarModal';
import { readJson, writeJson } from '../storage/localStore';
import { mySiteVisitsKey } from '../storage/mySiteVisits';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { AddObservationScreen } from './AddObservationScreen';
import { ProvideDetailsScreen } from './ProvideDetailsScreen';
import { VisitorClientDetailsScreen } from './VisitorClientDetailsScreen';
import { VisitorSummaryScreen } from './VisitorSummaryScreen';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F4F6FA';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E5E9F0';
const Danger = '#DC2626';
const Success = '#059669';
const Violet = '#7C3AED';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Every visit shares one CreatedBy on the server, so status refresh scans this many recent rows. */
const StatusSyncWindow = 50;

const cardShadow = brandShadow('0 2px 8px rgba(15, 23, 42, 0.05)', {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 1,
});

function siteVisitCreatedBy(_user: AuthUser) {
  return 'D@007';
}

function isVisitComplete(status: string) {
  return status.toLowerCase().includes('complete');
}

function isObservationRecorded(status: string) {
  return status.toLowerCase().includes('observation');
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (isVisitComplete(status)) return { label: 'Completed', color: Success, tint: '#E7F6EF' };
  if (isObservationRecorded(status)) return { label: 'Observation', color: Violet, tint: '#F2ECFE' };
  if (normalized.includes('reject') || normalized.includes('cancel')) return { label: status, color: Danger, tint: '#FDECEC' };
  return { label: status || 'Started', color: Sky, tint: '#EAF3FC' };
}

function formatTime(value: string) {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function visitWhen(visit: SiteVisit) {
  const date = formatDisplayDate(visit.createdDate) || visit.createdDate;
  return [date, visit.createdTime ? formatTime(visit.createdTime) : ''].filter(Boolean).join(', ');
}

type SiteVisitsScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

export function SiteVisitsScreen({ user, onBack }: SiteVisitsScreenProps) {
  const [showProvideDetails, setShowProvideDetails] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [observationVisit, setObservationVisit] = useState<SiteVisit | null>(null);
  const [summaryVisit, setSummaryVisit] = useState<SiteVisit | null>(null);
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfVisitId, setPdfVisitId] = useState<number | null>(null);
  const visitsRef = useRef<SiteVisit[]>([]);
  const hydrated = useRef(false);
  const storeKey = mySiteVisitsKey(user);

  const commit = useCallback(
    (next: SiteVisit[]) => {
      visitsRef.current = next;
      setVisits(next);
      void writeJson(storeKey, next);
    },
    [storeKey],
  );

  const loadVisits = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!hydrated.current) {
      hydrated.current = true;
      const saved = await readJson<SiteVisit[]>(storeKey);
      const stored = Array.isArray(saved) ? saved.filter((item) => item && Number(item.id) > 0) : [];
      visitsRef.current = [
        ...visitsRef.current,
        ...stored.filter((item) => !visitsRef.current.some((visit) => visit.id === item.id)),
      ];
      setVisits(visitsRef.current);
    }
    if (visitsRef.current.length === 0) {
      setLoading(false);
      return;
    }
    try {
      const rows = await fetchSiteVisits(siteVisitCreatedBy(user), 0, StatusSyncWindow);
      const byId = new Map(rows.map((row) => [row.id, row]));
      commit(
        visitsRef.current.map((visit) => {
          const row = byId.get(visit.id);
          return row
            ? {
                ...visit,
                status: row.status,
                title: row.title || visit.title,
                createdDate: row.createdDate || visit.createdDate,
                createdTime: row.createdTime || visit.createdTime,
              }
            : visit;
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to refresh site visits.');
    } finally {
      setLoading(false);
    }
  }, [commit, storeKey, user]);

  const openPdf = async (visit: SiteVisit) => {
    if (pdfVisitId != null) return;
    setPdfVisitId(visit.id);
    setError('');
    try {
      const pdfUrl = await downloadSiteVisitPdf(visit.id);
      await Linking.openURL(pdfUrl);
    } catch (pdfError) {
      setError(pdfError instanceof Error ? pdfError.message : 'Unable to open the PDF.');
    } finally {
      setPdfVisitId(null);
    }
  };

  const updateStatus = (visitId: number, status: string) => {
    commit(visitsRef.current.map((item) => (item.id === visitId ? { ...item, status } : item)));
  };

  useEffect(() => {
    if (showProvideDetails || showClientDetails || observationVisit || summaryVisit) return;
    loadVisits();
  }, [loadVisits, observationVisit, showClientDetails, showProvideDetails, summaryVisit]);

  useEffect(() => {
    if (showProvideDetails || showClientDetails || observationVisit || summaryVisit) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [observationVisit, onBack, showClientDetails, showProvideDetails, summaryVisit]);

  if (summaryVisit) {
    return (
      <VisitorSummaryScreen
        siteVisitId={summaryVisit.id}
        createdBy={siteVisitCreatedBy(user)}
        onBack={() => setSummaryVisit(null)}
        onSaved={() => {
          updateStatus(summaryVisit.id, 'Completed');
          setSummaryVisit(null);
        }}
      />
    );
  }

  if (observationVisit) {
    return (
      <AddObservationScreen
        siteVisitId={observationVisit.id}
        createdBy={siteVisitCreatedBy(user)}
        onBack={() => setObservationVisit(null)}
        onSaved={() => {
          updateStatus(observationVisit.id, 'Observation Recorded');
          setObservationVisit(null);
        }}
      />
    );
  }

  if (showClientDetails) {
    return (
      <VisitorClientDetailsScreen
        branchId={selectedBranchId}
        createdBy={siteVisitCreatedBy(user)}
        onBack={() => setShowClientDetails(false)}
        onSubmit={(saved) => {
          const now = new Date();
          const createdTime = now.toTimeString().slice(0, 8);
          const createdDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const visit: SiteVisit = {
            id: saved.id,
            title: saved.title,
            status: 'Started',
            reportNumber: '',
            contactPerson: saved.contactPerson,
            phone: saved.phone,
            company: selectedCompany,
            branch: selectedBranch,
            createdDate,
            createdTime,
          };
          commit([visit, ...visitsRef.current.filter((item) => item.id !== visit.id)]);
          setError('');
          setShowClientDetails(false);
          setShowProvideDetails(false);
        }}
      />
    );
  }

  if (showProvideDetails) {
    return (
      <ProvideDetailsScreen
        onBack={() => setShowProvideDetails(false)}
        onNext={(selection) => {
          setSelectedBranchId(selection.branchId);
          setSelectedCompany(selection.company);
          setSelectedBranch(selection.branch);
          setShowClientDetails(true);
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="arrow-back" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Site Visits</Text>
            {loading && visits.length > 0 ? <ActivityIndicator size="small" color={Brand.white} /> : null}
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading && visits.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator color={Sky} />
        </View>
      ) : error && visits.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="cloud-alert-outline" size={40} color={Muted} />
          <Text style={styles.emptyTitle}>Unable to load visits</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable onPress={loadVisits} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : visits.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="map-marker-outline" size={40} color={Muted} />
          <Text style={styles.emptyTitle}>No site visits yet</Text>
          <Text style={styles.emptyText}>Tap + to start a new visit.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.listError}>{error}</Text> : null}
          <Text style={styles.listCount}>
            {visits.length} {visits.length === 1 ? 'visit' : 'visits'}
          </Text>
          {visits.map((visit) => (
            <VisitCard
              key={visit.id}
              visit={visit}
              pdfLoading={pdfVisitId === visit.id}
              onPdf={() => void openPdf(visit)}
              onObservation={() => setObservationVisit(visit)}
              onSummary={() => setSummaryVisit(visit)}
            />
          ))}
        </ScrollView>
      )}

      <SafeAreaView edges={['bottom']} style={styles.fabBar} pointerEvents="box-none">
        <Pressable
          onPress={() => setShowProvideDetails(true)}
          accessibilityRole="button"
          accessibilityLabel="Add site visit"
          style={({ pressed }) => [
            styles.fab,
            brandShadow('0 6px 14px rgba(11, 53, 110, 0.25)', {
              shadowColor: Navy,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 6,
            }),
            pressed && { opacity: 0.9 },
          ]}
        >
          <MaterialCommunityIcons name="plus" size={28} color={Brand.white} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function VisitCard({ visit, pdfLoading, onPdf, onObservation, onSummary }: {
  visit: SiteVisit;
  pdfLoading: boolean;
  onPdf: () => void;
  onObservation: () => void;
  onSummary: () => void;
}) {
  const finished = isVisitComplete(visit.status);
  const observed = isObservationRecorded(visit.status);
  const tone = statusTone(visit.status);
  const place = [visit.company, visit.branch].filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {visit.title || 'Site visit'}
        </Text>
        <View style={[styles.status, { backgroundColor: tone.tint }]}>
          <Text style={[styles.statusText, { color: tone.color }]} numberOfLines={1}>
            {tone.label}
          </Text>
        </View>
      </View>

      {visit.createdDate ? <InfoRow icon="calendar-blank-outline" text={visitWhen(visit)} /> : null}
      {place ? <InfoRow icon="office-building-outline" text={place} /> : null}
      {visit.contactPerson ? <InfoRow icon="account-outline" text={visit.contactPerson} /> : null}

      <View style={styles.actions}>
        <ActionLink
          icon="file-pdf-box"
          label="Report"
          color={Slate}
          loading={pdfLoading}
          onPress={onPdf}
        />
        {!finished ? <ActionLink icon="plus" label="Observation" color={Sky} onPress={onObservation} /> : null}
        {!finished && observed ? <ActionLink icon="check" label="Complete" color={Success} onPress={onSummary} /> : null}
      </View>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: McIcon; text: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={15} color={Muted} />
      <Text style={styles.infoText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function ActionLink({ icon, label, color, loading, onPress }: {
  icon: McIcon;
  label: string;
  color: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.action, { borderColor: `${color}40` }, pressed && { backgroundColor: `${color}12` }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : <MaterialCommunityIcons name={icon} size={16} color={color} />}
      <Text style={[styles.actionText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: Brand.white, fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 40 },
  emptyTitle: { marginTop: 8, color: Ink, fontSize: 16, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' },
  emptyText: { color: Slate, fontSize: 13, fontFamily: 'Poppins_400Regular', textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10, backgroundColor: Sky },
  retryText: { color: Brand.white, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  list: { padding: 16, paddingBottom: 100, gap: 12 },
  listError: { color: Danger, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  listCount: { color: Slate, fontSize: 12.5, fontFamily: 'Poppins_500Medium' },
  card: { backgroundColor: Brand.white, borderRadius: 14, borderWidth: 1, borderColor: Line, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardTitle: { flex: 1, color: Ink, fontSize: 15, lineHeight: 21, fontFamily: 'Poppins_600SemiBold', textTransform: 'capitalize' },
  status: { maxWidth: '45%', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  infoText: { flex: 1, color: Slate, fontSize: 12.5, fontFamily: 'Poppins_400Regular' },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F5',
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionText: { flexShrink: 1, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  fabBar: { position: 'absolute', right: 0, bottom: 0, paddingRight: 20, paddingBottom: 16 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Navy,
  },
});
