import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#F4F7FB';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const FieldStroke = '#D5E4F2';

const categories = ['General', 'Payroll', 'Leave', 'Attendance', 'Policy', 'Other'] as const;
type Category = (typeof categories)[number];

type HrTicket = {
  id: string;
  category: Category;
  subject: string;
  message: string;
  status: 'Open';
};

type HRHelpdeskScreenProps = {
  onBack: () => void;
};

export function HRHelpdeskScreen({ onBack }: HRHelpdeskScreenProps) {
  const [tickets, setTickets] = useState<HrTicket[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (showForm) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, showForm]);

  if (showForm) {
    return (
      <CreateHrTicketScreen
        onBack={() => setShowForm(false)}
        onSubmit={(category, subject, message) => {
          setTickets((prev) => [
            { id: String(Date.now()), category, subject, message, status: 'Open' },
            ...prev,
          ]);
          setShowForm(false);
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={22} color={LogoNavy} />
          </Pressable>
          <Text style={styles.headerTitle}>HR Helpdesk</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        {tickets.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="file-document-outline" size={36} color={LogoNavy} />
            </View>
            <Text style={styles.emptyTitle}>No Tickets Found</Text>
            <Text style={styles.emptyText}>
              You haven't raised any helpdesk tickets yet. Tap the button below to submit a concern to HR.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {tickets.map((ticket) => (
              <View
                key={ticket.id}
                style={[
                  styles.ticketCard,
                  brandShadow('0 8px 14px rgba(11, 53, 110, 0.08)', {
                    shadowColor: LogoNavy,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 3,
                  }),
                ]}
              >
                <View style={styles.ticketTop}>
                  <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                  <View style={styles.statusChip}>
                    <Text style={styles.statusText}>{ticket.status}</Text>
                  </View>
                </View>
                <Text style={styles.ticketCategory}>{ticket.category}</Text>
                <Text style={styles.ticketMessage}>{ticket.message}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <SafeAreaView edges={['bottom']} style={styles.fabSafe}>
        <Pressable onPress={() => setShowForm(true)} accessibilityRole="button" accessibilityLabel="Add ticket">
          <LinearGradient
            colors={[LogoSky, LogoMid, LogoNavy]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.fab,
              brandShadow('0 8px 16px rgba(11, 53, 110, 0.28)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.28,
                shadowRadius: 10,
                elevation: 8,
              }),
            ]}
          >
            <MaterialCommunityIcons name="plus" size={28} color={Brand.white} />
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function CreateHrTicketScreen({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (category: Category, subject: string, message: string) => void;
}) {
  const [category, setCategory] = useState<Category>('General');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  function submit() {
    if (!subject.trim()) {
      Alert.alert('Please enter a subject.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Please describe your concern.');
      return;
    }
    onSubmit(category, subject.trim(), message.trim());
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={22} color={LogoNavy} />
          </Pressable>
          <Text style={styles.headerTitle}>Create Ticket</Text>
          <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <View
            style={[
              styles.formCard,
              brandShadow('0 10px 18px rgba(11, 53, 110, 0.1)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 5,
              }),
            ]}
          >
            <View style={styles.formIntro}>
              <View style={styles.lifebuoy}>
                <MaterialCommunityIcons name="lifebuoy" size={26} color={LogoNavy} />
              </View>
              <Text style={styles.formTitle}>Raise HR Concern</Text>
              <Text style={styles.formHint}>Provide details of your issue below, and HR will review it.</Text>
            </View>

            <Text style={styles.fieldLabel}>CATEGORY *</Text>
            <Pressable
              onPress={() => setShowCategories(true)}
              style={styles.field}
              accessibilityRole="button"
              accessibilityLabel="Select category"
            >
              <MaterialCommunityIcons name="folder-outline" size={18} color={LogoMid} />
              <Text style={styles.fieldValue}>{category}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={Mute} />
            </Pressable>

            <Text style={styles.fieldLabel}>SUBJECT</Text>
            <View style={styles.field}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={LogoMid} />
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief summary of concern"
                placeholderTextColor={Mute}
                style={styles.fieldInput}
              />
            </View>

            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <View style={[styles.field, styles.descriptionField]}>
              <MaterialCommunityIcons name="file-document-outline" size={18} color={LogoMid} style={styles.descIcon} />
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Describe your concern in detail..."
                placeholderTextColor={Mute}
                style={[styles.fieldInput, styles.descriptionInput]}
                multiline
                textAlignVertical="top"
              />
            </View>

            <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Submit HR Ticket">
              <LinearGradient colors={[LogoNavy, LogoMid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submit}>
                <MaterialCommunityIcons name="send" size={16} color={Brand.white} />
                <Text style={styles.submitText}>Submit HR Ticket</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCategories} transparent animationType="fade" onRequestClose={() => setShowCategories(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowCategories(false)}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Select category</Text>
            {categories.map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  setCategory(item);
                  setShowCategories(false);
                }}
                style={[styles.sheetRow, item === category ? styles.sheetRowActive : null]}
              >
                <Text style={styles.sheetRowText}>{item}</Text>
                {item === category ? <MaterialCommunityIcons name="check-circle" size={18} color={LogoMid} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: SoftBlue,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: LogoNavy,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  body: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 72,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 18,
    color: LogoNavy,
    fontSize: 22,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  emptyText: {
    marginTop: 10,
    color: Mute,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  ticketCard: {
    marginBottom: 12,
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: 14,
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  ticketSubject: {
    flex: 1,
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  statusChip: {
    backgroundColor: SoftBlue,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: LogoMid,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  ticketCategory: {
    marginTop: 6,
    color: LogoMid,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  ticketMessage: {
    marginTop: 6,
    color: Mute,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Poppins_400Regular',
  },
  fabSafe: {
    position: 'absolute',
    right: 18,
    bottom: 18,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  formCard: {
    backgroundColor: Brand.white,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
  },
  formIntro: {
    alignItems: 'center',
    marginBottom: 18,
  },
  lifebuoy: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: SoftBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    marginTop: 12,
    color: LogoNavy,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  formHint: {
    marginTop: 6,
    color: Mute,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  fieldLabel: {
    marginBottom: 7,
    color: Mute,
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: 'Poppins_600SemiBold',
  },
  field: {
    minHeight: 48,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FieldStroke,
    backgroundColor: Brand.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldValue: {
    flex: 1,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 0,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  descriptionField: {
    minHeight: 120,
    alignItems: 'flex-start',
    paddingTop: 12,
    paddingBottom: 12,
  },
  descIcon: {
    marginTop: 2,
  },
  descriptionInput: {
    alignSelf: 'stretch',
    minHeight: 96,
  },
  submit: {
    marginTop: 4,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 53, 110, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 14,
  },
  sheetTitle: {
    marginBottom: 8,
    color: LogoNavy,
    fontSize: 15,
    textAlign: 'center',
    fontFamily: 'Poppins_700Bold',
  },
  sheetRow: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: SoftBlue,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetRowActive: {
    borderWidth: 1,
    borderColor: '#BFD8F2',
  },
  sheetRowText: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
});
