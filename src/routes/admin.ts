import { type Request, type Response, Router } from "express";
import { validateData } from "../middlewares/validate.js";
import {
	adminInsertVectorSchema,
	adminSearchVectorSchema,
} from "../schemas/eizen.js";
import { EizenService } from "../services/EizenService.js";
import { errorResponse, successResponse } from "../utils/responses.js";

/**
 * ADMIN ROUTES - ArchiveNET Vector Database Administration
 *
 * These routes provide direct low-level access to the Eizen vector database
 * for administrative purposes only. They are NOT intended for public use.
 *
 * Access Level: ADMIN ONLY
 * Authentication: Flexible contract ID (request body/query params or environment)
 *
 * Contract ID Options:
 * 1. Include 'contractId' in request body (POST routes) or query params (GET routes)
 * 2. Set EIZEN_CONTRACT_ID environment variable as fallback
 * 3. If neither provided, operation will fail with clear error message
 *
 * Use Cases:
 * - Direct vector manipulation for testing with different contracts
 * - Database administration and monitoring across multiple contracts
 * - System debugging and maintenance
 * - Contract deployment for new instances
 *
 * Security Note: These endpoints bypass user authentication and operate
 * directly on the specified contract. (Will private this endpoint later)
 */

const router = Router();

/**
 * Get admin Eizen service instance
 * Uses the contract ID from request body or environment variables for admin operations
 *
 * @param contractId - Optional contract ID from request body
 * @returns Promise<EizenService> - Admin Eizen service instance
 * @throws Error if no contract ID is provided in request or environment
 */
async function getAdminEizenService(
	contractId?: string,
): Promise<EizenService> {
	// Use contractId from request body if provided, otherwise fallback to environment
	const finalContractId = contractId || process.env.EIZEN_CONTRACT_ID;

	if (!finalContractId) {
		throw new Error(
			"Contract ID not provided. Please include 'contractId' in your request body or set EIZEN_CONTRACT_ID in environment variables.",
		);
	}

	return await EizenService.forContract(finalContractId);
}

/**
 * POST /admin/insert
 * Insert a vector with optional metadata into the Eizen database
 *
 * Admin Use Case: Direct vector insertion for testing and data seeding
 *
 * Request body:
 * {
 *   "vector": [0.1, 0.2, 0.3, ...],  // Raw vector data (float array)
 *   "metadata": { "key": "value", ... }, // Optional metadata object
 *   "contractId": "your-contract-id"  // Optional contract ID (fallback to env variable)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "vectorId": 123 },
 *   "message": "Vector inserted successfully"
 * }
 */
router.post(
	"/insert",
	validateData(adminInsertVectorSchema),
	async (req, res) => {
		try {
			const { contractId, ...vectorData } = req.body;
			const eizenService = await getAdminEizenService(contractId);
			const result = await eizenService.insertVector(vectorData);

			res
				.status(201)
				.json(successResponse(result, "Vector inserted successfully"));
		} catch (error) {
			console.error("Admin vector insert error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to insert vector",
						error instanceof Error ? error.message : "Unknown error",
					),
				);
		}
	},
);

/**
 * POST /admin/search
 * Search for similar vectors using k-nearest neighbors
 *
 * Admin Use Case: Direct vector similarity search for testing and debugging
 *
 * Request body:
 * {
 *   "query": [0.1, 0.2, 0.3, ...],  // Query vector (float array)
 *   "k": 10,                        // Number of results (optional, defaults to 10)
 *   "contractId": "your-contract-id" // Optional contract ID (fallback to env variable)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [
 *     { "id": 123, "distance": 0.15, "metadata": {...} },
 *     { "id": 456, "distance": 0.23, "metadata": {...} }
 *   ],
 *   "message": "Found 2 similar vectors"
 * }
 */
router.post(
	"/search",
	validateData(adminSearchVectorSchema),
	async (req, res) => {
		try {
			const { contractId, ...searchData } = req.body;
			const eizenService = await getAdminEizenService(contractId);
			const results = await eizenService.searchVectors(searchData);

			res.json(
				successResponse(results, `Found ${results.length} similar vectors`),
			);
		} catch (error) {
			console.error("Admin vector search error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to search vectors",
						error instanceof Error ? error.message : "Unknown error",
					),
				);
		}
	},
);

/**
 * GET /admin/vector/:id
 * Get a specific vector by its ID
 *
 * Admin Use Case: Direct vector retrieval for debugging and data inspection
 *
 * URL Parameters:
 * - id: Vector ID (integer)
 *
 * Query Parameters:
 * - contractId: Optional contract ID (fallback to env variable)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "vector": [0.1, 0.2, 0.3, ...],
 *     "metadata": { ... }
 *   },
 *   "message": "Vector retrieved successfully"
 * }
 */
router.get(
	"/vector/:id",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const contractId = req.query.contractId as string;
			const eizenService = await getAdminEizenService(contractId);
			const vectorId = Number.parseInt(req.params.id, 10);

			if (Number.isNaN(vectorId)) {
				res
					.status(400)
					.json(
						errorResponse("Invalid vector ID", "Vector ID must be a number"),
					);
				return;
			}

			const vector = await eizenService.getVector(vectorId);

			if (!vector) {
				res
					.status(404)
					.json(
						errorResponse(
							"Vector not found",
							`No vector found with ID: ${vectorId}`,
						),
					);
				return;
			}

			res.json(successResponse(vector, "Vector retrieved successfully"));
		} catch (error) {
			console.error("Admin vector get error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to retrieve vector",
						error instanceof Error ? error.message : "Unknown error",
					),
				);
		}
	},
);

/**
 * GET /admin/
 * Get Admin database statistics and system information
 *
 * Admin Use Case: Monitor database health, storage metrics, and performance stats
 *
 * Query Parameters:
 * - contractId: Optional contract ID (fallback to env variable)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalVectors": 1234,
 *     "isInitialized": true,
 *     "memoryUsage": "45.2MB",
 *     "lastUpdated": "2025-06-15T10:30:00Z"
 *   },
 *   "message": "Database statistics retrieved"
 * }
 */
router.get("/", async (req, res) => {
	try {
		const contractId = req.query.contractId as string;
		const eizenService = await getAdminEizenService(contractId);
		const stats = await eizenService.getStats();

		res.json(successResponse(stats, "Database statistics retrieved"));
	} catch (error) {
		console.error("Admin stats error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to get database statistics",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
});

/**
 * POST /admin/deploy
 * Deploy a new Eizen contract (admin operation)
 *
 * Admin Use Case: Deploy new contract instances for system scaling or testing
 *
 * Note: This operation creates a new contract on Arweave blockchain.
 * No contractId needed as this creates a new contract.
 *
 * Response:
 * {
 *   "success": true,
 *   "data": { "contractTxId": "abc123..." },
 *   "message": "Eizen contract deployed successfully"
 * }
 */
router.post("/deploy", async (req, res) => {
	try {
		const deployResult = await EizenService.deployNewContract();
		const contractTxId = deployResult.contractId;

		res
			.status(201)
			.json(
				successResponse(
					{ contractTxId },
					"Eizen contract deployed successfully",
				),
			);
	} catch (error) {
		console.error("Admin contract deploy error:", error);
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
