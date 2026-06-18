import { Router, Request, Response } from 'express';
import { processSponsorRequest, SponsorError } from './service.js';

const router = Router();

/**
 * POST /sponsor
 * Sponsored transaction endpoint for Address Balance gas model
 * 
 * Request body:
 * {
 *   "bytes": "<base64 encoded transaction bytes>",
 *   "userSignature": "<base64 encoded user signature>",
 *   "userAddress": "0x..."
 * }
 * 
 * Response (success):
 * { "digest": "..." }
 * 
 * Response (error):
 * { "error": "...", "code": "VALIDATION_ERROR" | "SUBMISSION_FAILED" }
 */
router.post('/sponsor', async (req: Request, res: Response) => {
  try {
    const { bytes, userSignature, userAddress } = req.body;

    // Validate request body
    if (!bytes || typeof bytes !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "bytes" field',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!userSignature || typeof userSignature !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "userSignature" field',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!userAddress || typeof userAddress !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "userAddress" field',
        code: 'VALIDATION_ERROR',
      });
    }

    // Basic Sui address validation (66 chars: 0x + 64 hex chars)
    if (!/^0x[a-fA-F0-9]{64}$/.test(userAddress)) {
      return res.status(400).json({
        error: 'Invalid Sui address format',
        code: 'VALIDATION_ERROR',
      });
    }

    console.log(`[Sponsor] Processing sponsored transaction for user: ${userAddress}`);

    // Process the sponsor request
    const result = await processSponsorRequest({
      bytes,
      userSignature,
      userAddress,
    });

    return res.json(result);
  } catch (error) {
    console.error('[Sponsor] Error processing request:', error);

    if (error && typeof error === 'object' && 'code' in error) {
      const sponsorError = error as SponsorError;
      return res.status(400).json(sponsorError);
    }

    return res.status(500).json({
      error: 'Internal server error',
      code: 'SUBMISSION_FAILED',
    });
  }
});

export default router;
