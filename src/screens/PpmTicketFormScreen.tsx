import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import {
  fetchPpmAssetHistory,
  fetchPpmTicketDetail,
  type PpmAssetHistoryItem,
  type PpmTicketDetail,
  type PpmTicketItem,
} from '../api/ppmTickets';
import {
  downloadPpmServiceReportPdf,
  fetchPpmServiceReportForm,
  ppmSignatureUrl,
  type PpmGeneralDetails,
  type PpmServiceReportForm,
} from '../api/ppmWork';
import { formatDisplayDate } from '../components/DateCalendarModal';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { ConveyanceChargesScreen } from './ConveyanceChargesScreen';
import { PpmStartWorkScreen } from './PpmStartWorkScreen';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const Danger = '#E11D48';
const Success = '#059669';
const Amber = '#D97706';
const NotSet = 'Not set';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

const reportWorkRows: [keyof PpmGeneralDetails, string][] = [
  ['ProblemReportedByClient', 'Complaint Description'],
  ['ActionTaken', 'Action Taken'],
  ['Observation', 'Observation'],
  ['Remarks', 'Remarks'],
];

const reportClientRows: [keyof PpmGeneralDetails, string, McIcon][] = [
  ['ClientRepresentative', 'Name', 'account-outline'],
  ['ClientRepresentativeDesignation', 'Designation', 'badge-account-outline'],
  ['ClientRepresentativeContact', 'Contact No.', 'phone-outline'],
  ['ClientRepresentativeEmails', 'Email(s)', 'email-outline'],
];

const cardShadow = brandShadow('0 6px 18px rgba(11, 53, 110, 0.07)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 2,
});

const actionBarShadow = brandShadow('0 -6px 18px rgba(11, 53, 110, 0.08)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 12,
});

type PpmTicketFormScreenProps = {
  ticket: PpmTicketItem;
  user?: AuthUser | null;
  onBack: () => void;
  onSaved: (updatedTicket: PpmTicketItem) => void;
};

function displayDate(value?: string) {
  if (!value) return '';
  return formatDisplayDate(value.slice(0, 10)) || value;
}

function joinMakeModel(make: string, model: string) {
  return [make, model].filter(Boolean).join(' / ');
}

function Card({ icon, title, right, children }: { icon: McIcon; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <MaterialCommunityIcons name={icon} size={18} color={Sky} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Field({ icon, label, value, wide }: { icon: McIcon; label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.field, wide && styles.fieldWide]}>
      <MaterialCommunityIcons name={icon} size={16} color={Muted} style={styles.fieldIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, !value && styles.fieldEmpty]}>{value || NotSet}</Text>
      </View>
    </View>
  );
}

function StateBox({ tone, text, onRetry }: { tone: 'loading' | 'error' | 'info'; text: string; onRetry?: () => void }) {
  return (
    <View style={[styles.stateBox, cardShadow]}>
      {tone === 'loading' ? (
        <ActivityIndicator color={Sky} />
      ) : (
        <Ionicons
          name={tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
          size={26}
          color={tone === 'error' ? Danger : Muted}
        />
      )}
      <Text style={[styles.stateText, tone === 'error' && { color: Danger }]}>{text}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={14} color={Brand.white} />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PpmTicketFormScreen({ ticket, user, onBack, onSaved }: PpmTicketFormScreenProps) {
  const [detail, setDetail] = useState<PpmTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showWork, setShowWork] = useState(false);
  const [showConveyance, setShowConveyance] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<PpmAssetHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setDetail(await fetchPpmTicketDetail(ticket.id));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load ticket details.');
    } finally {
      setLoading(false);
    }
  }, [ticket.id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const isClosed = detail ? detail.isClosed : ticket.isCompleted;
  const createdBy = user?.loginName || user?.username || '';

  const [report, setReport] = useState<PpmServiceReportForm | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [signatureFailed, setSignatureFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError('');
    try {
      setReport(await fetchPpmServiceReportForm(ticket.id));
      setSignatureFailed(false);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Could not load the service report.');
    } finally {
      setReportLoading(false);
    }
  }, [ticket.id]);

  const reportClosed = Boolean(detail?.isClosed);
  useEffect(() => {
    if (reportClosed) void loadReport();
  }, [reportClosed, loadReport]);

  const downloadReport = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadPpmServiceReportPdf(ticket.id, detail?.ticketCode || ticket.ticketCode);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Could not download the service report.');
    } finally {
      setDownloading(false);
    }
  };

  const openHistory = async () => {
    const assetId = detail?.branchAssetId || ticket.branchAssetId;
    setShowHistory(true);
    if (!assetId) {
      setHistoryError('This ticket has no linked asset.');
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    try {
      setHistory(await fetchPpmAssetHistory(assetId));
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Could not load asset history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  if (showWork && detail) {
    return (
      <PpmStartWorkScreen
        detail={detail}
        createdBy={createdBy}
        onBack={() => setShowWork(false)}
        onClosed={() => {
          onSaved({ ...ticket, status: 'Closed', rawStatus: 'Closed', isCompleted: true });
          onBack();
        }}
      />
    );
  }

  const ticketCode = detail?.ticketCode || ticket.ticketCode;

  if (showConveyance && user) {
    return (
      <ConveyanceChargesScreen
        user={user}
        defaultReference={ticketCode}
        ticketReference={ticketCode}
        readOnly={isClosed}
        onBack={() => setShowConveyance(false)}
      />
    );
  }

  const statusText = detail?.status || ticket.status;
  const category = detail?.category || ticket.category;
  const dueDate = displayDate(detail?.dueDate || ticket.dueDate);
  const ppmDate = displayDate(detail?.ppmDate || ticket.ppmDate);
  const accent = isClosed ? Success : Sky;
  const hasReport = Boolean(report && (report.isSubmitted || report.generalReportId > 0));

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
            <Text style={styles.headerTitle}>Ticket Information</Text>
            <View style={styles.glassSpacer} />
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroCode} numberOfLines={1}>
                {ticketCode}
              </Text>
              <View style={[styles.heroStatus, { backgroundColor: isClosed ? '#D1FAE5' : Brand.white }]}>
                <View style={[styles.heroStatusDot, { backgroundColor: accent }]} />
                <Text style={[styles.heroStatusText, { color: accent }]}>{statusText}</Text>
              </View>
            </View>
            <View style={styles.heroChips}>
              {category ? (
                <View style={styles.heroChip}>
                  <MaterialCommunityIcons name="shape-outline" size={13} color={Brand.white} />
                  <Text style={styles.heroChipText}>{category}</Text>
                </View>
              ) : null}
              {ppmDate ? (
                <View style={styles.heroChip}>
                  <MaterialCommunityIcons name="calendar-month-outline" size={13} color={Brand.white} />
                  <Text style={styles.heroChipText}>PPM {ppmDate}</Text>
                </View>
              ) : null}
              {dueDate ? (
                <View style={styles.heroChip}>
                  <MaterialCommunityIcons name="calendar-clock-outline" size={13} color={Brand.white} />
                  <Text style={styles.heroChipText}>Due {dueDate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <StateBox tone="loading" text="Loading ticket details..." />
        ) : loadError || !detail ? (
          <StateBox tone="error" text={loadError || 'Could not load ticket details.'} onRetry={() => void loadDetail()} />
        ) : (
          <>
            <Card icon="cog-outline" title="Asset Details">
              <Text style={styles.assetName}>{detail.equipment || NotSet}</Text>
              {joinMakeModel(detail.make, detail.model) ? (
                <Text style={styles.assetSub}>{joinMakeModel(detail.make, detail.model)}</Text>
              ) : null}
              <View style={styles.fieldGrid}>
                <Field icon="barcode" label="Serial No" value={detail.serialNo} />
                <Field icon="map-marker-outline" label="Location" value={detail.location} />
                <Field icon="shape-outline" label="Category" value={detail.category} />
                <Field icon="tag-outline" label="Type" value={detail.type} />
              </View>
            </Card>

            <Card icon="office-building-outline" title="Site Details">
              <View style={styles.fieldGrid}>
                <Field icon="domain" label="Company" value={detail.company} wide />
                <Field
                  icon="store-outline"
                  label="Branch"
                  value={[detail.branch, detail.branchCode ? `(${detail.branchCode})` : ''].filter(Boolean).join(' ')}
                  wide
                />
              </View>
              <View style={styles.addressBox}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={Sky} />
                <Text style={styles.addressText}>{detail.branchAddress || 'Address not available'}</Text>
              </View>
            </Card>

            <Card icon="calendar-text-outline" title="Schedule & Assignment">
              <View style={styles.fieldGrid}>
                <Field icon="account-hard-hat-outline" label="Employee" value={detail.employee} wide />
                <Field icon="calendar-plus" label="Booking Date" value={displayDate(detail.bookingDate)} />
                <Field icon="clock-outline" label="Booking Time" value={detail.bookingTime} />
                <Field icon="calendar-month-outline" label="PPM Date" value={displayDate(detail.ppmDate)} />
                <Field icon="calendar-clock-outline" label="Due Date" value={displayDate(detail.dueDate)} />
                {detail.isClosed ? (
                  <Field
                    icon="check-decagram-outline"
                    label="Closed On"
                    value={[displayDate(detail.closeDate), detail.closeTime].filter(Boolean).join(', ')}
                    wide
                  />
                ) : null}
              </View>
            </Card>

            {detail.isClosed ? (
              <>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionAccent} />
                  <Text style={styles.sectionTitle}>Service Report</Text>
                </View>

                <LinearGradient
                  colors={['#FFF5F6', '#FFFFFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.downloadCard, cardShadow]}
                >
                  <View style={styles.pdfIconBox}>
                    <MaterialCommunityIcons name="file-pdf-box" size={30} color={Danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.downloadTitle}>Service Report PDF</Text>
                    <Text style={styles.downloadSubtitle} numberOfLines={1}>
                      service-report-{ticketCode}.pdf
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void downloadReport()}
                    disabled={downloading}
                    style={({ pressed }) => [styles.downloadBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Download service report"
                  >
                    {downloading ? (
                      <ActivityIndicator size="small" color={Brand.white} />
                    ) : (
                      <Ionicons name="download-outline" size={17} color={Brand.white} />
                    )}
                    <Text style={styles.downloadBtnText}>{downloading ? 'Preparing' : 'Download'}</Text>
                  </Pressable>
                </LinearGradient>
                {downloadError ? <Text style={styles.inlineError}>{downloadError}</Text> : null}

                {reportLoading ? (
                  <StateBox tone="loading" text="Loading service report..." />
                ) : reportError ? (
                  <StateBox tone="error" text={reportError} onRetry={() => void loadReport()} />
                ) : report && !hasReport ? (
                  <StateBox tone="info" text="No service report was filled for this ticket." />
                ) : report ? (
                  <>
                    {report.useDynamic ? (
                      <Card icon="cube-outline" title="Asset Condition">
                        <View style={styles.conditionPill}>
                          <Ionicons
                            name={/good/i.test(report.assetCondition) && !/not/i.test(report.assetCondition) ? 'checkmark-circle' : 'alert-circle'}
                            size={16}
                            color={/good/i.test(report.assetCondition) && !/not/i.test(report.assetCondition) ? Success : Amber}
                          />
                          <Text style={styles.conditionText}>{report.assetCondition || NotSet}</Text>
                        </View>
                      </Card>
                    ) : null}

                    <Card icon="file-document-outline" title="Work Details">
                      {reportWorkRows.map(([key, label], index) => (
                        <View key={key} style={[styles.reportBlock, index === 0 && styles.reportBlockFirst]}>
                          <Text style={styles.fieldLabel}>{label}</Text>
                          <Text style={[styles.reportValue, !report.general[key] && styles.fieldEmpty]}>
                            {report.general[key] || NotSet}
                          </Text>
                        </View>
                      ))}
                    </Card>

                    <Card icon="account-tie-outline" title="Client Representative">
                      <View style={styles.fieldGrid}>
                        {reportClientRows.map(([key, label, icon]) => (
                          <Field
                            key={key}
                            icon={icon}
                            label={label}
                            value={report.general[key]}
                            wide={key === 'ClientRepresentativeEmails'}
                          />
                        ))}
                      </View>
                    </Card>

                    <Card
                      icon="shield-check-outline"
                      title="Checklist Items"
                      right={
                        report.useDynamic && report.items.length > 0 ? (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{report.items.length}</Text>
                          </View>
                        ) : null
                      }
                    >
                      {report.useDynamic && report.items.length > 0 ? (
                        <>
                          {report.checklistName ? <Text style={styles.checklistName}>{report.checklistName}</Text> : null}
                          {report.items.map((item, index) => {
                            const answer = [item.value, item.unit].filter(Boolean).join(' ');
                            const shown = item.status || answer;
                            const notOk = /^(not\s*ok|fail(ed)?|no|bad)$/i.test(shown.trim());
                            return (
                              <View key={item.id} style={[styles.checkRow, index === 0 && styles.reportBlockFirst]}>
                                <View style={styles.checkNumber}>
                                  <Text style={styles.checkNumberText}>{index + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.checkName}>{item.name}</Text>
                                  {item.status && answer && answer !== item.status ? (
                                    <Text style={styles.checkMeta}>Value: {answer}</Text>
                                  ) : null}
                                  {item.remarks ? <Text style={styles.checkMeta}>Remarks: {item.remarks}</Text> : null}
                                </View>
                                <View
                                  style={[
                                    styles.answerPill,
                                    { backgroundColor: !shown ? '#F1F5F9' : notOk ? '#FDECEF' : '#E7F7F0' },
                                  ]}
                                >
                                  <Text
                                    style={[styles.answerText, { color: !shown ? Muted : notOk ? Danger : Success }]}
                                    numberOfLines={1}
                                  >
                                    {shown || '-'}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </>
                      ) : (
                        <Text style={styles.emptyNote}>No checklist mapped for this asset.</Text>
                      )}
                    </Card>

                    <Card icon="draw" title="Client Signature">
                      {report.clientSignature && !signatureFailed ? (
                        <View style={styles.signatureBox}>
                          <Image
                            key={report.clientSignature}
                            source={{ uri: ppmSignatureUrl(report.clientSignature) }}
                            style={styles.signatureImage}
                            resizeMode="contain"
                            onError={() => setSignatureFailed(true)}
                          />
                        </View>
                      ) : (
                        <Text style={styles.emptyNote}>
                          {signatureFailed ? 'Could not load the signature.' : 'No signature saved.'}
                        </Text>
                      )}
                    </Card>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.actionBar, actionBarShadow]}>
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => void openHistory()}
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="history" size={18} color={Navy} />
            <Text style={styles.outlineBtnText}>Asset History</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowConveyance(true)}
            disabled={!user || loading}
            style={({ pressed }) => [styles.outlineBtn, styles.outlineBtnAmber, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name={isClosed ? 'car-clock' : 'car-outline'} size={18} color={Amber} />
            <Text style={[styles.outlineBtnText, { color: Amber }]} numberOfLines={1}>
              {isClosed ? 'Conveyance History' : 'Conveyance'}
            </Text>
          </Pressable>
        </View>
        {isClosed ? (
          <Text style={styles.closedNote}>
            New conveyance requests are not allowed after the ticket is closed. You can still view the history.
          </Text>
        ) : null}

        {isClosed ? (
          <View style={styles.closedBtn}>
            <Ionicons name="lock-closed-outline" size={17} color={Slate} />
            <Text style={styles.closedBtnText}>Ticket Closed</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowWork(true)}
            disabled={loading || !detail}
            style={({ pressed }) => [(pressed || loading || !detail) && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtn}>
              <MaterialCommunityIcons name="play-circle-outline" size={20} color={Brand.white} />
              <Text style={styles.primaryBtnText}>Start Work</Text>
            </LinearGradient>
          </Pressable>
        )}
      </SafeAreaView>

      <Modal visible={showHistory} transparent animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowHistory(false)} accessibilityLabel="Close" />
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.cardIcon}>
                <MaterialCommunityIcons name="history" size={18} color={Sky} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Asset History</Text>
                {detail?.equipment ? (
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {detail.equipment}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setShowHistory(false)}
                hitSlop={12}
                style={styles.closeCircle}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={Slate} />
              </Pressable>
            </View>

            {historyLoading ? (
              <ActivityIndicator color={Sky} style={{ marginVertical: 32 }} />
            ) : historyError ? (
              <Text style={[styles.stateText, { color: Danger, marginVertical: 28 }]}>{historyError}</Text>
            ) : history.length === 0 ? (
              <Text style={[styles.stateText, { marginVertical: 28 }]}>No PPM history for this asset.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {history.map((item, index) => {
                  const current = item.id === ticket.id;
                  const closed = /closed|completed/i.test(item.status);
                  return (
                    <View key={item.id} style={styles.timelineRow}>
                      <View style={styles.timelineRail}>
                        <View
                          style={[
                            styles.timelineDot,
                            { backgroundColor: current ? Danger : closed ? Success : Sky },
                          ]}
                        />
                        {index < history.length - 1 ? <View style={styles.timelineLine} /> : null}
                      </View>
                      <View style={[styles.timelineCard, current && styles.timelineCardCurrent]}>
                        <View style={styles.timelineTop}>
                          <Text style={styles.historyCode}>{item.ticketCode}</Text>
                          <Text style={[styles.historyStatus, { color: closed ? Success : Sky }]}>
                            {item.status || NotSet}
                          </Text>
                        </View>
                        <Text style={styles.historyMeta}>
                          PPM {displayDate(item.ppmDate) || NotSet}
                          {item.closeDate ? `  ·  Closed ${displayDate(item.closeDate)}` : ''}
                        </Text>
                        {current ? <Text style={styles.currentTag}>This ticket</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 20,
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
  glassSpacer: {
    width: 42,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  heroBody: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroCode: {
    flex: 1,
    color: Brand.white,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.3,
  },
  heroStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heroStatusText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  heroChipText: {
    color: Brand.white,
    fontSize: 11.5,
    fontFamily: 'Poppins_500Medium',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },
  card: {
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Line,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FE',
  },
  cardTitle: {
    flex: 1,
    color: Navy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  assetName: {
    color: Ink,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  assetSub: {
    color: Slate,
    fontSize: 12.5,
    fontFamily: 'Poppins_500Medium',
    marginTop: -2,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
    marginTop: 12,
  },
  field: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingRight: 8,
  },
  fieldWide: {
    width: '100%',
  },
  fieldIcon: {
    marginTop: 2,
  },
  fieldLabel: {
    color: Muted,
    fontSize: 10.5,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: {
    color: Ink,
    fontSize: 13.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  fieldEmpty: {
    color: Muted,
    fontFamily: 'Poppins_400Regular',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F5F9FE',
    borderWidth: 1,
    borderColor: '#E3EEFA',
  },
  addressText: {
    flex: 1,
    color: '#334155',
    fontSize: 12.5,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: Sky,
  },
  sectionTitle: {
    color: Ink,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  downloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FBD5DC',
    padding: 14,
  },
  pdfIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: '#FBD5DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadTitle: {
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  downloadSubtitle: {
    color: Slate,
    fontSize: 11.5,
    fontFamily: 'Poppins_400Regular',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Danger,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  downloadBtnText: {
    color: Brand.white,
    fontSize: 12.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  inlineError: {
    color: '#B91C1C',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    marginTop: -6,
    paddingHorizontal: 4,
  },
  conditionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F5F9FE',
    borderWidth: 1,
    borderColor: '#E3EEFA',
  },
  conditionText: {
    color: Ink,
    fontSize: 13.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  reportBlock: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  reportBlockFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  reportValue: {
    color: Ink,
    fontSize: 13.5,
    fontFamily: 'Poppins_500Medium',
    marginTop: 2,
    lineHeight: 20,
  },
  countBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#E8F3FD',
  },
  countBadgeText: {
    color: Sky,
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  checklistName: {
    color: Slate,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    marginTop: -6,
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  checkNumber: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF6FE',
  },
  checkNumberText: {
    color: Sky,
    fontSize: 11.5,
    fontFamily: 'Poppins_700Bold',
  },
  checkName: {
    color: Ink,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 19,
  },
  checkMeta: {
    color: Slate,
    fontSize: 11.5,
    fontFamily: 'Poppins_400Regular',
    marginTop: 2,
  },
  answerPill: {
    maxWidth: 110,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  answerText: {
    fontSize: 11.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  emptyNote: {
    color: Muted,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  signatureBox: {
    minHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFE3F7',
    borderStyle: 'dashed',
    backgroundColor: '#F8FCFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  signatureImage: {
    width: '100%',
    height: 120,
  },
  stateBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: Brand.white,
  },
  stateText: {
    color: Slate,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Sky,
  },
  retryText: {
    color: Brand.white,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: Brand.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C9DDF3',
    backgroundColor: '#F5F9FE',
  },
  outlineBtnAmber: {
    borderColor: '#FCD9A8',
    backgroundColor: '#FFF8EE',
  },
  outlineBtnText: {
    color: Navy,
    fontSize: 13.5,
    fontFamily: 'Poppins_600SemiBold',
  },
  closedNote: {
    color: Slate,
    fontSize: 11.5,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    marginTop: -2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  closedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EEF2F7',
  },
  closedBtnText: {
    color: Slate,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  modalSheet: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  modalTitle: {
    color: Navy,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  modalSubtitle: {
    color: Slate,
    fontSize: 12.5,
    fontFamily: 'Poppins_400Regular',
    marginTop: -2,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineRail: {
    width: 14,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 16,
    borderWidth: 2,
    borderColor: Brand.white,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 2,
    backgroundColor: '#E2E8F0',
  },
  timelineCard: {
    flex: 1,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: '#FAFCFE',
  },
  timelineCardCurrent: {
    borderColor: '#FBD5DC',
    backgroundColor: '#FFF7F8',
  },
  timelineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyCode: {
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  historyStatus: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  historyMeta: {
    color: Slate,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    marginTop: 2,
  },
  currentTag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    color: Danger,
    backgroundColor: '#FDECEF',
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
});
