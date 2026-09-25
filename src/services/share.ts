import { requireOptionalNativeModule } from 'expo';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

import { postLink } from './web';

export class PermissionError extends Error {}

/** Saves an exported card to Photos (asks for add-only access, never read access). */
export async function saveImageToPhotos(uri: string) {
  const { granted } = await MediaLibrary.requestPermissionsAsync(true);
  if (!granted) throw new PermissionError('Allow Dicta to add photos in Settings to save images.');
  await MediaLibrary.Asset.create(uri);
}

export function shareImage(uri: string) {
  return Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your card' });
}

export async function copyPostLink(postId: string) {
  await Clipboard.setStringAsync(postLink(postId));
}

/** Dicta's app ID at Meta (developers.facebook.com). Stories need it to credit the app; it's public, not a secret. */
const META_APP_ID = '1083001631397605';

/** modules/pasteboard: iOS only. */
const Pasteboard = requireOptionalNativeModule<{
  setItem(strings: Record<string, string>, data: Record<string, Uint8Array>, seconds: number): Promise<void>;
}>('Pasteboard');

const STORIES = {
  instagram: { url: `instagram-stories://share?source_application=${META_APP_ID}`, key: 'com.instagram.sharedSticker' },
  facebook: { url: 'facebook-stories://share', key: 'com.facebook.sharedSticker' },
};
export type StoriesApp = keyof typeof STORIES;

/** Whether the app is installed (and this is the iOS app). */
export async function canShareToStories(app: StoriesApp) {
  return Pasteboard !== null && Linking.canOpenURL(STORIES[app].url);
}

/**
 * Opens the app's story editor with `sticker` over `background` (encoded
 * images), the way Apple Music shares songs. A post's link goes along as
 * text, ready to paste into a Link sticker.
 */
export async function shareToStories(app: StoriesApp, images: { sticker: Uint8Array; background: Uint8Array }, postId?: string) {
  if (!Pasteboard) throw new Error('Sharing to Stories needs the iOS app.');
  const { url, key } = STORIES[app];
  const strings: Record<string, string> = { [`${key}.appID`]: META_APP_ID };
  if (postId) strings['public.utf8-plain-text'] = postLink(postId);
  // Meta's docs keep the items for five minutes.
  await Pasteboard.setItem(strings, { [`${key}.stickerImage`]: images.sticker, [`${key}.backgroundImage`]: images.background }, 5 * 60);
  await Linking.openURL(url);
}

const INTENTS = {
  threads: 'https://www.threads.com/intent/post',
  x: 'https://x.com/intent/tweet',
};
export type PostApp = keyof typeof INTENTS;

/** A new Threads or X post with the quote and the post's link, whose preview shows the card. Their app opens when installed. */
export function sharePostTo(app: PostApp, postId: string, quote: string) {
  const text = `“${excerpt(quote, 200)}”`;
  return Linking.openURL(`${INTENTS[app]}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postLink(postId))}`);
}

/** At most `max` characters, cut at a word, never through an emoji (a split one would break the link). */
export function excerpt(text: string, max: number) {
  const chars = Array.from(text.trim());
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('').replace(/\s+\S*$/, '')}…`;
}
