import * as ExpoCrypto from 'expo-crypto';

/*
 * Hermes has no WebCrypto. Without it, supabase-js makes the PKCE sign-in secret with
 * Math.random and sends it unhashed ("plain"). expo-crypto provides both primitives natively.
 */
type WebCrypto = {
  getRandomValues?: typeof ExpoCrypto.getRandomValues;
  subtle?: { digest: (algorithm: string, data: Parameters<typeof ExpoCrypto.digest>[1]) => Promise<ArrayBuffer> };
};

const scope = globalThis as { crypto?: WebCrypto };
scope.crypto ??= {};
scope.crypto.getRandomValues ??= ExpoCrypto.getRandomValues;
scope.crypto.subtle ??= {
  digest: (algorithm, data) => ExpoCrypto.digest(algorithm as ExpoCrypto.CryptoDigestAlgorithm, data),
};
