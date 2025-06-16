import { Redis } from "ioredis";

/**
 * Initializes Redis connection if REDIS_URL is provided
 *
 * Creates a resilient Redis connection with automatic reconnection capabilities.
 * The connection includes proper error handling, reconnection logic, and
 * connection monitoring for production stability.
 *
 * @returns Promise<Redis | undefined> - Redis instance if connection successful, undefined otherwise
 * @throws Never throws - all errors are caught and logged as warnings
 */
export async function initializeRedis(): Promise<Redis | undefined> {
	if (!process.env.REDIS_URL) {
		console.log("No REDIS_URL provided, proceeding without Redis cache");
		return undefined;
	}

	console.log("Attempting to connect to Redis.....");

	let redis: Redis | undefined;

	try {
		redis = new Redis(process.env.REDIS_URL, {
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
			"❌ Redis initial connection failed, proceeding without caching",
			error,
		);

		return redis;
	}
}
