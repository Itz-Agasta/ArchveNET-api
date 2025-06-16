/**
 * ArchiveNET Infrastructure Helper Functions
 *
 * This module handles critical system operations including:
 *
 * - Detection and connectivity testing for local Arweave gateway (Arlocal)
 * - Production wallet validation and address verification
 * - Health check utilities for status monitoring and diagnostics
 */

import { Redis } from "ioredis";
import type { JWKInterface } from "warp-contracts";

/**
 * Checks if ArLocal is running on the specified port
 *
 * @usage
 * - `src/config/arweave.ts` - Used during Arweave initialization to detect ArLocal
 */
export async function checkArLocalRunning(port = 8080): Promise<boolean> {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), 1000);
	try {
		const response = await fetch(`http://localhost:${port}/info`, {
			signal: controller.signal,
		});
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(id);
	}
}

/**
 * Validates that a loaded Arweave wallet matches the expected address
 *
 * @param wallet - The loaded JWK wallet object
 * @param expectedAddress - The expected wallet address from environment variable
 * @param walletSource - Description of wallet source for error messages (e.g., file path)
 * @param warp - Warp instance with arweave.wallets.jwkToAddress method
 * @returns Promise<string> - The validated wallet address
 *
 * @throws {Error} When wallet address doesn't match expected address
 *
 * @usage
 * - `src/config/arweave.ts` - Used during production wallet loading to validate wallet identity
 *
 */
export async function validateWalletAddress(
	wallet: JWKInterface,
	expectedAddress: string,
	walletSource: string,
	warp: {
		arweave: {
			wallets: { jwkToAddress: (wallet: JWKInterface) => Promise<string> };
		};
	},
): Promise<string> {
	const walletAddress = await warp.arweave.wallets.jwkToAddress(wallet);

	if (walletAddress !== expectedAddress) {
		console.error("❌ Wallet address mismatch detected!");
		console.error(`Expected: ${expectedAddress}`);
		console.error(`Loaded:   ${walletAddress}`);
		console.error(`Source:   ${walletSource}`);
		throw new Error(
			`Wallet address mismatch. Expected '${expectedAddress}' but loaded wallet has address '${walletAddress}'. Please verify the wallet file and expected address are correct.`,
		);
	}

	return walletAddress;
}

/**
 * Checks Redis connectivity without creating a persistent connection
 *
 * This function performs a lightweight connectivity test to Redis without
 * creating a long-lived connection. It's specifically designed for health
 * checks and status endpoints. Results are cached for 30 seconds to prevent
 * excessive Redis connections on frequent health checks.
 *
 * @returns Promise<Object> - Connection status and details
 * @throws Never throws - all errors are caught and returned as status
 *
 * @usage
 * - `src/routes/health.ts` - Used in health endpoint to report real-time Redis status
 *
 */

// Cache for health check results to prevent excessive Redis connections
let healthCheckCache: {
	result: {
		configured: boolean;
		connected: boolean;
		status: string;
		details?: string;
	};
	timestamp: number;
} | null = null;

export async function checkRedisConnectivity(): Promise<{
	configured: boolean;
	connected: boolean;
	status: string;
	details?: string;
}> {
	// Return cached result if less than 30 seconds old
	if (healthCheckCache && Date.now() - healthCheckCache.timestamp < 30000) {
		return healthCheckCache.result;
	}

	const redisUrl = process.env.REDIS_URL;

	if (!redisUrl) {
		const result = {
			configured: false,
			connected: false,
			status: "not configured",
			details: "REDIS_URL environment variable not set",
		};

		// Cache the result
		healthCheckCache = { result, timestamp: Date.now() };
		return result;
	}

	// Create a temporary Redis connection just for testing
	const testRedis = new Redis(redisUrl);

	try {
		// Add error handler to prevent unhandled error events
		testRedis.on("error", () => {
			// Suppress errors - we're handling them in the catch block
		});

		// Test the connection with a quick ping and a timeout
		await Promise.race([
			testRedis.ping(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Connection timeout")), 2000),
			),
		]);

		const result = {
			configured: true,
			connected: true,
			status: "ready",
			details: "Redis connection is healthy",
		};

		// Cache the result
		healthCheckCache = { result, timestamp: Date.now() };
		return result;
	} catch (error) {
		const result = {
			configured: true,
			connected: false,
			status: "disconnected",
			details: "Redis connection failed",
		};

		// Cache the result
		healthCheckCache = { result, timestamp: Date.now() };
		return result;
	} finally {
		// Always close the test connection to prevent socket leaks
		if (testRedis) {
			testRedis.disconnect();
		}
	}
}
