import type { FlashListRef } from '@shopify/flash-list';
import { useScrollToTop } from 'expo-router';
import { useRef, type RefObject } from 'react';

/**
 * Tapping the current tab scrolls the list back to the top, as in any iOS app.
 * FlashList's own scrollToTop jumps, so the tab press gets an animated
 * scrollToOffset instead.
 */
export function useTabScrollToTop<T>(list: RefObject<FlashListRef<T> | null>) {
  const target = useRef({
    scrollToOffset: (params: { offset: number; animated?: boolean }) => list.current?.scrollToOffset(params),
  });
  useScrollToTop(target);
}
