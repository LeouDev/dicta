import { deleteAccount } from '../account';

const mockRemoved: string[] = [];
// post-images/u1 holds a photo and the stories/ folder (folders list with a null id).
const mockFolders: Record<string, { id: string | null; name: string }[]> = {
  'post-images:u1': [
    { id: 'f1', name: 'a.jpg' },
    { id: null, name: 'stories' },
  ],
  'post-images:u1/stories': [{ id: 'f2', name: 's.jpg' }],
};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        list: (folder: string) => Promise.resolve({ data: mockFolders[`${bucket}:${folder}`] ?? [], error: null }),
        remove: (paths: string[]) => (mockRemoved.push(...paths.map((p) => `${bucket}/${p}`)), Promise.resolve({ error: null })),
      }),
    },
    rpc: () => Promise.resolve({ error: null }),
    auth: { signOut: () => Promise.resolve({ error: null }) },
  },
}));

it('removes photos in subfolders too, so story photos go with the account', async () => {
  await deleteAccount('u1');
  expect(mockRemoved.sort()).toEqual(['post-images/u1/a.jpg', 'post-images/u1/stories/s.jpg']);
});
