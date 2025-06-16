/**
 * ArchiveNET API Server
 *
 * A semantic memory API service powered by vector embeddings and blockchain storage.
 * Provides enterprise-grade memory management with AI-powered search capabilities.
 *
 * @author TeamVyse
 * @email admin@archivenet.tech
 * @license MIT
 * @copyright 2025 TeamVyse. All rights reserved.
 */

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";

import { errorHandler } from "./middlewares/errorHandler.js";
import { EizenService } from "./services/EizenService.js";
import { embeddingService } from "./services/EmbeddingService.js";

dotenv.config();

/**
 * Initialize core services in dependency order
 *
 * Services must be initialized sequentially to ensure proper dependency resolution.
 * The embedding service provides vector capabilities, while Eizen handles semantic search.
 */
async function initializeServices() {
	console.log("Initializing ArchiveNET API...");

	// Initialize vector embedding service first (required by other services)
	await embeddingService.ensureInitialized();

	// Initialize semantic search configuration
	await EizenService.initEizenConfig();

	console.log("ArchiveNET is ready to handle user requests");
}

// Bootstrap application startup
initializeServices()
	.then(async () => {
		// Dynamic route imports ensure services are initialized before route handlers
		let auth = (_req: any, _res: any, next: any) => next(); // Default noop middleware

		if (process.env.CLERK_JWKS_URI || process.env.NODE_ENV !== "development") {
			try {
				const authModule = await import("./middlewares/auth.js");
				auth = authModule.auth;
				console.log("✅ Auth middleware loaded");
			} catch (err) {
				console.warn("⚠️ Failed to load auth middleware, proceeding without it.");
			}
		} else {
			console.warn("🔓 Running without auth middleware (development mode)");
		}
		const healthRoutes = await import("./routes/health.js");
		const memoryRoutes = await import("./routes/memories.js");
		const adminRoutes = await import("./routes/admin.js");
		const deploymentRoutes = await import("./routes/deployment.js");
		const webhookRoutes = await import("./routes/webhook.js");
		const { apiKeyRouter } = await import("./routes/apiKeyRouter.js");
		const { userRouter } = await import("./routes/user.js");
		const { userSubscriptionsRouter } = await import(
			"./routes/userSubscriptions.js"
		);
		const { etherScanRouter } = await import("./routes/etherscan.js");

		const app = express();
		const PORT = Number.parseInt(process.env.PORT || "3000", 10);

		// Configure CORS for multiple frontend environments
		const allowedOrigins = process.env.ORIGIN?.split(",").map((origin) =>
			origin.trim(),
		) || ["http://localhost:3000"];

		const corsOptions: cors.CorsOptions = {
			origin: (
				origin: string | undefined,
				callback: (error: Error | null, allow?: boolean) => void,
			) => {
				// Allow requests without origin (mobile apps, Postman, etc.)
				if (!origin || allowedOrigins.includes(origin)) {
					callback(null, true);
				} else {
					callback(new Error("Not allowed by CORS"));
				}
			},
			credentials: true, // Enable cookies and authentication headers
		};

		// Core middleware stack
		app.use(express.json());
		app.use(express.urlencoded({ extended: true }));
		app.use(cors(corsOptions));
		app.use(helmet());

		// API information endpoint
		app.get("/", (_req, res) => {
			res.json({
				name: "ArchiveNET API",
				description:
					"Decentralized Semantic memory management with AI-powered search",
				version: "1.0.0",
				license: "MIT",
				copyright: "© 2025 TeamVyse. All rights reserved.",
				contact: "admin@archivenet.tech",
				documentation: "/health",
			});
		});

		// API route registration
		app.use("/health", healthRoutes.default); // System health checks and monitoring
		app.use("/admin", adminRoutes.default); // Admin-only vector database operations
		app.use("/memories", memoryRoutes.default); // User-facing semantic memory API
		app.use("/deploy", deploymentRoutes.default); // Smart contract deployment
		app.use("/webhook", auth, webhookRoutes.webhook); // Payment gateway webhooks
		app.use("/apiKey", apiKeyRouter); // API key management
		app.use("/user", userRouter); // User account management
		app.use("/user_subscriptions", auth, userSubscriptionsRouter); // Subscription management
		app.use("/etherscan", etherScanRouter);

		// Global error handling middleware (must be last)
		app.use(errorHandler);

		// Start HTTP server with graceful error handling
		app
			.listen(PORT, () => {
				console.log(`ArchiveNET API server running on port ${PORT}`);
				console.log(`Health endpoint: http://localhost:${PORT}/health`);
			})
			.on("error", (error) => {
				console.error("❌ Failed to start server:", error.message);
				throw new Error(error.message);
			});
	})
	.catch((error) => {
		console.error("Failed to initialize services:", error);
		process.exit(1);
	});
