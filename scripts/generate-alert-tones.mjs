// Synthesises the Aryadi Chime alert sound in assets/sounds. Run: node scripts/generate-alert-tones.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SampleRate = 24000;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

function note(name) {
  const match = /^([A-G])(#?)(\d)$/.exec(name);
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[match[1]] + (match[2] ? 1 : 0) + (Number(match[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
}

function envelope(t, attack, decay) {
  if (t < 0) return 0;
  const rise = t < attack ? t / attack : 1;
  return rise * Math.exp(-t / decay);
}

/** Each voice returns a sample for time t (seconds) since the note started. */
const voices = {
  bell: (f) => (t) =>
    [
      [1, 1, 0.9],
      [2, 0.45, 0.55],
      [2.76, 0.3, 0.4],
      [5.4, 0.12, 0.18],
    ].reduce((sum, [ratio, amp, decay]) => sum + amp * envelope(t, 0.004, decay) * Math.sin(2 * Math.PI * f * ratio * t), 0),
};

/** [voice, note or Hz, start seconds, gain, extra voice arg] */
const tones = {
  'aryadi-chime': [1.8, [['bell', 'E5', 0], ['bell', 'B5', 0.2]]],
};

function render(length, events) {
  const total = Math.round(length * SampleRate);
  const data = new Float64Array(total);
  for (const [voice, pitch, start, gain = 1, arg] of events) {
    const f = typeof pitch === 'number' ? pitch : note(pitch);
    const play = voices[voice](f, arg);
    for (let i = Math.floor(start * SampleRate); i < total; i += 1) data[i] += gain * play(i / SampleRate - start);
  }
  const fadeOut = Math.round(0.05 * SampleRate);
  for (let i = 0; i < fadeOut; i += 1) data[total - 1 - i] *= i / fadeOut;
  const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0) || 1;
  return data.map((value) => (value / peak) * 0.82);
}

function wav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SampleRate, 24);
  buffer.writeUInt32LE(SampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  return buffer;
}

mkdirSync(outDir, { recursive: true });
for (const [id, [length, events]] of Object.entries(tones)) {
  const file = join(outDir, `${id}.wav`);
  writeFileSync(file, wav(render(length, events)));
  console.log(`${id}.wav`);
}
