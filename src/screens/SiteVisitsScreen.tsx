import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import { downloadSiteVisitPdf, fetchSiteVisits, type SiteVisit } from '../api/siteVisits';
import { readJson, writeJson } from '../storage/localStore';
import { mySiteVisitsKey } from '../storage/mySiteVisits';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { AddObservationScreen } from './AddObservationScreen';
import { ProvideDetailsScreen } from './ProvideDetailsScreen';
import { VisitorClientDetailsScreen } from './VisitorClientDetailsScreen';
import { VisitorSummaryScreen } from './VisitorSummaryScreen';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const IconWash = '#D7EEFB';
const Ink = '#1F2937';
const Slate = '#64748B';
const Line = '#E6ECF4';
const Red = '#DC2626';
const PdfRed = '#E11D48';
const Green = '#16A34A';

/** Every visit shares one CreatedBy on the server, so status refresh scans this many recent rows. */
const StatusSyncWindow = 50;

function siteVisitCreatedBy(_user: AuthUser) {
  return 'D@007';
}


function isVisitComplete(status: string) {
  return status.toLowerCase().includes('complete');
}

function isObservationRecorded(status: string) {
  return status.toLowerCase().includes('observation');
}

function statusDotColor(status: string) {
  if (isVisitComplete(status)) return Green;
  if (isObservationRecorded(status)) return '#7C3AED';
  const normalized = status.toLowerCase();
  if (normalized.includes('reject') || normalized.includes('cancel')) return Red;
  return '#334155';
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

  const ownerName = (user.loginName || user.username || 'User').toUpperCase();
  const ownerInitial = ownerName.charAt(0) || 'U';

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
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Site Visits</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading && visits.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator color={LogoMid} />
        </View>
      ) : error && visits.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={38} color={LogoMid} />
          </View>
          <Text style={styles.title}>Unable to load visits</Text>
          <Text style={styles.subtitle}>{error}</Text>
          <Pressable onPress={loadVisits} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel="Try again">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : visits.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="file-document-outline" size={38} color={LogoMid} />
          </View>
          <Text style={styles.title}>No Site Visits Found</Text>
          <Text style={styles.subtitle}>Tap the + button to create a new visit{'\n'}record.</Text>
        </View>
      ) : (
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.listError}>{error}</Text> : null}
          {visits.map((visit) => {
            const finished = isVisitComplete(visit.status);
            const observed = isObservationRecorded(visit.status);
            return (
              <View
                key={visit.id}
                style={[
                  styles.card,
                  brandShadow('0 6px 14px rgba(11, 53, 110, 0.07)', {
                    shadowColor: LogoNavy,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.07,
                    shadowRadius: 10,
                    elevation: 2,
                  }),
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.ticketBadge}>
                    <MaterialCommunityIcons name="ticket-confirmation-outline" size={18} color={LogoMid} />
                  </View>
                  {visit.createdDate ? (
                    <View style={styles.dateRow}>
                      <MaterialCommunityIcons name="clock-outline" size={15} color={Red} />
                      <Text style={styles.dateText}>
                        {visit.createdDate}
                        {visit.createdTime ? ` • ${visit.createdTime}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.dashClip}>
                  <View style={styles.dash} />
                </View>

                <Text style={styles.cardTitle} numberOfLines={2}>
                  {visit.title}
                </Text>

                <View style={styles.ownerRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{ownerInitial}</Text>
                  </View>
                  <Text style={styles.ownerName} numberOfLines={1}>
                    {ownerName}
                  </Text>
                </View>

                <View style={styles.cardBottom}>
                  <View style={styles.statusPill} accessibilityLabel={`Status ${visit.status}`}>
                    <View style={[styles.statusDot, { backgroundColor: statusDotColor(visit.status) }]} />
                    <Text style={styles.statusText} numberOfLines={1}>
                      {visit.status}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => void openPdf(visit)}
                      hitSlop={6}
                      style={styles.pdfBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Open report PDF"
                    >
                      {pdfVisitId === visit.id ? (
                        <ActivityIndicator color={PdfRed} size="small" />
                      ) : (
                        <MaterialCommunityIcons name="file-document-outline" size={28} color={PdfRed} />
                      )}
                    </Pressable>
                    {finished ? null : (
                      <Pressable
                        onPress={() => setObservationVisit(visit)}
                        style={[styles.roundBtn, { backgroundColor: Red }]}
                        accessibilityRole="button"
                        accessibilityLabel="Add observation"
                      >
                        <MaterialCommunityIcons name="plus" size={20} color={Brand.white} />
                      </Pressable>
                    )}
                    {observed ? (
                      <Pressable
                        onPress={() => setSummaryVisit(visit)}
                        style={[styles.roundBtn, { backgroundColor: Green }]}
                        accessibilityRole="button"
                        accessibilityLabel="Fill visitor summary"
                      >
                        <MaterialCommunityIcons name="check" size={20} color={Brand.white} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <SafeAreaView edges={['bottom']} style={styles.fabBar} pointerEvents="box-none">
        <Pressable
          onPress={() => setShowProvideDetails(true)}
          accessibilityRole="button"
          accessibilityLabel="Add site visit"
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
            <MaterialCommunityIcons name="plus" size={28} color={Brand.white} />
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  header: {
    paddingHorizontal: 6,
    paddingVertical: 14,
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
  empty: {
    flex: 1,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: IconWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 22,
    color: LogoNavy,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: Brand.placeholder,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: LogoMid,
  },
  retryText: {
    color: Brand.white,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  listScroll: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  listError: {
    marginBottom: 10,
    color: PdfRed,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Line,
    borderLeftWidth: 4,
    borderLeftColor: LogoMid,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketBadge: {
    width: 46,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E3F1FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    marginLeft: 12,
  },
  dateText: {
    color: Slate,
    fontSize: 12.5,
    fontFamily: 'Poppins_500Medium',
  },
  dashClip: {
    height: 1,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 12,
  },
  dash: {
    height: 2,
    borderWidth: 1,
    borderColor: '#D5DEE9',
    borderStyle: 'dashed',
  },
  cardTitle: {
    color: Ink,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: 'Poppins_700Bold',
  },
  ownerRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: LogoMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Brand.white,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  ownerName: {
    flex: 1,
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  cardBottom: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '55%',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#EEF2F7',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    flexShrink: 1,
    color: '#334155',
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pdfBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    paddingRight: 22,
    paddingBottom: 12,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
  },
  fabFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
