import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Brand } from '../theme/colors';

type WaveProps = {
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function TopBrandWave({ height = 120, style }: WaveProps) {
  return (
    <View style={[styles.top, { height, pointerEvents: 'none' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path d="M0 0 H100 V55 C70 102 30 28 0 78 Z" fill={Brand.waveTop} />
      </Svg>
    </View>
  );
}

export function BottomBrandWaves({ height = 150, style }: WaveProps) {
  return (
    <View style={[styles.bottom, { height, pointerEvents: 'none' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Path d="M0 28 C30 0 65 62 100 22 V100 H0 Z" fill={Brand.waveBack} />
        <Path d="M0 52 C28 22 62 82 100 40 V100 H0 Z" fill={Brand.waveFront} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
