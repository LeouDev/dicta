import { Linking } from 'react-native';

import { excerpt, sharePostTo, shareToStories } from '../share';

const mockSetItem = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('expo', () => {
  const expo = jest.requireActual('expo');
  const pasteboard = { setItem: (...args: unknown[]) => mockSetItem(...args) };
  return { ...expo, requireOptionalNativeModule: (name: string) => (name === 'Pasteboard' ? pasteboard : expo.requireOptionalNativeModule(name)) };
});

// Its native classes don't exist under Jest; saving isn't tested here.
jest.mock('expo-media-library', () => ({}));

const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
const images = { sticker: new Uint8Array([1]), background: new Uint8Array([2]) };

beforeEach(() => jest.clearAllMocks());

it('puts the sticker, background, app ID and post link on the pasteboard, then opens Instagram Stories', async () => {
  await shareToStories('instagram', images, 'p1');
  expect(mockSetItem).toHaveBeenCalledWith(
    { 'com.instagram.sharedSticker.appID': '1083001631397605', 'public.utf8-plain-text': 'https://dicta-orcin.vercel.app/post/p1' },
    { 'com.instagram.sharedSticker.stickerImage': images.sticker, 'com.instagram.sharedSticker.backgroundImage': images.background },
    300,
  );
  expect(openURL).toHaveBeenCalledWith('instagram-stories://share?source_application=1083001631397605');
  expect(mockSetItem.mock.invocationCallOrder[0]).toBeLessThan(openURL.mock.invocationCallOrder[0]);
});

it('uses Facebook’s own keys, and a draft has no link to share', async () => {
  await shareToStories('facebook', images);
  expect(mockSetItem).toHaveBeenCalledWith(
    { 'com.facebook.sharedSticker.appID': '1083001631397605' },
    { 'com.facebook.sharedSticker.stickerImage': images.sticker, 'com.facebook.sharedSticker.backgroundImage': images.background },
    300,
  );
  expect(openURL).toHaveBeenCalledWith('facebook-stories://share');
});

it('opens a Threads or X post with the quote and the post’s link', async () => {
  const params = (url: string) => Object.fromEntries(url.split('?')[1].split('&').map((pair) => pair.split('=').map(decodeURIComponent)));
  await sharePostTo('threads', 'p1', 'Stay soft & kind.\n\nIt’s a strength.');
  await sharePostTo('x', 'p1', 'Stay soft.');
  const [threads, x] = openURL.mock.calls.map(([url]) => url);
  expect(threads.startsWith('https://www.threads.com/intent/post?')).toBe(true);
  expect(params(threads)).toEqual({ text: '“Stay soft & kind.\n\nIt’s a strength.”', url: 'https://dicta-orcin.vercel.app/post/p1' });
  expect(x.startsWith('https://x.com/intent/tweet?')).toBe(true);
  expect(params(x).text).toBe('“Stay soft.”');
});

it('shortens long quotes at a word, never through an emoji', () => {
  expect(excerpt('  short  ', 200)).toBe('short');
  expect(excerpt('one two three four', 12)).toBe('one two…');
  const emoji = excerpt('🌙'.repeat(300), 200);
  expect(Array.from(emoji)).toHaveLength(200);
  expect(() => encodeURIComponent(emoji)).not.toThrow();
});
