import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

// ponytail: count-based LRU; switch to a byte budget if large photo cards pile up in memory.
const MAX_IMAGES = 48;
const pending = new Map<string, Promise<SkImage | null>>();
const decoded = new Map<string, SkImage | null>();

/** Decodes a local or remote image once and shares it across every card that shows it. */
export function loadSkImage(uri: string): Promise<SkImage | null> {
  const existing = pending.get(uri);
  if (existing) {
    // Refresh recency.
    pending.delete(uri);
    pending.set(uri, existing);
    return existing;
  }
  const promise = Skia.Data.fromURI(uri)
    .then((data) => Skia.Image.MakeImageFromEncoded(data))
    .catch(() => null)
    .then((image) => {
      decoded.set(uri, image);
      if (image === null) pending.delete(uri); // let a later render retry
      return image;
    });
  pending.set(uri, promise);
  if (pending.size > MAX_IMAGES) {
    const oldest = pending.keys().next().value as string;
    pending.delete(oldest);
    decoded.delete(oldest);
  }
  return promise;
}

/** The decoded image for `uri`, or null while loading / on failure. */
export function useSkImage(uri: string | null): SkImage | null {
  const [state, setState] = useState<{ uri: string | null; image: SkImage | null }>(() => ({
    uri,
    image: uri ? (decoded.get(uri) ?? null) : null,
  }));

  useEffect(() => {
    if (!uri) return;
    let alive = true;
    loadSkImage(uri).then((image) => alive && setState({ uri, image }));
    return () => {
      alive = false;
    };
  }, [uri]);

  if (!uri) return null;
  // Recycled list cells: never show the previous uri's image.
  return state.uri === uri ? state.image : (decoded.get(uri) ?? null);
}
