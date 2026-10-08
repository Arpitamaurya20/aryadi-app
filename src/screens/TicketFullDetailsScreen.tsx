import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import {
  clientSignatureUrl,
  fetchGeneralServiceReport,
  saveClientSignature,
  saveGeneralServiceReport,
  serviceReportPdfUrl,
  type CorporateTicketDetail,
  type GeneralServiceReport,
  type ServiceReportFields,
  type ServiceTicket,
  type TicketWorkImage,
} from '../api/serviceTickets';
import { formatDisplayDate } from '../components/DateCalendarModal';
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad';
import { TicketWorkPhotos } from '../components/TicketWorkPhotos';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { statusTone, typeTone } from '../theme/ticketTones';
import { TicketClosureScreen } from './TicketClosureScreen';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const PageBg = '#F3F6FB';
const Ink = '#0F172A';
const Slate = '#64748B';
const Muted = '#94A3B8';
const Line = '#E6ECF4';
const Danger = '#DC2626';
const Success = '#059669';
const Warn = '#B45309';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Tab = 'details' | 'photos' | 'report';

const cardShadow = brandShadow('0 6px 18px rgba(11, 53, 110, 0.07)', {
  shadowColor: Navy,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.07,
  shadowRadius: 12,
  elevation: 2,
});

const emptyFields: ServiceReportFields = {
  problemReportedByClient: '',
  observation: '',
  actionTaken: '',
  remarks: '',
  clientRepresentative: '',
  clientRepresentativeContact: '',
  clientRepresentativeEmails: '',
  clientRepresentativeDesignation: '',
};

function displayDate(value?: string) {
  if (!value) return '';
  return formatDisplayDate(value.slice(0, 10)) || value;
}

function joinDateTime(date: string, time: string) {
  return [displayDate(date), time.slice(0, 5)].filter(Boolean).join('  •  ');
}

function pickFields(report: GeneralServiceReport): ServiceReportFields {
  const fields = { ...emptyFields };
  (Object.keys(fields) as (keyof ServiceReportFields)[]).forEach((key) => {
    fields[key] = report[key];
  });
  return fields;
}

type TicketFullDetailsScreenProps = {
  ticket: ServiceTicket;
  detail: CorporateTicketDetail | null;
  user?: AuthUser | null;
  onBack: () => void;
  onClosed: () => void;
};

const RequiredPhotos: { action: TicketWorkImage['action']; label: string }[] = [
  { action: 'pre_img', label: 'Pre image' },
  { action: 'post_img', label: 'Post image' },
  { action: 'Service_Report', label: 'Service report photo' },
];

export function TicketFullDetailsScreen({ ticket, detail, user, onBack, onClosed }: TicketFullDetailsScreenProps) {
  const corporate = ticket.source === 'corporate';
  const status = detail?.status || ticket.status;
  const statusColors = statusTone(status);
  const type = typeTone(ticket.type);
  const closed = ticket.group === 'closed';
  const editable = corporate && !closed && status.trim().toLowerCase() === 'work in progress';
  const createdBy = user?.loginName || user?.username || '';

  const [tab, setTab] = useState<Tab>('details');
  const [images, setImages] = useState<TicketWorkImage[]>([]);
  const [report, setReport] = useState<GeneralServiceReport | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [closing, setClosing] = useState(false);
  const reportSubmitted = !!report && report.id > 0;

  useEffect(() => {
    if (closing) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [closing, onBack]);

  if (closing) {
    return (
      <TicketClosureScreen
        ticketId={ticket.id}
        ticketCode={ticket.ticketCode}
        branchId={detail?.branchId ?? ''}
        branchName={detail?.branchSite || ticket.site}
        defaultPhone={report?.clientRepresentativeContact ?? ''}
        onBack={() => setClosing(false)}
        onClosed={onClosed}
      />
    );
  }

  const missing = [
    ...RequiredPhotos.filter((photo) => !images.some((image) => image.action === photo.action)).map((photo) => photo.label),
    ...(reportSubmitted ? [] : ['Digital service report']),
  ];

  const tabs: { key: Tab; label: string; icon: McIcon; badge?: string; hidden?: boolean }[] = [
    { key: 'details', label: 'Details', icon: 'file-document-outline' },
    { key: 'photos', label: 'Photos', icon: 'image-multiple-outline', badge: String(images.length), hidden: !corporate },
    {
      key: 'report',
      label: 'Service Report',
      icon: 'clipboard-check-outline',
      badge: reportSubmitted ? '✓' : undefined,
      hidden: !corporate,
    },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroGlow} />
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
              <Text style={styles.headerTitle}>View Details</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {ticket.ticketCode}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: statusColors.color }]} />
              <Text style={[styles.statusText, { color: statusColors.color }]} numberOfLines={1}>
                {status}
              </Text>
            </View>
          </View>
          <View style={styles.heroTags}>
            <View style={[styles.typeTag, { backgroundColor: type.tint }]}>
              <Text style={[styles.typeTagText, { color: type.color }]}>{ticket.type}</Text>
            </View>
            {ticket.service ? (
              <View style={styles.glassTag}>
                <MaterialCommunityIcons name="tools" size={12} color={Brand.white} />
                <Text style={styles.glassTagText} numberOfLines={1}>
                  {ticket.service}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.tabs}>
            {tabs
              .filter((item) => !item.hidden)
              .map((item) => {
                const active = tab === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setTab(item.key)}
                    style={[styles.tab, active && styles.tabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <MaterialCommunityIcons name={item.icon} size={16} color={active ? Navy : 'rgba(255,255,255,0.85)'} />
                    <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.badge && item.badge !== '0' ? (
                      <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, active && { color: Brand.white }]}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drawing}
      >
        <View style={tab === 'details' ? styles.tabPane : styles.hiddenPane}>
          <DetailsPane ticket={ticket} detail={detail} status={status} />
        </View>
        {corporate ? (
          <>
            <View style={tab === 'photos' ? styles.tabPane : styles.hiddenPane}>
              {!editable ? <ReadOnlyNote text="Photos can be added while the ticket is Work In Progress." /> : null}
              <TicketWorkPhotos
                ticketId={ticket.id}
                createdBy={createdBy}
                editable={editable}
                cardStyle={cardShadow}
                onImagesChange={setImages}
              />
            </View>
            <View style={tab === 'report' ? styles.tabPane : styles.hiddenPane}>
              <DigitalServiceReport
                ticketId={ticket.id}
                createdBy={createdBy}
                editable={editable}
                onReportChange={setReport}
                onDrawingChange={setDrawing}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      {editable ? (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          {missing.length ? (
            <View style={styles.footerHint}>
              <MaterialCommunityIcons name="information-outline" size={16} color={Warn} />
              <Text style={styles.footerHintText}>To submit the ticket, add: {missing.join(', ')}.</Text>
            </View>
          ) : (
            <Pressable onPress={() => setClosing(true)} style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]} accessibilityRole="button">
              <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnInner}>
                <MaterialCommunityIcons name="send-check-outline" size={19} color={Brand.white} />
                <Text style={styles.primaryBtnText}>Submit</Text>
              </LinearGradient>
            </Pressable>
          )}
        </SafeAreaView>
      ) : null}
    </View>
  );
}

function ReadOnlyNote({ text }: { text: string }) {
  return (
    <View style={styles.readOnly}>
      <MaterialCommunityIcons name="lock-outline" size={15} color={Warn} />
      <Text style={styles.readOnlyText}>{text}</Text>
    </View>
  );
}

function Section({ icon, title, children, right }: { icon: McIcon; title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <MaterialCommunityIcons name={icon} size={19} color={Sky} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.field, wide && styles.fieldWide]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, !value && styles.fieldEmpty]}>{value || 'Not set'}</Text>
    </View>
  );
}

function DetailsPane({ ticket, detail, status }: { ticket: ServiceTicket; detail: CorporateTicketDetail | null; status: string }) {
  const corporate = ticket.source === 'corporate';
  if (!corporate) {
    return (
      <>
        <Section icon="account-outline" title="Customer">
          <View style={styles.grid}>
            <Field label="Customer" value={ticket.site} />
            <Field label="City" value={ticket.city} />
            <Field label="Phone" value={ticket.phone} />
            <Field label="Email" value={ticket.email} />
            <Field label="Address" value={ticket.address} wide />
          </View>
        </Section>
        <Section icon="calendar-clock-outline" title="Booking">
          <View style={styles.grid}>
            <Field label="Booking ID" value={ticket.id} />
            <Field label="Status" value={status} />
            <Field label="Service" value={ticket.service} />
            <Field label="Payment" value={ticket.paymentStatus} />
            <Field label="Booked for" value={joinDateTime(ticket.date, ticket.time)} wide />
            <Field label="Subject" value={ticket.message} wide />
          </View>
        </Section>
      </>
    );
  }
  return (
    <>
      <Section icon="ticket-confirmation-outline" title="Ticket Information">
        <View style={styles.grid}>
          <Field label="Ticket ID" value={ticket.id} />
          <Field label="Client ticket ID" value={detail?.clientTicketId || ticket.clientTicketId} />
          <Field label="Type" value={ticket.type} />
          <Field label="Priority" value={detail?.priority || ticket.priority} />
          <Field label="Service" value={ticket.service} />
          <Field label="Call type" value={ticket.callType} />
          <Field label="Sub service" value={detail?.subService || ticket.subService} wide />
        </View>
      </Section>

      <Section icon="office-building-outline" title="Client & Site">
        <View style={styles.grid}>
          <Field label="Company" value={detail?.companyName ?? ''} />
          <Field label="Branch" value={[detail?.branchSite || ticket.site, detail?.branchCode].filter(Boolean).join(' · ')} />
          <Field label="Assigned to" value={detail?.employeeName ?? ''} />
          <Field label="Asset" value={detail?.equipmentName ?? ''} />
          <Field label="Branch address" value={detail?.branchAddress ?? ''} wide />
        </View>
      </Section>

      <Section icon="timeline-clock-outline" title="Timeline">
        <View style={styles.timeline}>
          {[
            { label: 'Raised', value: joinDateTime(ticket.date, ticket.time), icon: 'calendar-plus' as McIcon, done: true },
            { label: 'Due date', value: displayDate(detail?.dueDate || ticket.dueDate), icon: 'calendar-clock-outline' as McIcon, done: false },
            {
              label: 'Closed',
              value: joinDateTime(ticket.closeDate, ticket.closeTime),
              icon: 'check-decagram-outline' as McIcon,
              done: !!ticket.closeDate,
            },
          ].map((step, index, list) => (
            <View key={step.label} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, step.done && styles.timelineDotDone]}>
                  <MaterialCommunityIcons name={step.icon} size={13} color={step.done ? Brand.white : Sky} />
                </View>
                {index < list.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: index < list.length - 1 ? 14 : 0 }}>
                <Text style={styles.fieldLabel}>{step.label}</Text>
                <Text style={[styles.fieldValue, !step.value && styles.fieldEmpty]}>{step.value || 'Not yet'}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section icon="message-text-outline" title="Issue">
        <View style={styles.messageBox}>
          <Text style={[styles.messageText, !ticket.message && styles.fieldEmpty]}>{ticket.message || 'No message added.'}</Text>
        </View>
        {ticket.description && ticket.description !== ticket.message ? (
          <View style={[styles.messageBox, { marginTop: 10 }]}>
            <Text style={styles.fieldLabel}>Description</Text>
            <Text style={styles.messageText}>{ticket.description}</Text>
          </View>
        ) : null}
        {ticket.remarks ? (
          <View style={[styles.messageBox, { marginTop: 10 }]}>
            <Text style={styles.fieldLabel}>Remarks</Text>
            <Text style={styles.messageText}>{ticket.remarks}</Text>
          </View>
        ) : null}
      </Section>

      <Section icon="file-document-edit-outline" title="Quotation & Parts">
        <View style={styles.grid}>
          <Field label="Quotation status" value={ticket.quotationStatus || (detail?.quoteApproved ? 'Quote Approved' : '')} />
          <Field label="Spare part status" value={detail?.sparePartStatus ?? ''} />
        </View>
      </Section>
    </>
  );
}

type ReportField = { key: keyof ServiceReportFields; label: string; required?: boolean; multiline?: boolean; keyboard?: 'phone-pad' | 'email-address' };

const ReportFindings: ReportField[] = [
  { key: 'problemReportedByClient', label: 'Problem reported by client', required: true, multiline: true },
  { key: 'observation', label: 'Observation', required: true, multiline: true },
  { key: 'actionTaken', label: 'Action taken', required: true, multiline: true },
  { key: 'remarks', label: 'Remarks', multiline: true },
];

const ReportClient: ReportField[] = [
  { key: 'clientRepresentative', label: 'Client representative', required: true },
  { key: 'clientRepresentativeDesignation', label: 'Designation' },
  { key: 'clientRepresentativeContact', label: 'Contact number', keyboard: 'phone-pad' },
  { key: 'clientRepresentativeEmails', label: 'Email(s)', keyboard: 'email-address' },
];

function DigitalServiceReport({ ticketId, createdBy, editable, onReportChange, onDrawingChange }: {
  ticketId: string;
  createdBy: string;
  editable: boolean;
  onReportChange: (report: GeneralServiceReport | null) => void;
  onDrawingChange: (drawing: boolean) => void;
}) {
  const [report, setReport] = useState<GeneralServiceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<ServiceReportFields>(emptyFields);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [signatureFailed, setSignatureFailed] = useState(false);
  const signatureRef = useRef<SignaturePadHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const next = await fetchGeneralServiceReport(ticketId);
      setReport(next);
      setFields(pickFields(next));
      setSignatureFailed(false);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the service report.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onReportChange(report);
  }, [report, onReportChange]);

  const submitted = !!report && report.id > 0;

  const startEditing = () => {
    if (report) setFields(pickFields(report));
    setFormError('');
    setNotice('');
    setHasInk(false);
    setEditing(true);
  };

  const save = async () => {
    if (!report || saving) return;
    const missing = [...ReportFindings, ...ReportClient].filter((field) => field.required && !fields[field.key].trim());
    if (missing.length) {
      setFormError(`Please fill: ${missing.map((field) => field.label).join(', ')}.`);
      return;
    }
    const contact = fields.clientRepresentativeContact.replace(/\D/g, '');
    if (fields.clientRepresentativeContact.trim() && contact.length < 10) {
      setFormError('Enter a valid 10-digit contact number.');
      return;
    }
    if (!report.clientSignature && !signatureRef.current?.hasInk()) {
      setFormError('Please take the client signature.');
      return;
    }
    if (!createdBy) {
      setFormError('Sign in again to save the service report.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (signatureRef.current?.hasInk()) {
        await saveClientSignature({ ticketId, reportId: report.id, base64: signatureRef.current.toJpegBase64() });
      }
      await saveGeneralServiceReport({ ticketId, reportId: report.id, createdBy, fields });
      setEditing(false);
      setNotice(submitted ? 'Service report updated.' : 'Service report submitted.');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save the service report.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !report) {
    return (
      <View style={[styles.card, cardShadow, styles.centerBox]}>
        <ActivityIndicator color={Sky} />
        <Text style={styles.centerText}>Loading service report…</Text>
      </View>
    );
  }

  if (loadError && !report) {
    return (
      <Pressable onPress={() => void load()} style={[styles.card, cardShadow, styles.centerBox]} accessibilityRole="button">
        <MaterialCommunityIcons name="alert-circle-outline" size={26} color={Danger} />
        <Text style={[styles.centerText, { color: '#9F1239' }]}>{loadError} Tap to retry.</Text>
      </Pressable>
    );
  }

  if (!report) return null;

  const statusChip = (
    <View style={[styles.reportChip, submitted ? styles.reportChipDone : styles.reportChipPending]}>
      <MaterialCommunityIcons
        name={submitted ? 'check-decagram' : 'progress-clock'}
        size={13}
        color={submitted ? Success : Warn}
      />
      <Text style={[styles.reportChipText, { color: submitted ? Success : Warn }]}>{submitted ? 'Submitted' : 'Pending'}</Text>
    </View>
  );

  if (editing) {
    return (
      <>
        <Section icon="clipboard-edit-outline" title="Digital Service Report" right={statusChip}>
          <Text style={styles.formSection}>Work findings</Text>
          {ReportFindings.map((field) => (
            <FormInput key={field.key} field={field} value={fields[field.key]} onChange={(value) => setFields((prev) => ({ ...prev, [field.key]: value }))} />
          ))}
          <Text style={[styles.formSection, { marginTop: 6 }]}>Client representative</Text>
          {ReportClient.map((field) => (
            <FormInput key={field.key} field={field} value={fields[field.key]} onChange={(value) => setFields((prev) => ({ ...prev, [field.key]: value }))} />
          ))}
        </Section>

        <Section icon="draw-pen" title="Client Signature">
          {report.clientSignature && !signatureFailed ? (
            <View style={styles.savedSignatureBox}>
              <Image
                source={{ uri: clientSignatureUrl(report.clientSignature) }}
                style={styles.savedSignature}
                resizeMode="contain"
                onError={() => setSignatureFailed(true)}
              />
              <Text style={styles.savedSignatureHint}>Saved signature. Draw below only to replace it.</Text>
            </View>
          ) : null}
          <View>
            <SignaturePad
              ref={signatureRef}
              style={styles.signaturePad}
              onInkChange={(ink) => {
                setHasInk(ink);
                setFormError('');
              }}
              onDrawStart={() => onDrawingChange(true)}
              onDrawEnd={() => onDrawingChange(false)}
            />
            {!hasInk ? <Text style={styles.signHint}>Client signs here</Text> : null}
          </View>
          {hasInk ? (
            <Pressable onPress={() => signatureRef.current?.clear()} style={styles.clearSign} hitSlop={6} accessibilityRole="button">
              <MaterialCommunityIcons name="eraser" size={15} color={Danger} />
              <Text style={styles.clearSignText}>Clear signature</Text>
            </Pressable>
          ) : null}
        </Section>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <View style={styles.formActions}>
          <Pressable
            onPress={() => setEditing(false)}
            disabled={saving}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => void save()}
            disabled={saving}
            style={({ pressed }) => [styles.primaryBtn, saving && { opacity: 0.7 }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnInner}>
              {saving ? (
                <ActivityIndicator size="small" color={Brand.white} />
              ) : (
                <MaterialCommunityIcons name="content-save-check-outline" size={18} color={Brand.white} />
              )}
              <Text style={styles.primaryBtnText}>{submitted ? 'Update Report' : 'Submit Report'}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      {!editable ? <ReadOnlyNote text="The service report can be filled while the ticket is Work In Progress." /> : null}
      {notice ? (
        <View style={styles.notice}>
          <MaterialCommunityIcons name="check-circle-outline" size={16} color={Success} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <Section icon="clipboard-check-outline" title="Digital Service Report" right={statusChip}>
        <Text style={styles.reportMeta}>
          {submitted
            ? `Submitted ${joinDateTime(report.createdDate, report.createdTime)}${report.createdBy ? ` by ${report.createdBy}` : ''}`
            : 'Not submitted yet. Fill the report after finishing the work.'}
        </Text>
        <View style={styles.reportBlocks}>
          {ReportFindings.map((field) => (
            <View key={field.key} style={styles.reportBlock}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={[styles.reportValue, !report[field.key] && styles.fieldEmpty]}>{report[field.key] || 'Not added'}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section icon="account-tie-outline" title="Client Representative">
        <View style={styles.grid}>
          <Field label="Name" value={report.clientRepresentative} />
          <Field label="Designation" value={report.clientRepresentativeDesignation} />
          <Field label="Contact" value={report.clientRepresentativeContact} />
          <Field label="Email(s)" value={report.clientRepresentativeEmails} />
        </View>
        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Client signature</Text>
        {report.clientSignature && !signatureFailed ? (
          <View style={styles.savedSignatureBox}>
            <Image
              source={{ uri: clientSignatureUrl(report.clientSignature) }}
              style={styles.savedSignature}
              resizeMode="contain"
              onError={() => setSignatureFailed(true)}
            />
          </View>
        ) : (
          <Text style={[styles.fieldValue, styles.fieldEmpty]}>{signatureFailed ? 'Could not load the signature.' : 'Not signed yet'}</Text>
        )}
      </Section>

      <View style={styles.formActions}>
        {submitted ? (
          <Pressable
            onPress={() => void Linking.openURL(serviceReportPdfUrl(report.id))}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="file-pdf-box" size={18} color={Navy} />
            <Text style={styles.secondaryBtnText}>View PDF</Text>
          </Pressable>
        ) : null}
        {editable ? (
          <Pressable onPress={startEditing} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} accessibilityRole="button">
            <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnInner}>
              <MaterialCommunityIcons name={submitted ? 'pencil-outline' : 'clipboard-edit-outline'} size={18} color={Brand.white} />
              <Text style={styles.primaryBtnText}>{submitted ? 'Edit Report' : 'Fill Service Report'}</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

function FormInput({ field, value, onChange }: { field: ReportField; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>
        {field.label}
        {field.required ? <Text style={{ color: Danger }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={`Enter ${field.label.toLowerCase()}`}
        placeholderTextColor={Muted}
        multiline={field.multiline}
        keyboardType={field.keyboard ?? 'default'}
        autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'sentences'}
        maxLength={field.multiline ? 2000 : 200}
        style={[
          styles.input,
          field.multiline && styles.inputMultiline,
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PageBg },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  hero: { paddingBottom: 14, overflow: 'hidden', borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -70,
    top: -70,
    backgroundColor: 'rgba(58, 171, 242, 0.28)',
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
  headerTitle: { color: Brand.white, fontSize: 18, fontFamily: 'Poppins_600SemiBold' },
  headerSub: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 12.5, fontFamily: 'Poppins_500Medium' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '40%',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Brand.white,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { flexShrink: 1, fontSize: 11.5, fontFamily: 'Poppins_600SemiBold' },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginTop: 12 },
  typeTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  typeTagText: { fontSize: 11.5, fontFamily: 'Poppins_700Bold', letterSpacing: 0.3 },
  glassTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '70%',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  glassTagText: { flexShrink: 1, color: Brand.white, fontSize: 11.5, fontFamily: 'Poppins_500Medium' },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    marginHorizontal: 16,
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  tabActive: { backgroundColor: Brand.white },
  tabText: { flexShrink: 1, color: 'rgba(255, 255, 255, 0.9)', fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  tabTextActive: { color: Navy },
  tabBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  tabBadgeActive: { backgroundColor: Sky },
  tabBadgeText: { color: Brand.white, fontSize: 10.5, fontFamily: 'Poppins_700Bold' },
  content: { padding: 16, paddingBottom: 40 },
  tabPane: { gap: 14 },
  hiddenPane: { display: 'none' },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: '#FCE3B6',
  },
  readOnlyText: { flex: 1, color: Warn, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  card: { backgroundColor: Brand.white, borderRadius: 18, borderWidth: 1, borderColor: Line, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4FD',
  },
  cardTitle: { flex: 1, color: Ink, fontSize: 15.5, fontFamily: 'Poppins_600SemiBold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  field: { width: '50%', paddingRight: 10 },
  fieldWide: { width: '100%' },
  fieldLabel: {
    color: Muted,
    fontSize: 10.5,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: { color: Ink, fontSize: 14, lineHeight: 20, fontFamily: 'Poppins_600SemiBold', marginTop: 1 },
  fieldEmpty: { color: Muted, fontFamily: 'Poppins_400Regular' },
  timeline: { paddingLeft: 2 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineRail: { alignItems: 'center', width: 26 },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4FD',
    borderWidth: 1,
    borderColor: '#CFE4F8',
  },
  timelineDotDone: { backgroundColor: Sky, borderColor: Sky },
  timelineLine: { flex: 1, width: 2, marginVertical: 2, backgroundColor: '#E2EAF4' },
  messageBox: { padding: 12, borderRadius: 12, backgroundColor: '#F8FAFD', borderWidth: 1, borderColor: '#EEF2F7' },
  messageText: { color: '#334155', fontSize: 13.5, lineHeight: 20, fontFamily: 'Poppins_400Regular' },
  centerBox: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  centerText: { color: Slate, fontSize: 13, fontFamily: 'Poppins_500Medium', textAlign: 'center' },
  reportChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  reportChipDone: { backgroundColor: '#E7F7F0' },
  reportChipPending: { backgroundColor: '#FFF4E0' },
  reportChipText: { fontSize: 11.5, fontFamily: 'Poppins_600SemiBold' },
  reportMeta: { color: Slate, fontSize: 12, fontFamily: 'Poppins_400Regular', marginTop: -6, marginBottom: 12 },
  reportBlocks: { gap: 10 },
  reportBlock: { padding: 12, borderRadius: 12, backgroundColor: '#F8FAFD', borderWidth: 1, borderColor: '#EEF2F7' },
  reportValue: { color: Ink, fontSize: 13.5, lineHeight: 20, fontFamily: 'Poppins_500Medium', marginTop: 2 },
  savedSignatureBox: {
    marginTop: 8,
    marginBottom: 12,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: '#FBFCFE',
  },
  savedSignature: { width: '100%', height: 110 },
  savedSignatureHint: { color: Slate, fontSize: 11.5, fontFamily: 'Poppins_400Regular', textAlign: 'center', marginTop: 4 },
  signaturePad: {
    height: 168,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B6D5F2',
    backgroundColor: '#FBFDFF',
  },
  signHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: 72,
    color: Muted,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    pointerEvents: 'none',
  },
  clearSign: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: 8 },
  clearSignText: { color: Danger, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  formSection: {
    color: Navy,
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputGroup: { marginBottom: 12 },
  inputLabel: { color: '#334155', fontSize: 12.5, fontFamily: 'Poppins_600SemiBold', marginBottom: 6 },
  input: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Line,
    backgroundColor: '#F8FAFD',
    color: Ink,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  formError: { color: '#B91C1C', fontSize: 12.5, fontFamily: 'Poppins_500Medium', textAlign: 'center' },
  formActions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE0F3',
    backgroundColor: Brand.white,
  },
  secondaryBtnText: { color: Navy, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  primaryBtn: { flex: 1.4, borderRadius: 14, overflow: 'hidden' },
  primaryBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50 },
  primaryBtnText: { color: Brand.white, fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#E7F7F0',
  },
  noticeText: { flex: 1, color: Success, fontSize: 12.5, fontFamily: 'Poppins_600SemiBold' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: Brand.white,
    borderTopWidth: 1,
    borderTopColor: Line,
  },
  footerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFF7E8',
  },
  footerHintText: { flex: 1, color: Warn, fontSize: 12, fontFamily: 'Poppins_500Medium' },
  submitBtn: { borderRadius: 14, overflow: 'hidden' },
});
