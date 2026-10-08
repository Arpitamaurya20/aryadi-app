import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AryadiLogo } from '../components/AryadiLogo';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const LogoSky = '#3AABF2';
const PageBg = '#EAF5FC';

type BarcodeInformationScreenProps = {
  onBack: () => void;
};

export function BarcodeInformationScreen({ onBack }: BarcodeInformationScreenProps) {
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
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
              <MaterialCommunityIcons name="arrow-left" size={22} color={Brand.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Barcode Information</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.body}>
        <View
          style={[
            styles.logoCard,
            brandShadow('0 8px 14px rgba(10, 29, 55, 0.10)', {
              shadowColor: Brand.navy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 6,
            }),
          ]}
        >
          <AryadiLogo width={220} height={64} />
        </View>

        <View
          accessibilityRole="summary"
          style={[
            styles.soonCard,
            brandShadow('0 8px 14px rgba(10, 29, 55, 0.10)', {
              shadowColor: Brand.navy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 6,
            }),
          ]}
        >
          <LinearGradient
            colors={[LogoNavy, LogoMid, LogoSky]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.soonIcon}
          >
            <MaterialCommunityIcons name="barcode-scan" size={38} color={Brand.white} />
          </LinearGradient>
          <Text style={styles.soonTitle}>Coming Soon</Text>
          <Text style={styles.soonText}>
            Barcode scanning and asset information will be available here shortly. Stay tuned!
          </Text>
          <View style={styles.soonPill}>
            <MaterialIcons name="schedule" size={14} color={LogoMid} />
            <Text style={styles.soonPillText}>UNDER DEVELOPMENT</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PageBg,
  },
  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 12,
    color: Brand.white,
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoCard: {
    marginTop: 28,
    backgroundColor: Brand.white,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  soonCard: {
    marginTop: 28,
    width: '100%',
    backgroundColor: Brand.white,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  soonIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonTitle: {
    marginTop: 18,
    color: LogoNavy,
    fontSize: 24,
    fontFamily: 'Poppins_600SemiBold',
  },
  soonText: {
    marginTop: 8,
    color: '#5B6B82',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
  },
  soonPill: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F2FC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  soonPillText: {
    marginLeft: 6,
    color: LogoMid,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.6,
  },
});
