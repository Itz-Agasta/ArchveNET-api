import { type Request, type Response, Router } from "express";
import { EizenService } from "../services/EizenService.js";
import { errorResponse, successResponse } from "../utils/responses.js";
import { getUserSubscription } from "../database/models/UserSubscription.js";
import { getInstanceByUserId, updateInstanceKeyHash } from "../database/models/instances.js";
import { generateContractHash } from "../utils/contractHash.js";

//Payment webhook contract deployment

const router = Router();

/**
 * POST /deploy/contract
 * Deploy a new Eizen contract for a user
 *
 * This endpoint is designed to be triggered by webhooks when a user completes payment
 * in the frontend. The workflow is:
 *
 * 1. User pays in frontend
 * 2. Payment gateway triggers webhook
 * 3. Webhook validates payment and calls this endpoint
 * 4. Contract is deployed on Arweave
 * 5. Contract TX ID is returned to webhook
 * 6. API key is generated for the user
 * 7. Webhook stores contract ID & API key in Neon DB
 * 8. Webhook sends email to user with api key
 * 
 * @dev saswata

 * TODO: Add authentication middleware to ensure only webhook can call this
 * TODO: Add request validation schema for user data
 * TODO: Add rate limiting to prevent abuse
 * TODO: Add logging for deployment tracking
 * TODO: Consider adding deployment status tracking in DB (idk, try it if y can)
 */
router.post("/contract", async (req: Request, res: Response) => {
	try {
		const userId = req.userId || req.body.userId; // Get user ID from request body or auth middleware
		if(!userId) {
			res.status(400).json({
				message: "User ID is required for contract deployment"
			   });
   		   return;
		}

		// only verify subscription as payment is already verified when creating subscription
		const user_subscription = await getUserSubscription(userId);
		if(!user_subscription) {
   			res.status(400).json({
 				message: "User subscription not found"})
			return;
		}
		const subscriptionTier = user_subscription.plan;
		  if(!subscriptionTier) {
	  		res.status(400).json({
	 			message: "User subscription tier not found"});
			return;
		}

		//Check if a contract already exists for the user
		const existingInstance = await getInstanceByUserId(userId);
		if(!existingInstance) {
			res.status(400).json({
				message: "No existing instance found for user"
				});
			return;
		}
		if (existingInstance?.instanceKeyHash) {
			res.status(201).json(existingInstance.instanceKeyHash);
			return;
		}

		// Deploy new Eizen contract on Arweave
		const deployResult = await EizenService.deployNewContract();
		const contractTxId = deployResult.contractId;
		if(!contractTxId) {
			res.status(500).json({
				message: "Failed to deploy contract on Arweave"
				});
			return;
  		}
		
		// TODO: Log deployment for audit trail
		console.log(`Contract deployed for user ${userId}: ${contractTxId}`);

		const contractHash = generateContractHash(contractTxId, userId);
		if(!contractHash) {
			res.status(500).json({
				message: "Failed to generate contract hash"
				});
			return;
		}
		const contractHashFingerprint = contractHash.contractHashFingerprint;
		const hashedContractKey = contractHash.hashedContractKey;

		//Store contract hash in database, provide contract id and hash-fingerprint to user
		//Verify contract ownership by the hash-fingerprint

		// Update user's instance with the new contract hash
		const update_contract_hash = await updateInstanceKeyHash(userId, hashedContractKey);
		if(!update_contract_hash[0])
			console.error(`Failed to update contract TX ID for user ${userId}`);
		else 
			console.log(`Updated contract TX ID for user ${userId}`);

		res.status(201).json(
			successResponse(
				{
					contractTxId,
					contractHashFingerprint,
					userId,
					deployedAt: new Date().toISOString(),
				},
				"Eizen contract deployed successfully",
			),
		);

		// TODO: @saswata---> After successful response, trigger async operations:
		// 1. Generate a API key for the user
		// 2. Store contract ID & API key with other details in Neon DB API record
		// 2. Send confirmation email to user with his API key
		// 3. Update user subscription status
		// 4. Log deployment event for analytics
	} catch (error) {
		console.error("Contract deployment error:", error);

		// TODO: Implement proper error handling and user notification
		// TODO: Consider rollback mechanisms if deployment fails
		// TODO: Alert admin/ops team for deployment failures (optional)

		res
			.status(500)
			.json(
				errorResponse(
					"Failed to deploy contract",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
	}
);

/**
 * GET /deploy/status/:contractId
 * Check deployment status of a contract
 *
 * NOTE: its not mandatory
 *
 * TODO: Implement this endpoint to check Arweave transaction status
 * TODO: Add caching to avoid excessive Arweave queries
 * TODO: Return deployment progress/confirmation status
 */
router.get("/status/:contractId", async (req: Request, res: Response) => {
	// TODO: Implement contract deployment status check
	res
		.status(501)
		.json(
			errorResponse(
				"Not implemented",
				"Status check endpoint not yet implemented",
			),
		);
});

export default router;