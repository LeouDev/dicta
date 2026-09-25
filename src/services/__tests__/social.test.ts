import { recordShare, setFollow, setLike, setSave } from '../social';

// A tiny stand-in for the PostgREST builder that records what the service asked for.
const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockResult: { error: unknown } = { error: null };

jest.mock('@/lib/supabase', () => {
  const builder = (table: string) => ({
    upsert: (...args: unknown[]) => (mockCalls.push({ table, op: 'upsert', args }), Promise.resolve(mockResult)),
    delete: () => {
      const filters: unknown[] = [];
      const chain = {
        eq: (...args: unknown[]) => {
          filters.push(args);
          if (filters.length === 2) {
            mockCalls.push({ table, op: 'delete', args: filters });
            return Promise.resolve(mockResult);
          }
          return chain;
        },
      };
      return chain;
    },
  });
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: (...args: unknown[]) => (mockCalls.push({ table: 'rpc', op: 'rpc', args }), Promise.resolve(mockResult)),
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockResult = { error: null };
});

describe('social writes', () => {
  it('likes with an insert that ignores duplicates', async () => {
    await setLike('me', 'p1', true);
    expect(mockCalls).toEqual([
      { table: 'likes', op: 'upsert', args: [{ user_id: 'me', post_id: 'p1' }, { onConflict: 'user_id,post_id', ignoreDuplicates: true }] },
    ]);
  });

  it('unlikes by deleting only the viewer’s like', async () => {
    await setLike('me', 'p1', false);
    expect(mockCalls).toEqual([{ table: 'likes', op: 'delete', args: [['user_id', 'me'], ['post_id', 'p1']] }]);
  });

  it('saves and unsaves a reference to the post', async () => {
    await setSave('me', 'p1', true);
    await setSave('me', 'p1', false);
    expect(mockCalls.map((c) => [c.table, c.op])).toEqual([
      ['saves', 'upsert'],
      ['saves', 'delete'],
    ]);
  });

  it('follows and unfollows, and refuses to follow yourself without asking the server', async () => {
    await setFollow('me', 'u2', true);
    await setFollow('me', 'u2', false);
    await expect(setFollow('me', 'me', true)).rejects.toThrow('follow yourself');
    expect(mockCalls.map((c) => [c.table, c.op])).toEqual([
      ['follows', 'upsert'],
      ['follows', 'delete'],
    ]);
  });

  it('counts shares only through the server function', async () => {
    await recordShare('p1');
    expect(mockCalls).toEqual([{ table: 'rpc', op: 'rpc', args: ['record_share', { p_post_id: 'p1' }] }]);
  });

  it('surfaces database errors', async () => {
    mockResult = { error: new Error('permission denied') };
    await expect(setLike('me', 'p1', true)).rejects.toThrow('permission denied');
  });
});
