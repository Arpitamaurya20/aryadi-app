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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select branch"
          style={[
            styles.buttonWrap,
            brandShadow('0 6px 12px rgba(11, 53, 110, 0.28)', {
              shadowColor: LogoNavy,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.28,
              shadowRadius: 8,
              elevation: 6,
            }),
          ]}
        >
          <LinearGradient
            colors={[LogoNavy, '#1568B8', LogoMid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <MaterialIcons name="apartment" size={20} color={Brand.white} />
            <Text style={styles.buttonText}>SELECT BRANCH</Text>
          </LinearGradient>
        </Pressable>
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
  buttonWrap: {
    marginTop: 28,
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
  },
  button: {
    height: 54,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    marginLeft: 10,
    color: Brand.white,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.4,
  },
});
