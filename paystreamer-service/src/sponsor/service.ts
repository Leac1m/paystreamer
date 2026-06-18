import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { client, getSponsorKeypair, getSponsorAddress, signAndSubmitTransaction } from '../lib/sui.js';
import { validateMoveCalls } from './validation.js';

export interface SponsorRequest {
  bytes: string;        // Base64 encoded transaction bytes
  userSignature: string; // Base64 encoded user signature
  userAddress: string;   // User's Sui address
}

export interface SponsorResponse {
  digest: string;
}

export interface SponsorError {
  error: string;
  code: 'VALIDATION_ERROR' | 'SUBMISSION_FAILED';
}

/**
 * Processes a sponsored transaction request
 * 1. Decodes the transaction bytes
 * 2. Validates Move call targets
 * 3. Sets gas owner to sponsor (address balance gas model)
 * 4. Signs and submits the transaction
 */
export async function processSponsorRequest(
  request: SponsorRequest
): Promise<SponsorResponse> {
  const { bytes, userSignature, userAddress } = request;

  // Decode the transaction bytes
  const transactionBytes = fromBase64(bytes);

  // Deserialize the transaction
  const transaction = Transaction.fromKind(transactionBytes);

  // Validate that all Move call targets are allowed
  try {
    validateMoveCalls(transaction);
  } catch (error) {
    throw {
      error: error instanceof Error ? error.message : 'Validation failed',
      code: 'VALIDATION_ERROR' as const,
    };
  }

  // Set the sender to the user address
  transaction.setSender(userAddress);

  // Set the gas owner to the sponsor address (address balance gas model)
  const sponsorAddress = getSponsorAddress();
  transaction.setGasOwner(sponsorAddress);

  // Set gas payment to empty (address balance gas model)
  // This means the sponsor's address balance will be used for gas
  transaction.setGasPayment([]);

  try {
    // Sign and submit the transaction
    const result = await signAndSubmitTransaction(transaction, userSignature, userAddress);
    
    console.log(`[Sponsor] Transaction sponsored successfully: ${result.digest}`);
    
    return result;
  } catch (error) {
    console.error('[Sponsor] Failed to submit transaction:', error);
    throw {
      error: error instanceof Error ? error.message : 'Transaction submission failed',
      code: 'SUBMISSION_FAILED' as const,
    };
  }
}
