import type { Request, Response, NextFunction } from 'express';
import { verifyContractHash } from '../utils/contractHash.js';
import { findHashedKeyInDb } from '../database/models/instances.js';
import crypto from 'crypto';

interface ContractRequest extends Request {
  contract?: {
    contractId: string;
    userId: string;
    createdAt: number;
  };
}

export const verifyContractHashMiddleware = async (
  req: ContractRequest,
  res: Response,
  next: NextFunction,
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyContractHash(token);

    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired contract token' });
      return;
    }

    const hash = crypto.createHash('sha256').update(token).digest('hex');

    const isValid = await findHashedKeyInDb(hash);

    if (!isValid) {
      res.status(403).json({ error: 'Unknown or expired contract token' });
      return;
    }

    const headerContractId = req.headers['x-contract-id'];

    if (headerContractId && payload.contractId !== headerContractId) {
      res.status(403).json({ error: 'Contract ID mismatch' });
      return;
    }

    req.contract = payload;
    next();
};
