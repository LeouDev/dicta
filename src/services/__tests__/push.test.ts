import * as Notifications from 'expo-notifications';

import { enablePush, pushPermission, registerDevice, unregisterDevice } from '../push';

const mockCalls: string[] = [];

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: object) => (mockCalls.push(`rpc ${name} ${JSON.stringify(args)}`), Promise.resolve({ error: null })),
    from: (table: string) => ({
      delete: () => ({ eq: (_: string, value: string) => (mockCalls.push(`delete ${table} ${value}`), Promise.resolve({ error: null })) }),
    }),
  },
}));

jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(() => Promise.resolve()),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ type: 'expo', data: 'ExponentPushToken[abc]' })),
}));

const permissions = Notifications.getPermissionsAsync as jest.Mock;
const iosStatus = (status: number) => ({ granted: status >= 2, canAskAgain: status === 0, ios: { status } });

beforeEach(() => {
  mockCalls.length = 0;
});

it('reads iOS’s answer: not asked yet, no, or yes (quiet delivery counts)', async () => {
  for (const [status, expected] of [
    [0, 'undetermined'],
    [1, 'denied'],
    [2, 'granted'],
    [3, 'granted'],
  ] as const) {
    permissions.mockResolvedValueOnce(iosStatus(status));
    expect(await pushPermission()).toBe(expected);
  }
});

it('registers the device only once notifications are allowed, and removes it on sign-out', async () => {
  permissions.mockResolvedValue(iosStatus(0));
  await registerDevice();
  await unregisterDevice();
  expect(mockCalls).toEqual([]);

  permissions.mockResolvedValue(iosStatus(2));
  await registerDevice();
  expect(mockCalls).toEqual(['rpc register_push_token {"p_token":"ExponentPushToken[abc]"}']);

  await unregisterDevice();
  await unregisterDevice();
  expect(mockCalls.slice(1)).toEqual(['delete push_tokens ExponentPushToken[abc]']);
});

it('asks, then registers if the answer is yes', async () => {
  permissions.mockResolvedValue(iosStatus(1));
  expect(await enablePush()).toBe('denied');
  expect(mockCalls).toEqual([]);

  permissions.mockResolvedValue(iosStatus(2));
  expect(await enablePush()).toBe('granted');
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(2);
  expect(mockCalls).toEqual(['rpc register_push_token {"p_token":"ExponentPushToken[abc]"}']);
});
