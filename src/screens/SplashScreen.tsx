import { StyleSheet, View } from 'react-native';
import { AryadiLogo } from '../components/AryadiLogo';
import { Brand } from '../theme/colors';
import { brandShadow } from '../theme/shadow';

export function SplashScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.badge}>
        <AryadiLogo width={132} height={132} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 168,
    height: 168,
    borderRadius: 36,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    ...brandShadow('0 10px 22px rgba(10, 29, 55, 0.10)', {
      shadowColor: Brand.navy,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 22,
      elevation: 10,
    }),
  },
});
