import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedTicketIcon, type TicketKind } from '../components/TicketIcons';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const CardLine = '#D7EEFB';

type TicketType = {
  title: string;
  subtitle: string;
  count: number;
  kind: TicketKind;
  wash: string;
  tint: string;
  wide?: boolean;
};

const types: TicketType[] = [
  {
    title: 'Corporate & Home care Tickets',
    subtitle: 'Office, facility and residential service jobs',
    count: 17,
    kind: 'corporateHome',
    wash: '#D7EEFB',
    tint: LogoNavy,
    wide: true,
  },
  {
    title: 'PPM Tickets',
    subtitle: 'Preventive maintenance',
    count: 8,
    kind: 'ppm',
    wash: '#E3F3FC',
    tint: LogoMid,
  },
  {
    title: 'Audit Tickets',
    subtitle: 'Inspection and compliance',
    count: 3,
    kind: 'audit',
    wash: '#FFF4E5',
    tint: '#D97706',
  },
];

type TicketDashboardScreenProps = {
  onBack: () => void;
};

export function TicketDashboardScreen({ onBack }: TicketDashboardScreenProps) {
  const openCount = types.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[LogoNavy, LogoMid, LogoSky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>My All Tickets</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[LogoSky, LogoMid, LogoNavy]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.overview}
        >
          <View style={styles.overviewCol}>
            <Text style={styles.overviewLabel}>Open tickets</Text>
            <Text style={styles.overviewValue}>{openCount}</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={[styles.overviewCol, styles.overviewRight]}>
            <Text style={styles.overviewLabel}>Categories</Text>
            <Text style={styles.overviewValue}>{types.length}</Text>
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Categories</Text>
        <Text style={styles.sectionHint}>Open a category to manage tickets</Text>

        <View style={styles.grid}>
          {types
            .filter((item) => item.wide)
            .map((item, index) => (
              <TicketTypeCard key={item.title} item={item} index={index} />
            ))}
          <View style={styles.gridRow}>
            {types
              .filter((item) => !item.wide)
              .map((item, index) => (
                <TicketTypeCard key={item.title} item={item} index={index + 1} />
              ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function TicketTypeCard({ item, index }: { item: TicketType; index: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [
        styles.card,
        item.wide ? styles.cardWide : null,
        pressed ? styles.cardPressed : null,
        brandShadow('0 4px 10px rgba(10, 29, 55, 0.05)', {
          shadowColor: Brand.navy,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 3,
        }),
      ]}
    >
      <View style={styles.cardTop}>
        <AnimatedTicketIcon kind={item.kind} wash={item.wash} delay={index * 180} />
        <View style={[styles.countPill, { backgroundColor: item.wash }]}>
          <Text style={[styles.countText, { color: item.tint }]}>{item.count}</Text>
        </View>
      </View>
      <Text style={[styles.cardTitle, item.wide ? styles.cardTitleWide : null]}>{item.title}</Text>
      <Text style={[styles.cardSubtitle, item.wide ? styles.cardSubtitleWide : null]}>{item.subtitle}</Text>
    </Pressable>
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
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  overview: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewCol: {
    flex: 1,
  },
  overviewRight: {
    paddingLeft: 18,
  },
  overviewLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  overviewValue: {
    color: Brand.white,
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
  },
  overviewDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  sectionTitle: {
    marginTop: 20,
    color: LogoNavy,
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  sectionHint: {
    marginTop: 2,
    marginBottom: 12,
    color: Brand.placeholder,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    minHeight: 176,
    backgroundColor: Brand.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CardLine,
    padding: 14,
  },
  cardWide: {
    minHeight: 148,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  countPill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  cardTitle: {
    marginTop: 14,
    minHeight: 36,
    color: LogoNavy,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  cardTitleWide: {
    minHeight: 0,
  },
  cardSubtitle: {
    marginTop: 4,
    minHeight: 32,
    color: Brand.placeholder,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Poppins_400Regular',
  },
  cardSubtitleWide: {
    minHeight: 0,
  },
});
