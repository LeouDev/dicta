import { webcrypto } from 'node:crypto';

// expo-crypto's native module, backed by Node's WebCrypto for the test.
jest.mock('expo-crypto', () => {
  const { webcrypto: node } = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    getRandomValues: (array: Uint32Array<ArrayBuffer>) => node.getRandomValues(array),
    digest: (algorithm: string, data: Uint8Array<ArrayBuffer>) => node.subtle.digest(algorithm, data),
  };
});

type Helpers = { generatePKCEVerifier: () => string; generatePKCEChallenge: (verifier: string) => Promise<string> };

it('gives supabase-js a SHA-256 PKCE challenge when the runtime has no WebCrypto (Hermes)', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    jest.isolateModules(() => require('../web-crypto'));
    const { generatePKCEVerifier, generatePKCEChallenge } = require('@supabase/auth-js/dist/main/lib/helpers') as Helpers;

    const verifier = generatePKCEVerifier();
    const challenge = await generatePKCEChallenge(verifier);

    const expected = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
    expect(challenge).toBe(expected);
    expect(challenge).not.toBe(verifier);
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
    Object.defineProperty(globalThis, 'crypto', original);
  }
});
