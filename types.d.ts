import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string; // Optional userId for authenticated requests
      contract?: {
        contractId: string; // Contract ID from the request
        userId: string; // User ID associated with the contract
        createdAt: number; // Timestamp of when the contract was created
      };
    }
  }
}