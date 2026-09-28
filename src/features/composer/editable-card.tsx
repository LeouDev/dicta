import { Canvas, type Transforms3d } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { useCardFonts } from '@/features/quote-card/fonts';
import { EDGE, cardSize, keepOnCard, photoRect, showsAvatar, unitScale, type Box } from '@/features/quote-card/geometry';
import { useSkImage } from '@/features/quote-card/images';
import { layoutCard } from '@/features/quote-card/layout';
import { QuoteCanvas } from '@/features/quote-card/quote-canvas';
import { DESIGN_LIMITS, type CardAuthor, type Point, type QuoteDesign } from '@/features/quote-card/types';

import { useComposer } from './store';

interface EditableCardProps {
  text: string;
  design: QuoteDesign;
  author: CardAuthor;
  width: number;
  onEditText: () => void;
}

type Part = 'text' | 'header';

/** Room around a small target (the header) that still picks it up. */
const SLOP = 12;

const inside = (box: Box | null, shift: Point, x: number, y: number) => {
  'worklet';
  return !!box && x >= box.x + shift.x - SLOP && x <= box.x + shift.x + box.width + SLOP && y >= box.y + shift.y - SLOP && y <= box.y + shift.y + box.height + SLOP;
};
const clamp = (v: number, min: number, max: number) => {
  'worklet';
  return Math.min(max, Math.max(min, v));
};

/**
 * The editor's card: the same layout and canvas as QuoteCard, and
 * - hold and drag the text or the header to move it,
 * - pinch a photo background to zoom it, drag it to choose what shows,
 * - tap to edit the text.
 * Moves follow the finger on the UI thread and are saved when it lifts.
 */
export function EditableCard({ text, design, author, width, onEditText }: EditableCardProps) {
  const update = useComposer((s) => s.update);
  const fonts = useCardFonts();
  const size = cardSize('original', design.canvas, width);
  const s = unitScale(width);
  const avatar = useSkImage(showsAvatar(design) ? author.avatarUrl : null);
  const photo = useSkImage(design.background.type === 'image' ? design.background.image : null);

  const { displayName, username, isVerified, avatarUrl } = author;
  const layout = useMemo(
    () => (fonts ? layoutCard({ text, design, author: { displayName, username, isVerified, avatarUrl }, width, fonts }) : null),
    [fonts, text, design, displayName, username, isVerified, avatarUrl, width],
  );

  // Where the text and header are drawn, and how the photo is framed: the saved
  // design, or the finger while it's down.
  const textShift = useSharedValue<Point>({ x: 0, y: 0 });
  const headerShift = useSharedValue<Point>({ x: 0, y: 0 });
  const { zoom, panX, panY } = design.background;
  const view = useSharedValue({ zoom, panX, panY });
  useEffect(() => {
    if (!layout) return;
    textShift.set(layout.shift.text);
    headerShift.set(layout.shift.header);
  }, [layout, textShift, headerShift]);
  useEffect(() => view.set({ zoom, panX, panY }), [zoom, panX, panY, view]);

  const textTransform = useDerivedValue<Transforms3d>(() => [{ translateX: textShift.get().x }, { translateY: textShift.get().y }]);
  const headerTransform = useDerivedValue<Transforms3d>(() => [{ translateX: headerShift.get().x }, { translateY: headerShift.get().y }]);
  const image = { width: photo?.width() ?? 1, height: photo?.height() ?? 1 };
  const frame = useDerivedValue(() => photoRect(image, size, view.get().zoom, view.get().panX, view.get().panY));
  const photoX = useDerivedValue(() => frame.get().x);
  const photoY = useDerivedValue(() => frame.get().y);
  const photoWidth = useDerivedValue(() => frame.get().width);
  const photoHeight = useDerivedValue(() => frame.get().height);

  const pickUp = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const place = (part: Part, x: number, y: number) => update(part === 'text' ? { textOffset: { x: x / s, y: y / s } } : { headerOffset: { x: x / s, y: y / s } });
  const frameAs = (next: { zoom: number; panX: number; panY: number }) => update({ background: next });

  const boxes = layout?.boxes ?? { text: null, header: null };
  const edge = EDGE * s;
  const dragging = useSharedValue<Part | null>(null);
  const from = useSharedValue<Point>({ x: 0, y: 0 });
  const move = Gesture.Pan()
    .activateAfterLongPress(300)
    // One finger: two are always a pinch, even when they rest a moment first.
    .maxPointers(1)
    .onStart((e) => {
      const header = headerShift.get();
      const body = textShift.get();
      const part = inside(boxes.header, header, e.x, e.y) ? 'header' : inside(boxes.text, body, e.x, e.y) ? 'text' : null;
      dragging.set(part);
      if (!part) return;
      from.set(part === 'text' ? body : header);
      runOnJS(pickUp)();
    })
    .onUpdate((e) => {
      const part = dragging.get();
      const box = part === 'text' ? boxes.text : part === 'header' ? boxes.header : null;
      if (!box) return;
      const start = from.get();
      const next = {
        x: keepOnCard(start.x + e.translationX, box.x, box.width, size.width, edge),
        y: keepOnCard(start.y + e.translationY, box.y, box.height, size.height, edge),
      };
      (part === 'text' ? textShift : headerShift).set(next);
    })
    .onEnd(() => {
      const part = dragging.get();
      if (!part) return;
      const at = (part === 'text' ? textShift : headerShift).get();
      dragging.set(null);
      runOnJS(place)(part, at.x, at.y);
    });

  // Photo backgrounds: pinch to zoom, drag to choose which part shows.
  const isPhoto = design.background.type === 'image' && photo !== null;
  const zoomFrom = useSharedValue(1);
  const panFrom = useSharedValue<Point>({ x: 0, y: 0 });
  const pinch = Gesture.Pinch()
    .enabled(isPhoto)
    .onStart(() => zoomFrom.set(view.get().zoom))
    .onUpdate((e) => view.set({ ...view.get(), zoom: clamp(zoomFrom.get() * e.scale, DESIGN_LIMITS.zoom.min, DESIGN_LIMITS.zoom.max) }))
    .onEnd(() => runOnJS(frameAs)(view.get()));
  const pan = Gesture.Pan()
    .enabled(isPhoto)
    .averageTouches(true)
    .onStart(() => panFrom.set({ x: view.get().panX, y: view.get().panY }))
    .onUpdate((e) => {
      const v = view.get();
      // The room the photo has to move at this zoom: pan ±1 reaches its edges.
      const centered = photoRect(image, size, v.zoom, 0, 0);
      const roomX = -centered.x;
      const roomY = -centered.y;
      view.set({
        ...v,
        panX: roomX > 0 ? clamp(panFrom.get().x + e.translationX / roomX, -1, 1) : 0,
        panY: roomY > 0 ? clamp(panFrom.get().y + e.translationY / roomY, -1, 1) : 0,
      });
    })
    .onEnd(() => runOnJS(frameAs)(view.get()));

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(onEditText)();
  });

  // Two fingers always zoom the photo. One finger: a hold picks up the text or
  // header, a drag frames the photo, a tap edits.
  const gesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(move, pan, tap));

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Quote card: ${text.trim()}`}
        accessibilityHint="Double tap to edit the text"
        onAccessibilityTap={onEditText}
        style={{
          width: size.width,
          height: size.height,
          borderRadius: design.radius * s,
          overflow: 'hidden',
          backgroundColor: design.background.color,
        }}>
        {layout && (
          <Canvas style={{ width: size.width, height: size.height }} opaque>
            <QuoteCanvas
              layout={layout}
              avatar={avatar}
              backgroundImage={photo}
              live={{ text: textTransform, header: headerTransform, photo: { x: photoX, y: photoY, width: photoWidth, height: photoHeight } }}
            />
          </Canvas>
        )}
      </View>
    </GestureDetector>
  );
}
