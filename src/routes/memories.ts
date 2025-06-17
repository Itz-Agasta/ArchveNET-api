import { type Request, type Response, Router } from "express";
import { validateData } from "../middlewares/validate.js";
import { createMemorySchema, searchMemorySchema } from "../schemas/memory.js";
import { EizenService } from "../services/EizenService.js";
import { MemoryService } from "../services/MemoryService.js";
import { errorResponse, successResponse } from "../utils/responses.js";

//  User-facing semantic memory API

const router = Router();

// TODO: Replace this with actual user lookup from SQL database
// This will be implemented when payment gateway integration is added
async function getUserMemoryService(req: Request): Promise<MemoryService> {
	// TODO: Extract API key from request headers
	// const apiKey = req.headers['x-api-key'] as string;

	// TODO: Look up user's contract ID from database
	// const user = await getUserByApiKey(apiKey);
	// const eizenService = await EizenService.forContract(user.contractId);
	// return new MemoryService(eizenService);

	// For now, use environment variable as fallback (single tenant mode)
	const contractId = process.env.EIZEN_CONTRACT_ID;
	if (!contractId) {
		throw new Error(
			"No contract ID available. Please implement user lookup or set EIZEN_CONTRACT_ID",
		);
	}

	const eizenService = await EizenService.forContract(contractId);
	return new MemoryService(eizenService);
}

/**
 * POST /memories/insert
 * Create a new memory from text content
 * This endpoint converts text to embeddings and stores in Eizen
 *
 * Request body:
 * {
 *   "content": "User's favorite color is blue",
 *   "metadata": {
 *     "context": "preference setting",
 *     "importance": 7,
 *     "tags": ["preference", "color"],
 *     "timestamp": "2025-06-06T14:30:00Z",
 *     "client": "cursor"
 *   }
 * }
 */
router.post("/insert", validateData(createMemorySchema), async (req, res) => {
	try {
		const memoryService = await getUserMemoryService(req);
		const result = await memoryService.createMemory(req.body);

		res
			.status(201)
			.json(successResponse(result, "Memory created successfully"));
	} catch (error) {
		console.error("Memory creation error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to create memory",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
});

/**
 * GET /memories/search
 * Search for memories using natural language query
 * This endpoint converts text query to embeddings and searches Eizen
 *
 * Query parameters:
 * - query: The search text
 * - k: Number of results (optional, default 10)
 * - filters: Optional JSON string with search filters
 */
router.get("/search", async (req: Request, res: Response): Promise<void> => {
	try {
		const { query, k, filters } = req.query;

		if (!query || typeof query !== "string") {
			res
				.status(400)
				.json(
					errorResponse(
						"Invalid query parameter",
						"Query parameter is required and must be a string",
					),
				);
			return;
		}

		// Parse search request
		const searchRequest = {
			query,
			k: k ? Number.parseInt(k as string, 10) : 10,
			filters: filters ? JSON.parse(filters as string) : undefined,
		};

		// Validate the search request
		const validatedRequest = searchMemorySchema.parse(searchRequest);

		const memoryService = await getUserMemoryService(req);
		const results = await memoryService.searchMemories(validatedRequest);

		res.json(
			successResponse(results, `Found ${results.length} relevant memories`),
		);
	} catch (error) {
		console.error("Memory search error:", error);

		if (error instanceof SyntaxError) {
			res
				.status(400)
				.json(
					errorResponse(
						"Invalid filters parameter",
						"Filters must be valid JSON",
					),
				);
			return;
		}

		res
			.status(500)
			.json(
				errorResponse(
					"Failed to search memories",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
});

/**
 * POST /memories/search
 * Alternative POST endpoint for memory search with request body
 * Useful for complex search queries
 *
 * Request body:
 * {
 *   "query": "favorite color preference",
 *   "k": 5,
 *   "filters": {
 *     "tags": ["preference", "color"],
 *     "importance_min": 5
 *   }
 * }
 */
router.post("/search", validateData(searchMemorySchema), async (req, res) => {
	try {
		const memoryService = await getUserMemoryService(req);
		const results = await memoryService.searchMemories(req.body);

		res.json(
			successResponse(results, `Found ${results.length} relevant memories`),
		);
	} catch (error) {
		console.error("Memory search error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to search memories",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
});

/**
 * GET /memories/search/:id
 * Get a specific memory by its vector ID
 */
router.get(
	"/search/:id",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const memoryService = await getUserMemoryService(req);
			const memoryId = Number.parseInt(req.params.id, 10);

			if (Number.isNaN(memoryId)) {
				res
					.status(400)
					.json(
						errorResponse("Invalid memory ID", "Memory ID must be a number"),
					);
				return;
			}

			const memory = await memoryService.getMemory(memoryId);

			if (!memory) {
				res
					.status(404)
					.json(
						errorResponse(
							"Memory not found",
							`No memory found with ID: ${memoryId}`,
						),
					);
				return;
			}

			res.json(successResponse(memory, "Memory retrieved successfully"));
		} catch (error) {
			console.error("Memory get error:", error);
			res
				.status(500)
				.json(
					errorResponse(
						"Failed to retrieve memory",
						error instanceof Error ? error.message : "Unknown error",
					),
				);
		}
	},
);

/**
 * GET /memories
 * Get memory statistics and database info
 */
router.get("/", async (req, res) => {
	try {
		const memoryService = await getUserMemoryService(req);
		const stats = await memoryService.getStats();

		res.json(successResponse(stats, "Memory statistics retrieved"));
	} catch (error) {
		console.error("Memory stats error:", error);
		res
			.status(500)
			.json(
				errorResponse(
					"Failed to get memory statistics",
					error instanceof Error ? error.message : "Unknown error",
				),
			);
	}
});

export default router;
