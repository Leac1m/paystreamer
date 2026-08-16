import { describe, it, expect, vi } from 'vitest';

const { mockWriteBlob, mockReadBlob, mockWalrusFactory } = vi.hoisted(() => {
  const mockWriteBlob = vi.fn().mockResolvedValue({ blobId: '0xBLOB', blobObject: { id: '0xBLOBOBJ' } });
  const mockReadBlob = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
  const mockWalrusFactory = vi.fn().mockImplementation((options: any) => ({
    name: 'walrus',
    register: vi.fn().mockReturnValue({
      writeBlob: mockWriteBlob,
      readBlob: mockReadBlob,
      __options: options,
    }),
  }));
  return { mockWriteBlob, mockReadBlob, mockWalrusFactory };
});

vi.mock('@mysten/walrus', () => ({
  walrus: mockWalrusFactory,
  WalrusFile: { from: vi.fn() },
}));

import { createWalrusClient, uploadContent, downloadContent } from '../src/core/walrus';

function mockCoreClient(walrusInstance: any) {
  return {
    $extend: vi.fn().mockReturnValue({ walrus: walrusInstance }),
  } as any;
}

describe('core/walrus', () => {
  it('createWalrusClient extends the core client with walrus() and returns .walrus', () => {
    const fakeWalrusInstance = { writeBlob: mockWriteBlob, readBlob: mockReadBlob };
    const client = mockCoreClient(fakeWalrusInstance);

    const walrusClient = createWalrusClient({ client, packageConfig: { systemObjectId: '0xSYS', stakingPoolId: '0xSTAKE' } } as any);

    expect(mockWalrusFactory).toHaveBeenCalledWith({ packageConfig: { systemObjectId: '0xSYS', stakingPoolId: '0xSTAKE' } });
    expect(client.$extend).toHaveBeenCalled();
    expect(walrusClient).toBe(fakeWalrusInstance);
  });

  it('uploadContent delegates to walrusClient.writeBlob with the right shape', async () => {
    const walrusClient = { writeBlob: mockWriteBlob, readBlob: mockReadBlob } as any;
    const content = new Uint8Array([1, 2, 3]);
    const signer = { __kind: 'mock-signer' } as any;

    const result = await uploadContent({ walrusClient, content, signer, epochs: 3, deletable: true });

    expect(mockWriteBlob).toHaveBeenCalledWith({ blob: content, signer, epochs: 3, deletable: true });
    expect(result.blobId).toBe('0xBLOB');
  });

  it('uploadContent defaults deletable to false', async () => {
    const walrusClient = { writeBlob: mockWriteBlob, readBlob: mockReadBlob } as any;
    const content = new Uint8Array([1]);
    const signer = { __kind: 'mock-signer' } as any;

    await uploadContent({ walrusClient, content, signer, epochs: 3 });

    expect(mockWriteBlob).toHaveBeenCalledWith({ blob: content, signer, epochs: 3, deletable: false });
  });

  it('downloadContent delegates to walrusClient.readBlob with the blobId', async () => {
    const walrusClient = { writeBlob: mockWriteBlob, readBlob: mockReadBlob } as any;

    const result = await downloadContent({ walrusClient, blobId: '0xBLOB' });

    expect(mockReadBlob).toHaveBeenCalledWith({ blobId: '0xBLOB' });
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
