import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TicketKind = 'corporateHome' | 'ppm' | 'audit';

const LogoNavy = '#0B356E';
const LogoMid = '#1E8BE0';
const SafetyYellow = '#F5C400';
const SafetyOrange = '#FF6A2A';
const HomeGreen = '#15803D';
const AuditAmber = '#D97706';

function CorporateHomeGlyph() {
  return (
    <Svg width={34} height={30} viewBox="0 0 120 100">
      <Rect x="6" y="42" width="20" height="48" rx="3" fill={LogoNavy} />
      <Rect x="24" y="20" width="24" height="70" rx="3" fill={LogoMid} />
      {[0, 1].map((col) =>
        [0, 1, 2].map((row) => (
          <Rect
            key={`${col}-${row}`}
            x={28 + col * 8}
            y={28 + row * 14}
            width="5"
            height="7"
            rx="1.2"
            fill="rgba(255,255,255,0.9)"
          />
        ))
      )}
      <Rect x="32" y="8" width="4" height="12" fill={SafetyOrange} />
      <Rect x="39" y="4" width="4" height="16" fill={SafetyOrange} />
      <Path d="M58 52 L86 26 L114 52 L114 88 L58 88 Z" fill={HomeGreen} />
      <Path d="M86 26 L114 52 L106 52 L86 34 L66 52 L58 52 Z" fill={LogoNavy} />
      <Rect x="80" y="62" width="12" height="26" rx="2" fill="#FFFFFF" />
      <Rect x="66" y="60" width="10" height="10" rx="2" fill="#D7EEFB" />
      <Rect x="96" y="60" width="10" height="10" rx="2" fill="#D7EEFB" />
    </Svg>
  );
}

function PpmGlyph() {
  return (
    <Svg width={30} height={30} viewBox="0 0 100 100">
      <Circle cx="64" cy="36" r="22" fill={LogoMid} />
      <Circle cx="64" cy="36" r="10" fill="#FFFFFF" />
      <Circle cx="64" cy="36" r="5" fill={LogoNavy} />
      {[0, 45, 90, 135].map((deg) => (
        <Rect
          key={deg}
          x="61"
          y="10"
          width="6"
          height="12"
          rx="2"
          fill={LogoNavy}
          transform={`rotate(${deg} 64 36)`}
        />
      ))}
      <Path
        d="M18 78 L42 54 L52 64 L28 88 C24 92 16 86 18 78 Z"
        fill={SafetyYellow}
      />
      <Path d="M38 50 L54 66 L60 60 L44 44 Z" fill={LogoNavy} />
      <Circle cx="22" cy="82" r="6" fill={SafetyOrange} />
    </Svg>
  );
}

function AuditGlyph() {
  return (
    <Svg width={30} height={30} viewBox="0 0 100 100">
      <Rect x="24" y="14" width="52" height="72" rx="8" fill={AuditAmber} />
      <Rect x="30" y="22" width="40" height="56" rx="5" fill="#FFF7EA" />
      <Rect x="38" y="8" width="24" height="14" rx="4" fill={LogoNavy} />
      <Path
        d="M40 50 L48 58 L64 40"
        stroke={HomeGreen}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x="38" y="66" width="24" height="5" rx="2.5" fill="rgba(11,53,110,0.25)" />
    </Svg>
  );
}

const glyphs = {
  corporateHome: CorporateHomeGlyph,
  ppm: PpmGlyph,
  audit: AuditGlyph,
};

export function AnimatedTicketIcon({ kind, wash, delay = 0 }: { kind: TicketKind; wash: string; delay?: number }) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: 1,
          duration: 1500,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, motion]);

  const scale = motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const translateY = motion.interpolate({ inputRange: [0, 1], outputRange: [-2, 3] });
  const rotate = motion.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });
  const Glyph = glyphs[kind];

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }, { scale }] }]}>
      <LinearGradient colors={['#FFFFFF', wash]} style={styles.wash}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Glyph />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 56,
    height: 56,
  },
  wash: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
