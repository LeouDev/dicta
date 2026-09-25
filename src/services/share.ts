import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

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
