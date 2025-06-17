import { type Request, type Response, Router } from "express";
import { EizenService } from "../services/EizenService.js";
import { errorResponse, successResponse } from "../utils/responses.js";
import { getUserSubscription } from "../database/models/UserSubscription.js";
import { randomUUID } from "crypto";

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
		const userId = req.userId;
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

		res.status(201).json(
			successResponse(
				{
					contractTxId,
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

router.post('/contract/test', async (req: Request, res: Response) => {
	try {
		const userId = req.userId || "user_2yadqXNQsdsIB6lqZwBeq1VtSWp"; // For testing, use hardcoded user id
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
		const testTxnId = randomUUID();
		res.status(200).json({
			contractTxId: testTxnId,
			userId,
			deployedAt: new Date().toISOString(),
			message: "Test deployment successful",
			});
	}catch (error) {
		  console.error("Test deployment error:", error);
  res
   .status(500)
   .json(
	errorResponse(
	 "Failed to deploy contract",
	 error instanceof Error ? error.message : "Unknown error",
	),
   );
	}
});

export default router;