import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_WIDTH = 1600;
const draftsDir = () => new Directory(Paths.document, 'draft-photos');

/**
 * Lets the person pick a background photo, downscales it to what an export
 * needs, and stores it next to the draft (the picker's cache copy can vanish).
 * Returns a file:// URI, or null if cancelled.
 */
export async function pickBackgroundPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH });
  const saved = await (await context.renderAsync()).saveAsync({ compress: 0.86, format: SaveFormat.JPEG });

  const dir = draftsDir();
  dir.create({ intermediates: true, idempotent: true });
  const destination = new File(dir, `${Crypto.randomUUID()}.jpg`);
  await new File(saved.uri).copy(destination);
  return destination.uri;
}

/** Deletes draft photos other than `keep` (after publishing, discarding, or replacing). */
export function clearDraftPhotos(keep?: string | null) {
  const dir = draftsDir();
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    if (entry instanceof File && entry.uri !== keep) entry.delete();
  }
}
