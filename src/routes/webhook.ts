import express from "express";
import { createUser, getUserByClerkId } from "../database/models/User.js";
import { createUserSubscription, getUserSubscription, updateUserSubscription } from "../database/models/UserSubscription.js";
import { auth } from "../middlewares/auth.js";
import { verifyTransaction } from "../utils/etherScan.js";

export const webhook = express.Router();

webhook.post("/clerk/registered", async (req, res) => {
	const userData = req.body.data;
	const email = userData.email_addresses?.[0]?.email_address;
	const username = userData.username || email;
	const fullName = `${userData.first_name} ${userData.last_name}`;
	const clerkId = userData.id;

	const user = await createUser({
		username,
		email,
		fullName,
		clerkId,
		metaMaskWalletAddress: "", // Placeholder, should be set after wallet setup
		status: "active", // Default status
		lastLoginAt: new Date(), // Set to current time
	});
	console.log("User registered:", user);
	res.status(200).json({ message: "User registration received" });
});

webhook.post("/payments/web3", auth, async (req, res) => {
	const txHash = req.body.txHash;
	const userId = req.userId;
	const subscriptionPlan = req.body.subscriptionPlan;
	const quotaLimit = req.body.quotaLimit || 1000; // Default quota limit if not provided

	if (!userId) {
	res.status(401).json({ error: "Unauthorized" });
	return;
	}

	// check if user actually exists
	const user = await getUserByClerkId(userId);
	if(!user){
		res.status(404).json({ error: "User not found" });
		return;
	}

	if (!txHash || !userId || !subscriptionPlan) {
		res.status(400).json({ error: "Missing required fields" });
		return;
	}
	// Verify the transaction using Etherscan API
	const verifyTxn = await verifyTransaction(txHash);
	const result = verifyTxn.result;
	if(result.isError === "0"){
		const findSubscription = await getUserSubscription(userId);
		if(findSubscription) {
			//If the user already has a subscription, update it
			const subscription = await updateUserSubscription( userId, {
				plan: subscriptionPlan,
				quotaLimit,
				isActive: true,
				renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Set renewsAt to 30 days from now	
				quotaUsed: 0	
			})
			console.log("User subscription updated", userId);
			res.status(200).json(subscription[0]);
			return;
		}
		// If the user does not have a subscription, create a new one
		const subscription = await createUserSubscription({
			clerkUserId: userId,
			plan: subscriptionPlan,
			quotaLimit,
			isActive: true,
			renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Set renewsAt to 30 days from now
		});
		console.log("User subscription created", userId);
		res.status(200).json(subscription[0]);
		return;

	}else{
		console.error("Transaction error");
		res.status(400).json({ txHash, error: result.errDescription });
	}
});
