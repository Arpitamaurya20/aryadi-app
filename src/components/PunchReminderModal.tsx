import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatReminderTime } from '../storage/punchReminder';
import { Brand } from '../theme/colors';

const Navy = '#0B356E';
const Sky = '#1E8BE0';
const Ink = '#0F172A';
const Slate = '#64748B';

type PunchReminderModalProps = {
  time: string | null;
  onPunchIn: () => void;
  onDismiss: () => void;
};

export function PunchReminderModal({ time, onPunchIn, onDismiss }: PunchReminderModalProps) {
  return (
    <Modal visible={Boolean(time)} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.glow} />
            <View style={styles.bellRing}>
              <View style={styles.bell}>
                <MaterialCommunityIcons name="bell-ring" size={34} color={Navy} />
              </View>
            </View>
            <Text style={styles.time}>{time ? formatReminderTime(time) : ''}</Text>
            <Text style={styles.heroLabel}>Punch-in reminder</Text>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.title}>Time to punch in</Text>
            <Text style={styles.text}>You haven't marked your attendance yet. Punch in now to record today's attendance.</Text>

            <Pressable
              onPress={onPunchIn}
              style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityLabel="Punch in now"
            >
              <LinearGradient colors={[Navy, Sky]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryFill}>
                <MaterialCommunityIcons name="fingerprint" size={20} color={Brand.white} />
                <Text style={styles.primaryText}>Punch in now</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss reminder"
            >
              <Text style={styles.secondaryText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 24, overflow: 'hidden', backgroundColor: Brand.white },
  hero: { alignItems: 'center', paddingTop: 26, paddingBottom: 20, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -90,
    right: -60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bellRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: { width: 66, height: 66, borderRadius: 33, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' },
  time: { marginTop: 12, color: Brand.white, fontSize: 30, lineHeight: 38, fontFamily: 'Poppins_700Bold' },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: 'Poppins_600SemiBold' },
  body: { padding: 20, alignItems: 'center' },
  title: { color: Ink, fontSize: 19, fontFamily: 'Poppins_700Bold' },
  text: { marginTop: 4, color: Slate, fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: 'Poppins_400Regular' },
  primary: { marginTop: 18, alignSelf: 'stretch', borderRadius: 14, overflow: 'hidden' },
  primaryFill: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: Brand.white, fontSize: 15, fontFamily: 'Poppins_700Bold' },
  secondary: { marginTop: 8, alignSelf: 'stretch', height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  secondaryText: { color: '#334155', fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
});
