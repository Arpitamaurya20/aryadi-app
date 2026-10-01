import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand } from '../theme/colors';

const Navy = '#0B356E';
const Sky = '#0284C7';
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** YYYY-MM-DD */
export function toIsoDate(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatDisplayDate(value: string) {
  const date = parseIsoDate(value);
  if (!date) return '';
  return `${String(date.getDate()).padStart(2, '0')} ${monthNames[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
}

function buildMonth(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= last.getDate(); day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

type DateCalendarModalProps = {
  visible: boolean;
  title: string;
  /** YYYY-MM-DD or empty */
  value: string;
  /** YYYY-MM-DD; earlier days are disabled */
  minDate?: string;
  /** YYYY-MM-DD; later days are disabled */
  maxDate?: string;
  onClose: () => void;
  onSelect: (isoDate: string) => void;
  onClear?: () => void;
};

export function DateCalendarModal({ visible, title, value, minDate, maxDate, onClose, onSelect, onClear }: DateCalendarModalProps) {
  const initial = parseIsoDate(value) ?? parseIsoDate(minDate) ?? new Date();
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  useEffect(() => {
    if (!visible) return;
    const next = parseIsoDate(value) ?? parseIsoDate(minDate) ?? new Date();
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [visible, value, minDate]);

  const days = useMemo(() => buildMonth(cursor), [cursor]);
  const todayIso = toIsoDate(new Date());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close calendar">
              <MaterialCommunityIcons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          <View style={styles.monthRow}>
            <Pressable
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              hitSlop={10}
              style={styles.monthBtn}
              accessibilityLabel="Previous month"
            >
              <MaterialCommunityIcons name="chevron-left" size={22} color={Navy} />
            </Pressable>
            <Text style={styles.monthTitle}>
              {monthNames[cursor.getMonth()]} {cursor.getFullYear()}
            </Text>
            <Pressable
              onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              hitSlop={10}
              style={styles.monthBtn}
              accessibilityLabel="Next month"
            >
              <MaterialCommunityIcons name="chevron-right" size={22} color={Navy} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((day, index) => {
              const iso = day ? toIsoDate(day) : '';
              const disabled = !day || Boolean(minDate && iso < minDate) || Boolean(maxDate && iso > maxDate);
              const selected = Boolean(day && iso === value);
              const today = iso === todayIso;
              return (
                <Pressable
                  key={index}
                  disabled={disabled}
                  onPress={() => onSelect(iso)}
                  style={[styles.dayCell, selected && styles.daySelected, !selected && today && styles.dayToday]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selected && styles.dayTextSelected,
                      disabled && day ? styles.dayTextDisabled : null,
                    ]}
                  >
                    {day ? day.getDate() : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            {onClear ? (
              <Pressable onPress={onClear} style={styles.footerBtn} accessibilityRole="button">
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => onSelect(todayIso)}
              disabled={Boolean((minDate && todayIso < minDate) || (maxDate && todayIso > maxDate))}
              style={styles.footerBtn}
              accessibilityRole="button"
            >
              <Text style={styles.todayText}>Today</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { color: Navy, fontSize: 16, fontFamily: 'Poppins_600SemiBold' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  monthTitle: { color: Navy, fontSize: 15, fontFamily: 'Poppins_600SemiBold' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', color: '#94A3B8', fontSize: 12, fontFamily: 'Poppins_500Medium' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  daySelected: { backgroundColor: Sky },
  dayToday: { borderWidth: 1, borderColor: Sky },
  dayText: { color: '#1E293B', fontSize: 13, fontFamily: 'Poppins_500Medium' },
  dayTextSelected: { color: Brand.white, fontFamily: 'Poppins_700Bold' },
  dayTextDisabled: { color: '#CBD5E1' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  footerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  clearText: { color: '#E11D48', fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  todayText: { color: Sky, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
});
