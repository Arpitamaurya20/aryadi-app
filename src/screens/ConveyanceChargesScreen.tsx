import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AuthUser } from '../api/auth';
import { addEmployeeConvenience, fetchEmployeeConvenience, type ConvenienceItem } from '../api/convenience';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { AddConveyanceScreen, type ConveyanceFormValues } from './AddConveyanceScreen';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const Mute = '#7A8CA5';
const SoftBlue = '#E8F4FD';
const FieldStroke = '#D7EEFB';

type ConveyanceChargesScreenProps = {
  user: AuthUser;
  onBack: () => void;
};

export function ConveyanceChargesScreen({ user, onBack }: ConveyanceChargesScreenProps) {
  const [items, setItems] = useState<ConvenienceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const grandTotal = items.reduce((sum, item) => sum + item.amount, 0);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchEmployeeConvenience(user.employeeId);
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user.employeeId]);

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
        createdBy: user.username || user.employee_code || String(user.employeeId),
      });
      setShowForm(false);
      await loadItems();
    } finally {
      setSubmitting(false);
    }
  }

  if (showForm) {
    return (
      <AddConveyanceScreen
        onBack={() => {
          if (!submitting) setShowForm(false);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
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
              <MaterialCommunityIcons name="chevron-left" size={28} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>All Conveyance Charges</Text>
            <View style={styles.backBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={LogoMid} />
          <Text style={styles.loadingText}>Loading convenience…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={[LogoNavy, LogoMid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.totalCard,
              brandShadow('0 10px 18px rgba(11, 53, 110, 0.28)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 14,
                elevation: 8,
              }),
            ]}
          >
            <View style={styles.flex}>
              <Text style={styles.totalLabel}>GRAND TOTAL CONVEYANCE</Text>
              <Text style={styles.totalValue}>₹ {formatAmount(grandTotal)}</Text>
            </View>
            <View style={styles.walletWrap}>
              <MaterialCommunityIcons name="wallet-outline" size={28} color={Brand.white} />
            </View>
          </LinearGradient>

          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="map-marker-path" size={28} color={LogoMid} />
              <Text style={styles.emptyTitle}>No convenience claims</Text>
              <Text style={styles.emptyText}>Your conveyance charges will appear here.</Text>
            </View>
          ) : (
            items.map((item) => (
              <View
                key={String(item.id)}
                style={[
                  styles.itemCard,
                  brandShadow('0 8px 16px rgba(11, 53, 110, 0.08)', {
                    shadowColor: LogoNavy,
                    shadowOffset: { width: 0, height: 5 },
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    elevation: 4,
                  }),
                ]}
              >
                <View style={styles.sideStripe} />
                <View style={styles.itemBody}>
                  <View style={styles.itemTop}>
                    <View style={styles.dateRow}>
                      <MaterialCommunityIcons name="calendar-month-outline" size={16} color={LogoMid} />
                      <Text style={styles.dateText}>{item.date}</Text>
                    </View>
                    <View style={styles.amountPill}>
                      <Text style={styles.amountText}>₹ {formatAmount(item.amount)}</Text>
                    </View>
                  </View>

                  <View style={styles.routeBlock}>
                    <View style={styles.routeRow}>
                      <MaterialCommunityIcons name="map-marker" size={16} color={LogoMid} />
                      <View style={styles.routeCopy}>
                        <Text style={styles.routeLabel}>FROM</Text>
                        <Text style={styles.routeValue}>{item.from}</Text>
                      </View>
                    </View>
                    <View style={styles.routeRow}>
                      <MaterialCommunityIcons name="navigation-variant" size={16} color={LogoSky} />
                      <View style={styles.routeCopy}>
                        <Text style={styles.routeLabel}>TO</Text>
                        <Text style={styles.routeValue}>{item.to}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.remarkRow}>
                    <MaterialCommunityIcons name="file-document-outline" size={16} color={LogoNavy} />
                    <View style={styles.routeCopy}>
                      <Text style={styles.routeLabel}>REFERENCE / REMARKS</Text>
                      <Text style={styles.routeValue}>{item.remarks}</Text>
                    </View>
                  </View>

                  {item.status ? (
                    <View style={styles.statusRow}>
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <SafeAreaView edges={['bottom']} style={styles.fabSafe}>
        <Pressable onPress={() => setShowForm(true)} accessibilityRole="button" accessibilityLabel="Add conveyance">
          <LinearGradient
            colors={[LogoNavy, LogoMid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.fab,
              brandShadow('0 8px 16px rgba(11, 53, 110, 0.3)', {
                shadowColor: LogoNavy,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
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

function formatAmount(value: number) {
  return value.toLocaleString('en-IN');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  header: {
    paddingHorizontal: 4,
    paddingBottom: 12,
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
    color: Brand.white,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: Mute,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  totalCard: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: 'Poppins_600SemiBold',
  },
  totalValue: {
    marginTop: 6,
    color: Brand.white,
    fontSize: 30,
    lineHeight: 36,
    fontFamily: 'Poppins_700Bold',
  },
  walletWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginTop: 14,
    backgroundColor: Brand.white,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: LogoNavy,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  emptyText: {
    color: Mute,
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  itemCard: {
    marginTop: 14,
    backgroundColor: Brand.white,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  sideStripe: {
    width: 5,
    backgroundColor: LogoSky,
  },
  itemBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  amountPill: {
    backgroundColor: SoftBlue,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  amountText: {
    color: LogoNavy,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },
  routeBlock: {
    marginTop: 14,
    gap: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  routeCopy: {
    flex: 1,
    minWidth: 0,
  },
  routeLabel: {
    color: Mute,
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: 'Poppins_600SemiBold',
  },
  routeValue: {
    marginTop: 1,
    color: LogoNavy,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  divider: {
    marginVertical: 14,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: FieldStroke,
  },
  remarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  statusRow: {
    marginTop: 12,
    alignSelf: 'flex-start',
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
});
