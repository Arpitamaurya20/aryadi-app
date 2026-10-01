export type Tone = { color: string; tint: string };

const typeTones: Record<string, Tone> = {
  'R&M': { color: '#7C3AED', tint: '#F3EEFF' },
  AMC: { color: '#B45309', tint: '#FFF7E6' },
  Supply: { color: '#4338CA', tint: '#EEF0FF' },
  Projects: { color: '#0F766E', tint: '#E8F8F5' },
  'Home Care': { color: '#DB2777', tint: '#FDF0F7' },
};

export function typeTone(type: string): Tone {
  return typeTones[type] ?? { color: '#0B356E', tint: '#EEF2F8' };
}

export function statusTone(status: string): Tone {
  const key = status.toLowerCase();
  if (key === 'escalated') return { color: '#DC2626', tint: '#FEF2F2' };
  if (key === 'closed' || key === 'completed' || key === 'paid') return { color: '#059669', tint: '#E7F7F0' };
  if (key.startsWith('cancel') || key.includes('reject')) return { color: '#64748B', tint: '#F1F5F9' };
  if (key.includes('progress') || key.includes('partial')) return { color: '#C2410C', tint: '#FFF7ED' };
  if (key.includes('approved')) return { color: '#0F766E', tint: '#F0FDFA' };
  if (key.includes('quote')) return { color: '#7C3AED', tint: '#F5F3FF' };
  if (key.includes('hold') || key === 'pending') return { color: '#B45309', tint: '#FFFBEB' };
  if (key.includes('closure')) return { color: '#4338CA', tint: '#EEF2FF' };
  return { color: '#1E8BE0', tint: '#E8F3FD' };
}
