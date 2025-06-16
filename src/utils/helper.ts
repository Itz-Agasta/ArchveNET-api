/**
 * ArchiveNET Infrastructure Helper Functions
 *
 * This module handles critical system operations including:
 *
 * - Detection and connectivity testing for local Arweave gateway (Arlocal)
 * - Production wallet validation and address verification
 * - Persistent Redis connection management for application caching
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
	try {
		const response = await fetch(`http://localhost:${port}/info`);
		return response.ok;
	} catch (error) {
		return false;
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
 * Initializes Redis connection if REDIS_URL is provided
 *
 * Creates a resilient Redis connection with automatic reconnection capabilities.
 * The connection includes proper error handling, reconnection logic, and
 * connection monitoring for production stability.
 *
 * @returns Promise<Redis | undefined> - Redis instance if connection successful, undefined otherwise
 * @throws Never throws - all errors are caught and logged as warnings
 *
 * @usage
 * - `src/config/arweave.ts` - Used during Arweave initialization to set up caching layer
 *
 */
export async function initializeRedis(): Promise<Redis | undefined> {
	if (!process.env.REDIS_URL) {
		console.log("No REDIS_URL provided, proceeding without Redis cache");
		return undefined;
	}

	console.log("Attempting to connect to Redis.....");

	try {
		const redis = new Redis(process.env.REDIS_URL, {
			// Connection settings
			connectTimeout: 10000,
			commandTimeout: 5000,
			lazyConnect: false,
			maxRetriesPerRequest: 2,
			enableAutoPipelining: true,
		});

		// Track connection state to prevent spam
		let hasLoggedDisconnection = false;

		redis.on("ready", () => {
			console.log("✅ Redis connected successfully for caching");
			hasLoggedDisconnection = false; // Reset flag when connected
		});

		redis.on("error", (err) => {
			// Only log disconnect once until reconnection
			if (!hasLoggedDisconnection) {
				console.warn("⚠️ Redis connection lost");
				hasLoggedDisconnection = true;
			}
		});

		// Suppress other events (connect, reconnecting, close, end)

		// Test initial connection
		await redis.ping();
		console.log("Redis ping successful - connection established");

		return redis;
	} catch (error) {
		console.warn(
			"❌ Redis initial connection failed, proceeding without cache:",
			error,
		);
		return undefined;
	}
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

	try {
		// Create a temporary Redis connection just for testing
		const testRedis = new Redis(redisUrl);

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

		// Immediately close the test connection
		testRedis.disconnect();

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
	}
}
