import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type WorkKind =
  | 'profile'
  | 'leave'
  | 'attendance'
  | 'convenience'
  | 'history'
  | 'kpi'
  | 'helpdesk'
  | 'regularization';

const Navy = '#0B356E';
const Mid = '#1E8BE0';
const Sky = '#3AABF2';
const Yellow = '#F5C400';
const Orange = '#FF6A2A';
const Green = '#16A34A';

const washes: Record<WorkKind, [string, string]> = {
  profile: ['#E8F4FF', '#C5E4FA'],
  leave: ['#EEF7FF', '#D4ECFB'],
  attendance: ['#E6F8EE', '#C8F0D8'],
  convenience: ['#FFF6E8', '#FFE3B8'],
  history: ['#EEF3FF', '#D5E3FA'],
  kpi: ['#F3ECFF', '#E0D2FF'],
  helpdesk: ['#FFECEC', '#FFD0D0'],
  regularization: ['#EAF7FF', '#CDE8FB'],
};

function ProfileGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 100 100">
      <Circle cx="50" cy="34" r="18" fill={Mid} />
      <Path d="M18 86 C18 62 82 62 82 86 Z" fill={Navy} />
      <Circle cx="78" cy="24" r="12" fill={Yellow} />
      <Path d="M78 18 V30 M72 24 H84" stroke={Navy} strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  );
}

function LeaveGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 100 100">
      <Rect x="16" y="20" width="68" height="66" rx="12" fill={Mid} />
      <Rect x="16" y="20" width="68" height="18" rx="10" fill={Navy} />
      <Circle cx="32" cy="20" r="6" fill={Orange} />
      <Circle cx="68" cy="20" r="6" fill={Orange} />
      <Rect x="28" y="48" width="14" height="12" rx="3" fill="#FFFFFF" />
      <Rect x="48" y="48" width="14" height="12" rx="3" fill={Yellow} />
      <Rect x="68" y="48" width="10" height="12" rx="3" fill="#FFFFFF" />
      <Rect x="28" y="66" width="14" height="12" rx="3" fill={Green} />
    </Svg>
  );
}

function AttendanceGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="36" fill={Navy} />
      <Circle cx="50" cy="50" r="24" fill="#EAF5FC" />
      <Path d="M50 32 V52 L66 60" stroke={Mid} strokeWidth="7" strokeLinecap="round" fill="none" />
      <Circle cx="74" cy="76" r="16" fill={Green} />
      <Path d="M66 76 L72 82 L84 68" stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ConvenienceGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 100 100">
      <Rect x="10" y="34" width="80" height="48" rx="12" fill={Navy} />
      <Rect x="10" y="46" width="80" height="12" fill={Mid} />
      <Rect x="20" y="66" width="24" height="8" rx="3" fill={Yellow} />
      <Circle cx="72" cy="22" r="14" fill={Yellow} />
      <Path d="M72 14 V30 M64 22 H80" stroke={Navy} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

function HistoryGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 100 100">
      <Rect x="20" y="10" width="52" height="70" rx="8" fill={Sky} />
      <Rect x="26" y="18" width="40" height="54" rx="5" fill="#FFFFFF" />
      <Rect x="32" y="26" width="28" height="6" rx="3" fill={Navy} />
      <Rect x="32" y="38" width="22" height="6" rx="3" fill="rgba(11,53,110,0.35)" />
      <Circle cx="70" cy="74" r="18" fill={Navy} />
      <Path d="M70 64 V76 H80" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function KpiGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 100 100">
      <Rect x="14" y="60" width="18" height="26" rx="5" fill={Sky} />
      <Rect x="40" y="40" width="18" height="46" rx="5" fill={Mid} />
      <Rect x="66" y="18" width="18" height="68" rx="5" fill={Navy} />
      <Path d="M18 50 L42 32 L70 14" stroke={Orange} strokeWidth="7" fill="none" strokeLinecap="round" />
      <Circle cx="70" cy="14" r="7" fill={Yellow} />
    </Svg>
  );
}

function HelpdeskGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 100 100">
      <Circle cx="50" cy="40" r="20" fill={Navy} />
      <Path d="M24 40 A26 26 0 0 0 76 40" stroke={Mid} strokeWidth="12" fill="none" />
      <Rect x="18" y="40" width="14" height="24" rx="7" fill={Mid} />
      <Rect x="68" y="40" width="14" height="24" rx="7" fill={Mid} />
      <Rect x="36" y="70" width="28" height="12" rx="6" fill={Orange} />
      <Circle cx="80" cy="20" r="11" fill={Yellow} />
    </Svg>
  );
}

function RegularizationGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 100 100">
      <Rect x="12" y="22" width="54" height="62" rx="10" fill={Navy} />
      <Rect x="18" y="36" width="42" height="42" rx="6" fill="#EAF5FC" />
      <Rect x="12" y="22" width="54" height="16" rx="8" fill={Mid} />
      <Path d="M54 64 L86 32 L96 42 L64 74 L48 80 Z" fill={Orange} />
      <Path d="M82 36 L92 46" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

const glyphs = {
  profile: ProfileGlyph,
  leave: LeaveGlyph,
  attendance: AttendanceGlyph,
  convenience: ConvenienceGlyph,
  history: HistoryGlyph,
  kpi: KpiGlyph,
  helpdesk: HelpdeskGlyph,
  regularization: RegularizationGlyph,
};

export function AnimatedWorkIcon({ kind, delay = 0 }: { kind: WorkKind; delay?: number }) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: 1,
          duration: 900,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, motion]);

  const scale = motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const translateY = motion.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const rotate = motion.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });
  const Glyph = glyphs[kind];

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY }, { scale }] }]}>
      <LinearGradient colors={washes[kind]} style={styles.wash}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Glyph />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 36,
    height: 36,
  },
  wash: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
