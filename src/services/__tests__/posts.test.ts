import { createDesign } from '@/features/quote-card/templates';
import { post } from '@/test-utils/fixtures';

import { storeCardImages } from '../card-images';
import { deletePost, publishPost, updatePost } from '../posts';

// Records what the service asks Supabase for; generated-cards holds "<author>/<file>" names.
const mockLog: string[] = [];
const mockCards = new Set<string>();
let mockPhotoUsers = 0;
const mockRpcErrors: Record<string, { message: string }> = {};
const mockRpcArgs: Record<string, Record<string, unknown>> = {};

jest.mock('../card-images', () => ({ storeCardImages: jest.fn(() => Promise.resolve()) }));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => (
      mockLog.push(`rpc ${name}`), (mockRpcArgs[name] = args), Promise.resolve({ data: 'post-9', error: mockRpcErrors[name] ?? null })
    ),
    from: (table: string) => ({
      delete: () => ({ eq: (_: string, id: string) => (mockLog.push(`delete ${table} ${id}`), Promise.resolve({ error: null })) }),
      select: () => ({ eq: (_: string, path: string) => (mockLog.push(`count ${table} ${path}`), Promise.resolve({ count: mockPhotoUsers, error: null })) }),
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

const fetchMock = jest.fn((url: string, init?: RequestInit) => Promise.resolve({ status: init?.method === 'POST' ? 204 : 202, url }));
const stored = storeCardImages as jest.MockedFunction<typeof storeCardImages>;
const author = { displayName: 'Mara', username: 'mara', avatarUrl: null, isVerified: false };

beforeEach(() => {
  mockLog.length = 0;
  mockCards.clear();
  mockPhotoUsers = 0;
  for (const name in mockRpcErrors) delete mockRpcErrors[name];
  for (const name in mockRpcArgs) delete mockRpcArgs[name];
  fetchMock.mockClear();
  stored.mockReset().mockResolvedValue(undefined);
  global.fetch = fetchMock as unknown as typeof fetch;
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('publishPost', () => {
  it('draws the website’s images on the phone, with the text and design exactly as stored', async () => {
    const design = createDesign('editorial');
    const id = await publishPost({ userId: 'u1', text: '  Stay soft.  ', design, author });
    expect(id).toBe('post-9');
    expect(mockLog).toEqual(['rpc create_post']);
    await flush();
    expect(stored).toHaveBeenCalledWith({ postId: 'post-9', authorId: 'u1', text: 'Stay soft.', design, author });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a stack’s other cards with the post, trimmed, in order', async () => {
    const minimal = createDesign('minimal');
    await publishPost({
      userId: 'u1',
      text: 'One',
      design: createDesign('editorial'),
      cards: [
        { text: ' Two ', design: minimal },
        { text: 'Three', design: createDesign('midnight') },
      ],
      author,
    });
    const cards = mockRpcArgs.create_post.p_cards as { text: string; template: string; background_image_path: string | null }[];
    expect(cards.map((c) => [c.text, c.template, c.background_image_path])).toEqual([
      ['Two', 'minimal', null],
      ['Three', 'midnight', null],
    ]);
  });

  it('says which card isn’t ready', async () => {
    await expect(
      publishPost({ userId: 'u1', text: 'One', design: createDesign('editorial'), cards: [{ text: '  ', design: createDesign('editorial') }], author }),
    ).rejects.toThrow('Card 2: Write something first.');
    expect(mockLog).toEqual([]);
  });

  it('asks the website to draw them if the phone can’t', async () => {
    stored.mockRejectedValueOnce(new Error('offline'));
    await publishPost({ userId: 'u1', text: 'Stay soft.', design: createDesign('editorial'), author });
    await flush();
    expect(fetchMock).toHaveBeenCalledWith('https://dicta.world/api/card?id=post-9&warm=1');
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

  it('keeps an uploaded photo another post still uses', async () => {
    const photo = { ...createDesign('photograph').background, image: 'https://x/p.jpg', path: 'u1/photo.jpg' };
    const withPhoto = post({ id: 'p1', design: { ...createDesign('photograph'), background: photo } });

    mockPhotoUsers = 1;
    await deletePost(withPhoto);
    expect(mockLog).toContain('count post_designs u1/photo.jpg');
    expect(mockLog.some((line) => line.startsWith('remove post-images'))).toBe(false);

    mockLog.length = 0;
    mockPhotoUsers = 0;
    await deletePost(withPhoto);
    expect(mockLog).toContain('remove post-images u1/photo.jpg');
  });

  it('removes every card’s photo of a stack', async () => {
    const photo = (path: string) => ({ ...createDesign('photograph'), background: { ...createDesign('photograph').background, image: `https://x/${path}`, path } });
    await deletePost(post({ id: 'p1', design: photo('u1/a.jpg'), cards: [{ text: 'Two', design: photo('u1/b.jpg') }, { text: 'Three', design: createDesign('editorial') }] }));
    expect(mockLog).toContain('remove post-images u1/a.jpg u1/b.jpg');
  });
});

describe('updatePost', () => {
  const photo = (path: string) => ({ ...createDesign('photograph').background, image: `https://x/${path}`, path });

  it('saves the words, the design and the cards in one call, and redraws the website’s images', async () => {
    const design = createDesign('midnight');
    const saved = await updatePost({ postId: 'p1', previousPhotos: [], userId: 'u1', text: '  New words.  ', design, topic: 'love', author });
    expect(saved).toEqual({ text: 'New words.', topic: 'love', design, cards: [] });
    expect(mockLog).toEqual(['rpc update_post']);
    expect(mockRpcArgs.update_post).toEqual({
      p_post_id: 'p1',
      p_text: 'New words.',
      p_topic: 'love',
      p_template: 'midnight',
      p_design: design,
      p_background_image_path: undefined,
      p_cards: [],
    });
    await flush();
    expect(stored).toHaveBeenCalledWith({ postId: 'p1', authorId: 'u1', text: 'New words.', design, author });
  });

  it('changes nothing else when a card’s words are rejected', async () => {
    mockRpcErrors.update_post = { message: 'objectionable_content' };
    await expect(updatePost({ postId: 'p1', previousPhotos: ['u1/old.jpg'], userId: 'u1', text: 'Words.', design: createDesign('editorial'), author })).rejects.toEqual(
      mockRpcErrors.update_post,
    );
    expect(mockLog).toEqual(['rpc update_post']);
    await flush();
    expect(stored).not.toHaveBeenCalled();
  });

  it('removes the photo it replaced, unless another post still uses it', async () => {
    const design = { ...createDesign('photograph'), background: photo('u1/new.jpg') };
    await updatePost({ postId: 'p1', previousPhotos: ['u1/new.jpg'], userId: 'u1', text: 'Same photo.', design, author });
    expect(mockLog.some((line) => line.startsWith('count') || line.startsWith('remove'))).toBe(false);

    mockLog.length = 0;
    mockPhotoUsers = 1;
    await updatePost({ postId: 'p1', previousPhotos: ['u1/old.jpg'], userId: 'u1', text: 'New photo.', design, author });
    expect(mockLog).toContain('count post_designs u1/old.jpg');
    expect(mockLog.some((line) => line.startsWith('remove'))).toBe(false);

    mockLog.length = 0;
    mockPhotoUsers = 0;
    await updatePost({ postId: 'p1', previousPhotos: ['u1/old.jpg'], userId: 'u1', text: 'No photo.', design: createDesign('editorial'), author });
    expect(mockLog).toContain('remove post-images u1/old.jpg');
  });

  it('keeps a photo that moved to another card of the stack', async () => {
    const card = { ...createDesign('photograph'), background: photo('u1/old.jpg') };
    await updatePost({ postId: 'p1', previousPhotos: ['u1/old.jpg'], userId: 'u1', text: 'One', design: createDesign('editorial'), cards: [{ text: 'Two', design: card }], author });
    expect(mockLog.some((line) => line.startsWith('remove'))).toBe(false);
  });
});
