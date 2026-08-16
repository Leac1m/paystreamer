import { describe, it, expect, vi } from 'vitest';

const { mockEncrypt, mockDecrypt, MockSealClient, mockSessionKeyCreate } = vi.hoisted(() => {
  const mockEncrypt = vi.fn().mockResolvedValue({ encryptedObject: new Uint8Array([1, 2, 3]), key: new Uint8Array([4, 5, 6]) });
  const mockDecrypt = vi.fn().mockResolvedValue(new Uint8Array([7, 8, 9]));
  const MockSealClient = vi.fn().mockImplementation(function (this: any, options: any) {
    this.__options = options;
    this.encrypt = mockEncrypt;
    this.decrypt = mockDecrypt;
  });
  const mockSessionKeyCreate = vi.fn().mockResolvedValue({ __kind: 'mock-session-key' });
  return { mockEncrypt, mockDecrypt, MockSealClient, mockSessionKeyCreate };
});

vi.mock('@mysten/seal', () => ({
  SealClient: MockSealClient,
  SessionKey: { create: mockSessionKeyCreate },
}));

import { createSealClient, encryptForPolicy, createSealSessionKey, decryptWithPolicy } from '../src/core/seal';

describe('core/seal', () => {
  it('createSealClient constructs a SealClient with the given options', () => {
    const suiClient = {} as any;
    const serverConfigs = [{ objectId: '0xkeyserver', weight: 1 }];

    const client = createSealClient({ suiClient, serverConfigs, verifyKeyServers: false });

    expect(MockSealClient).toHaveBeenCalledWith({
      suiClient,
      serverConfigs,
      verifyKeyServers: false,
      timeout: undefined,
    });
    expect(client).toBeDefined();
  });

  it('encryptForPolicy delegates to client.encrypt with the right shape', async () => {
    const client = createSealClient({ suiClient: {} as any, serverConfigs: [] });
    const data = new Uint8Array([1, 2, 3]);

    const result = await encryptForPolicy({ client, packageId: '0xPKG', id: '0xPKGnonce', data, threshold: 2 });

    expect(mockEncrypt).toHaveBeenCalledWith({ packageId: '0xPKG', id: '0xPKGnonce', data, threshold: 2 });
    expect(result.encryptedObject).toBeInstanceOf(Uint8Array);
  });

  it('createSealSessionKey delegates to SessionKey.create', async () => {
    const suiClient = {} as any;
    await createSealSessionKey({ address: '0xUSER', packageId: '0xPKG', ttlMin: 10, suiClient });

    expect(mockSessionKeyCreate).toHaveBeenCalledWith({
      address: '0xUSER',
      packageId: '0xPKG',
      ttlMin: 10,
      suiClient,
    });
  });

  it('decryptWithPolicy delegates to client.decrypt with the right shape', async () => {
    const client = createSealClient({ suiClient: {} as any, serverConfigs: [] });
    const data = new Uint8Array([1, 2, 3]);
    const sessionKey = { __kind: 'mock-session-key' } as any;
    const txBytes = new Uint8Array([9, 9, 9]);

    const result = await decryptWithPolicy({ client, data, sessionKey, txBytes });

    expect(mockDecrypt).toHaveBeenCalledWith({ data, sessionKey, txBytes });
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
