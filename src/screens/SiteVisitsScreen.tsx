import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';
import { ProvideDetailsScreen } from './ProvideDetailsScreen';
import { VisitorClientDetailsScreen } from './VisitorClientDetailsScreen';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';
const IconWash = '#D7EEFB';

type SiteVisitsScreenProps = {
  onBack: () => void;
};

export function SiteVisitsScreen({ onBack }: SiteVisitsScreenProps) {
  const [showProvideDetails, setShowProvideDetails] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);

  useEffect(() => {
    if (showProvideDetails || showClientDetails) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, showProvideDetails, showClientDetails]);

  if (showClientDetails) {
    return (
      <VisitorClientDetailsScreen
        onBack={() => setShowClientDetails(false)}
        onSubmit={() => {
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
        onNext={() => setShowClientDetails(true)}
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

      <View style={styles.empty}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="file-document-outline" size={38} color={LogoMid} />
        </View>
        <Text style={styles.title}>No Site Visits Found</Text>
        <Text style={styles.subtitle}>Tap the + button to create a new visit{'\n'}record.</Text>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.fabWrap} pointerEvents="box-none">
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
  fabWrap: {
    position: 'absolute',
    right: 22,
    bottom: 22,
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
