import { profile } from '@/test-utils/fixtures';

import { updateProfile } from '../profiles';

const mockCalls: string[] = [];
const STORAGE = 'https://x.supabase.co/storage/v1/object/public/avatars/';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (path: string) => (mockCalls.push(`upload ${path.replace(/-\d+\./, '-T.')}`), Promise.resolve({ error: null })),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/avatars/${path}` } }),
        remove: (paths: string[]) => (mockCalls.push(`remove ${paths.join(', ')}`), Promise.resolve({ error: null })),
      }),
    },
    from: () => ({
      update: (row: object) => (
        mockCalls.push(`update ${Object.keys(row).join(', ')}`),
        { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }) }
      ),
    }),
  },
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({ resize: () => ({ renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///resized.jpg' }) }) }) }),
  },
}));
jest.mock('expo-file-system', () => ({ File: class { arrayBuffer = async () => new ArrayBuffer(1); } }));

const me = profile({ id: 'u1', avatar_url: `${STORAGE}u1/avatar-1.jpg`, cover_url: `${STORAGE}u1/cover-1.jpg` });
const text = { username: 'ben', displayName: 'Ben', bio: '' };

beforeEach(() => {
  mockCalls.length = 0;
});

it('uploads a new cover, saves it, then deletes the old one, leaving the photo alone', async () => {
  const saved = await updateProfile(me, { ...text, cover: 'file:///new-cover.jpg' });
  expect(mockCalls).toEqual(['upload u1/cover-T.jpg', 'update username, display_name, bio, cover_url', 'remove u1/cover-1.jpg']);
  expect(saved.cover_url).toMatch(/avatars\/u1\/cover-\d+\.jpg$/);
});

it('removing the cover clears it and deletes the file; keeping both touches neither', async () => {
  await updateProfile(me, { ...text, cover: null });
  expect(mockCalls).toEqual(['update username, display_name, bio, cover_url', 'remove u1/cover-1.jpg']);
  mockCalls.length = 0;
  await updateProfile(me, text);
  expect(mockCalls).toEqual(['update username, display_name, bio']);
});
