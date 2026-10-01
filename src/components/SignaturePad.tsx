import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Point = { x: number; y: number };

export type SignaturePadHandle = {
  clear: () => void;
  hasInk: () => boolean;
  toJpegBase64: () => string;
};

type SignaturePadProps = {
  onInkChange?: (hasInk: boolean) => void;
  onDrawStart?: () => void;
  onDrawEnd?: () => void;
  style?: StyleProp<ViewStyle>;
};

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { onInkChange, onDrawStart, onDrawEnd, style },
  ref,
) {
  const strokesRef = useRef<Point[][]>([]);
  const sizeRef = useRef({ width: 0, height: 168 });
  const callbacks = useRef({ onInkChange, onDrawStart, onDrawEnd });
  callbacks.current = { onInkChange, onDrawStart, onDrawEnd };
  const [paths, setPaths] = useState<string[]>([]);
  const [width, setWidth] = useState(0);

  function publish() {
    setPaths(strokesRef.current.map(strokeToPath).filter(Boolean));
    callbacks.current.onInkChange?.(strokesRef.current.some((stroke) => stroke.length > 0));
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        callbacks.current.onDrawStart?.();
        const { locationX, locationY } = event.nativeEvent;
        strokesRef.current = [...strokesRef.current, [{ x: locationX, y: locationY }]];
        publish();
      },
      onPanResponderMove: (event) => {
        const stroke = strokesRef.current[strokesRef.current.length - 1];
        if (!stroke) return;
        const { locationX, locationY } = event.nativeEvent;
        stroke.push({ x: locationX, y: locationY });
        publish();
      },
      onPanResponderRelease: () => callbacks.current.onDrawEnd?.(),
      onPanResponderTerminate: () => callbacks.current.onDrawEnd?.(),
    }),
  ).current;

  useImperativeHandle(ref, () => ({
    clear: () => {
      strokesRef.current = [];
      setPaths([]);
      callbacks.current.onInkChange?.(false);
    },
    hasInk: () => strokesRef.current.some((stroke) => stroke.length > 0),
    toJpegBase64: () => strokesToJpegBase64(strokesRef.current, sizeRef.current.width, sizeRef.current.height),
  }));

  return (
    <View
      accessible
      accessibilityLabel="Signature"
      style={[styles.box, style]}
      onLayout={(event) => {
        const next = {
          width: Math.round(event.nativeEvent.layout.width),
          height: Math.round(event.nativeEvent.layout.height),
        };
        sizeRef.current = next;
        setWidth(next.width);
      }}
      {...responder.panHandlers}
    >
      {width > 0 ? (
        <Svg width={width} height={168} style={styles.ink}>
          {paths.map((d, index) => (
            <Path key={`${index}-${d.length}`} d={d} stroke="#1A1A1A" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
      ) : null}
    </View>
  );
});

function strokeToPath(stroke: Point[]) {
  if (stroke.length === 0) return '';
  const [first, ...rest] = stroke;
  const line = rest.map((point) => ` L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join('');
  return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}${line}`;
}

function strokesToJpegBase64(strokes: Point[][], width: number, height: number) {
  if (width < 2 || height < 2 || strokes.every((stroke) => stroke.length === 0)) return '';
  if (typeof document !== 'undefined') return canvasJpeg(strokes, width, height);
  return nativeJpeg(strokes, width, height);
}

function canvasJpeg(strokes: Point[][], width: number, height: number) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.scale(scale, scale);
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#1A1A1A';
  context.lineWidth = 2.4;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    context.beginPath();
    context.moveTo(stroke[0].x, stroke[0].y);
    if (stroke.length === 1) context.lineTo(stroke[0].x + 0.2, stroke[0].y);
    else stroke.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }
  return canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, '');
}

function nativeJpeg(strokes: Point[][], width: number, height: number) {
  const { Buffer } = require('buffer') as typeof import('buffer');
  const host = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  if (!host.Buffer) host.Buffer = Buffer;
  const { encode } = require('jpeg-js') as {
    encode: (image: { data: Uint8Array; width: number; height: number }, quality?: number) => { data: { toString: (encoding: 'base64') => string } };
  };
  const pixels = new Uint8Array(width * height * 4);
  pixels.fill(255);
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      drawSegment(pixels, width, height, stroke[index - 1], stroke[index]);
    }
    if (stroke.length === 1) drawDisk(pixels, width, height, stroke[0].x, stroke[0].y, 2);
  }
  return encode({ data: pixels, width, height }, 80).data.toString('base64');
}

function drawSegment(pixels: Uint8Array, width: number, height: number, from: Point, to: Point) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    drawDisk(pixels, width, height, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, 2);
  }
}

function drawDisk(pixels: Uint8Array, width: number, height: number, x: number, y: number, radius: number) {
  const left = Math.max(0, Math.floor(x - radius));
  const right = Math.min(width - 1, Math.ceil(x + radius));
  const top = Math.max(0, Math.floor(y - radius));
  const bottom = Math.min(height - 1, Math.ceil(y + radius));
  for (let py = top; py <= bottom; py += 1) {
    for (let px = left; px <= right; px += 1) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy > radius * radius) continue;
      const offset = (py * width + px) * 4;
      pixels[offset] = 26;
      pixels[offset + 1] = 26;
      pixels[offset + 2] = 26;
      pixels[offset + 3] = 255;
    }
  }
}

const styles = StyleSheet.create({
  ink: { pointerEvents: 'none' },
  box: {
    height: 168,
    borderWidth: 1,
    borderColor: '#3E6A78',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
});
