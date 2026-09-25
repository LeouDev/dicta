import { createDesign } from '@/features/quote-card/templates';
import { post } from '@/test-utils/fixtures';

import { deletePost, publishPost } from '../posts';

// Records what the service asks Supabase for; generated-cards holds "<author>/<file>" names.
const mockLog: string[] = [];
const mockCards = new Set<string>();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string) => (mockLog.push(`rpc ${name}`), Promise.resolve({ data: 'post-9', error: null })),
    from: (table: string) => ({
      delete: () => ({ eq: (_: string, id: string) => (mockLog.push(`delete ${table} ${id}`), Promise.resolve({ error: null })) }),
    }),
    storage: {
      from: (bucket: string) => ({
        list: (folder: string, { search }: { search: string }) => {
          mockLog.push(`list ${bucket} ${folder} ${search}`);
          const names = [...mockCards].filter((path) => path.startsWith(`${folder}/`)).map((path) => path.slice(folder.length + 1));
          return Promise.resolve({ data: names.filter((name) => name.startsWith(search)).map((name) => ({ name })), error: null });
        },
        remove: (paths: string[]) => {
          mockLog.push(`remove ${bucket} ${paths.join(' ')}`);
          for (const path of paths) mockCards.delete(path);
          return Promise.resolve({ error: null });
        },
      }),
    },
  },
}));

const fetchMock = jest.fn(() => Promise.resolve({ status: 202 }));

beforeEach(() => {
  mockLog.length = 0;
  mockCards.clear();
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('publishPost', () => {
  it('asks the website to draw the new post’s card image right away', async () => {
    const id = await publishPost({ userId: 'u1', text: 'Stay soft.', design: createDesign('editorial') });
    expect(id).toBe('post-9');
    expect(mockLog).toEqual(['rpc create_post']);
    expect(fetchMock).toHaveBeenCalledWith('https://dicta-orcin.vercel.app/api/card?id=post-9&warm=1');
  });

  it('publishes even when the website can’t be reached', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await expect(publishPost({ userId: 'u1', text: 'Stay soft.', design: createDesign('editorial') })).resolves.toBe('post-9');
  });
});

describe('deletePost', () => {
  it('removes every stored version of the post’s card image, and only this post’s', async () => {
    mockCards.add('u1/p1-aaaa.jpg');
    mockCards.add('u1/p1-aaaa-og.jpg');
    mockCards.add('u1/p1-bbbb.jpg');
    mockCards.add('u1/p10-cccc.jpg');
    mockCards.add('u2/p1-dddd.jpg');

    await deletePost(post({ id: 'p1' }));

    expect(mockLog[0]).toBe('delete posts p1');
    expect(mockLog).toContain('list generated-cards u1 p1-');
    expect([...mockCards].sort()).toEqual(['u1/p10-cccc.jpg', 'u2/p1-dddd.jpg']);
  });
});
