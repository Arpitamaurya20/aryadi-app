import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type IndustrialModule =
  | 'corporate'
  | 'siteVisits'
  | 'mappedAssets'
  | 'workZone'
  | 'speakUp'
  | 'vendors';

const icons: Record<
  IndustrialModule,
  { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string; bg: string }
> = {
  corporate: { name: 'ticket-confirmation', color: '#0B356E', bg: '#E4EEFF' },
  siteVisits: { name: 'map-marker', color: '#1E8BE0', bg: '#E7F4FF' },
  mappedAssets: { name: 'barcode-scan', color: '#0F9B8E', bg: '#E6F7F4' },
  workZone: { name: 'monitor', color: '#0B356E', bg: '#EEF2FF' },
  speakUp: { name: 'bullhorn', color: '#E85A1A', bg: '#FFEFE6' },
  vendors: { name: 'account-group', color: '#1E8BE0', bg: '#EAF3FF' },
};

export function IndustrialIconBadge({ kind, delay = 0 }: { kind: IndustrialModule; delay?: number }) {
  const motion = useRef(new Animated.Value(0)).current;
  const icon = icons[kind];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: 1,
          duration: 1100,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, motion]);

  const scale = motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Animated.View style={[styles.wrap, { backgroundColor: icon.bg, transform: [{ scale }] }]}>
      <MaterialCommunityIcons name={icon.name} size={16} color={icon.color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
