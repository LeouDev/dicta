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

type Part = 'text' | 'header' | 'photo';

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
 * - drag the text or the header to move it, or anywhere else to choose what a photo shows,
 * - pinch the text or the header to resize it, or anywhere else to zoom a photo,
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
  const place = (part: Exclude<Part, 'photo'>, x: number, y: number) => update(part === 'text' ? { textOffset: { x: x / s, y: y / s } } : { headerOffset: { x: x / s, y: y / s } });
  const frameAs = (next: { zoom: number; panX: number; panY: number }) => update({ background: next });
  const resize = (part: Exclude<Part, 'photo'>, value: number) => update(part === 'text' ? { size: value } : { header: { scale: value } });

  const boxes = layout?.boxes ?? { text: null, header: null };
  const edge = EDGE * s;
  const isPhoto = design.background.type === 'image' && photo !== null;
  const wordsAt = (x: number, y: number) => {
    'worklet';
    return inside(boxes.header, headerShift.get(), x, y) ? 'header' : inside(boxes.text, textShift.get(), x, y) ? 'text' : null;
  };
  const dragging = useSharedValue<Part | null>(null);
  const from = useSharedValue<Point>({ x: 0, y: 0 });
  const down = useSharedValue<Point>({ x: 0, y: 0 });
  // How far the finger went before iOS called it a drag, which its translation leaves out.
  const lag = useSharedValue<Point>({ x: 0, y: 0 });
  const pinched = useSharedValue(false);
  // A drag moves what the finger lands on: the header, the text, or else the photo.
  const drag = Gesture.Pan()
    .averageTouches(true)
    .onBegin((e) => {
      dragging.set(wordsAt(e.x, e.y) ?? (isPhoto ? 'photo' : null));
      down.set({ x: e.x, y: e.y });
      pinched.set(false);
    })
    .onStart((e) => {
      lag.set({ x: e.x - down.get().x - e.translationX, y: e.y - down.get().y - e.translationY });
      const part = dragging.get();
      if (part === 'photo') from.set({ x: view.get().panX, y: view.get().panY });
      else if (part) {
        from.set(part === 'text' ? textShift.get() : headerShift.get());
        runOnJS(pickUp)();
      }
    })
    .onUpdate((e) => {
      const part = dragging.get();
      const start = from.get();
      const dx = e.translationX + lag.get().x;
      const dy = e.translationY + lag.get().y;
      if (part === 'photo') {
        const v = view.get();
        // The room the photo has to move at this zoom: pan ±1 reaches its edges.
        const centered = photoRect(image, size, v.zoom, 0, 0);
        const roomX = -centered.x;
        const roomY = -centered.y;
        view.set({
          ...v,
          panX: roomX > 0 ? clamp(start.x + dx / roomX, -1, 1) : 0,
          panY: roomY > 0 ? clamp(start.y + dy / roomY, -1, 1) : 0,
        });
        return;
      }
      const box = part === 'text' ? boxes.text : part === 'header' ? boxes.header : null;
      // Two fingers are a pinch: the words stay where they are until the fingers lift.
      if (e.numberOfPointers > 1) pinched.set(true);
      if (!box || pinched.get()) return;
      (part === 'text' ? textShift : headerShift).set({
        x: keepOnCard(start.x + dx, box.x, box.width, size.width, edge),
        y: keepOnCard(start.y + dy, box.y, box.height, size.height, edge),
      });
    })
    .onEnd(() => {
      const part = dragging.get();
      if (part === 'photo') runOnJS(frameAs)(view.get());
      else if (part) {
        const at = (part === 'text' ? textShift : headerShift).get();
        runOnJS(place)(part, at.x, at.y);
      }
    })
    .onFinalize(() => dragging.set(null));

  // A pinch resizes what it's on: the name, the words, or else a photo (zoomed; two
  // fingers pan it too, through the drag). With no photo, it resizes the words.
  const textSize = design.size;
  const headerScale = design.header.scale;
  const pinching = useSharedValue<Part>('text');
  const sizeFrom = useSharedValue(1);
  const sizeNow = useSharedValue(1);
  const pinch = Gesture.Pinch()
    .onStart((e) => {
      const part = wordsAt(e.focalX, e.focalY) ?? (isPhoto ? 'photo' : 'text');
      pinching.set(part);
      sizeFrom.set(part === 'photo' ? view.get().zoom : part === 'header' ? headerScale : textSize);
      sizeNow.set(sizeFrom.get());
    })
    .onUpdate((e) => {
      const part = pinching.get();
      if (part === 'photo') {
        view.set({ ...view.get(), zoom: clamp(sizeFrom.get() * e.scale, DESIGN_LIMITS.zoom.min, DESIGN_LIMITS.zoom.max) });
        return;
      }
      const limits = part === 'header' ? DESIGN_LIMITS.headerScale : DESIGN_LIMITS.size;
      // Whole units (hundredths for the name), so the card lays out again only when the size really changes.
      const steps = part === 'header' ? 100 : 1;
      const next = Math.round(clamp(sizeFrom.get() * e.scale, limits.min, limits.max) * steps) / steps;
      if (next === sizeNow.get()) return;
      sizeNow.set(next);
      runOnJS(resize)(part, next);
    })
    .onEnd(() => {
      if (pinching.get() === 'photo') runOnJS(frameAs)(view.get());
    });

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(onEditText)();
  });

  // Pinching works alongside a drag; a tap is only a tap when nothing was pinched or dragged.
  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pinch, drag), tap);

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
