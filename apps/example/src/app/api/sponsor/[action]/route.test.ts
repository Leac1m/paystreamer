import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@mysten/sui/jsonRpc', () => {
  return {
    SuiJsonRpcClient: class {
      getCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: '0x1', digest: 'dig', version: 1 }]
      });
      executeTransactionBlock = vi.fn().mockResolvedValue({ digest: 'mock_digest' });
    }
  };
});

vi.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: {
    fromSecretKey: vi.fn().mockReturnValue({
      signTransaction: vi.fn().mockResolvedValue({ signature: 'mock_sponsor_signature' })
    })
  }
}));

vi.mock('@mysten/sui/cryptography', () => ({
  decodeSuiPrivateKey: vi.fn().mockReturnValue({ secretKey: new Uint8Array(32) })
}));

vi.mock('@mysten/sui/transactions', () => {
  const mockTx = {
    setSender: vi.fn(),
    setGasOwner: vi.fn(),
    setGasPayment: vi.fn(),
    setGasBudget: vi.fn(),
    build: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
  };
  return {
    Transaction: {
      from: vi.fn().mockReturnValue(mockTx)
    }
  };
});

describe('Sponsor API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SPONSOR_PRIVATE_KEY = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    process.env.SPONSOR_ADDRESS = '0x123';
  });

  const createMockRequest = (body: any) => {
    return new NextRequest('http://localhost/api/sponsor/prepare', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  };

  it('prepare action returns 400 for missing params', async () => {
    const req = createMockRequest({});
    const res = await POST(req, { params: Promise.resolve({ action: 'prepare' }) });
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toBe('Missing parameters');
  });

  it('prepare action builds a sponsored transaction', async () => {
    const req = createMockRequest({
      transaction: 'mock_tx_data',
      userAddress: '0xabc'
    });
    const res = await POST(req, { params: Promise.resolve({ action: 'prepare' }) });
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.bytes).toBeDefined(); // Base64 string of Uint8Array([1,2,3])
  });

  it('execute action returns 400 for missing params', async () => {
    const req = createMockRequest({});
    const res = await POST(req, { params: Promise.resolve({ action: 'execute' }) });
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data.error).toBe('Missing parameters');
  });

  it('execute action submits signed transaction', async () => {
    const req = createMockRequest({
      bytes: 'AQID', // base64 of [1,2,3]
      userSignature: 'mock_user_sig',
      userAddress: '0xabc'
    });
    const res = await POST(req, { params: Promise.resolve({ action: 'execute' }) });
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.digest).toBe('mock_digest');
  });

  it('returns 404 for invalid action', async () => {
    const req = createMockRequest({ foo: 'bar' });
    const res = await POST(req, { params: Promise.resolve({ action: 'invalid' }) });
    const data = await res.json();
    
    expect(res.status).toBe(404);
    expect(data.error).toBe('Invalid action');
  });
});
