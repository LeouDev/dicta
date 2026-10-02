import { QueryClient, type InfiniteData } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import type { Message } from '@/types/models';

import { addMessage } from '../use-messages';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('@/components/toast', () => ({ toast: jest.fn() }));

const at = (id: string, minute: number): Message => ({
  id,
  conversationId: 'c1',
  senderId: 'u1',
  body: id,
  postId: null,
  post: null,
  storyId: null,
  story: null,
  createdAt: `2026-10-02T09:0${minute}:00.000000+00:00`,
});
const ids = (client: QueryClient) =>
  client.getQueryData<InfiniteData<Message[], string | null>>(queryKeys.messages('c1'))!.pages.map((page) => page.map((m) => m.id));

it('puts messages in time order once, whatever order they arrive in, replacing the one shown while sending', () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(queryKeys.messages('c1'), { pages: [[at('m3', 3), at('m1', 1)], [at('m0', 0)]], pageParams: [null, 'x'] });
  addMessage(client, at('m2', 2)); // a live message whose fetch finished late
  addMessage(client, at('m3', 3)); // the same message again (our insert and the live event)
  addMessage(client, { ...at('temp', 9), status: 'sending' });
  addMessage(client, at('m4', 4), 'temp'); // the saved copy, by the server's time
  expect(ids(client)).toEqual([['m4', 'm3', 'm2', 'm1'], ['m0']]);
});
