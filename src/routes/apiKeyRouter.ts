import express from 'express';
import { auth } from '../middlewares/auth.js';
import { generateApiKey } from '../utils/apiKey.js';
import { db } from '../database/db.js';
import { apiKeyTable } from '../database/schemas/apiKey.js';
import { createApiKey, listApiKeys,  } from '../database/models/ApiKey.js';
import { eq, and } from 'drizzle-orm';
import { getUserSubscription } from '../database/models/UserSubscription.js';

export const apiKeyRouter = express.Router();

apiKeyRouter.post('/create', async (req, res) => {
    const userId = req.userId;
    const name = req.body.name || 'Default API Key';
    const description = req.body.description || 'API Key for ArchiveNet';
    
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    // Check if user has an active subscription before creating an API key
    const user_subscription = await getUserSubscription(userId);
    if(!user_subscription || !user_subscription.isActive) {
        res.status(400).json({ error: 'User subscription not found' });
        return;
    }
    const key = generateApiKey(userId);
    if (!key) {
        res.status(500).json({ error: 'Failed to generate API Key' });
    }
    const apiKey = key.apiKey; // Not stored in db
    const keyHash = key.hashedKey;
    const keyId = key.keyId;
    try{
        const createdApiKey = await createApiKey(userId, keyHash, name, description, keyId);
        if (!createdApiKey) {
            res.status(500).json({ error: 'Failed to create API Key in database' });
        }
    
        res.status(201).json({
            message: 'API Key created successfully',
            apiKey: {
                key: apiKey,
                keyPrefix: key.keyPrefix,
            }
        });
    } catch (error) {
        console.error('Error creating API Key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }  
})

apiKeyRouter.get('/list', async (req, res) => {
    const userId = req.userId;

    try {
        if(!userId) {
            res.status(401).json({ error: 'Unauthorized' }); 
            return;
        }
        const apiKeys = await listApiKeys(userId);
        if (apiKeys.length === 0) {
            res.status(204).json([]);
        }
        res.status(200).json(apiKeys);
    } catch (error) {
        console.error('Error fetching API Keys:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

apiKeyRouter.put('/update/:id', async (req, res) => {
    const userId = req.userId;
    const apiKeyId = req.params.id;
    const updates = req.body;

    try {
        if (!userId || !apiKeyId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const updatedApiKey = await db.update(apiKeyTable)
            .set({
                ...updates,
                updatedAt: new Date(),
            })
            .where(and(eq(apiKeyTable.userId, userId), eq(apiKeyTable.id, apiKeyId)))
            .returning();

        if (!updatedApiKey) {
            res.status(404).json({ error: 'API Key not found or already deleted' });
        }
        res.status(201).json(updatedApiKey);
    } catch (error) {
        console.error('Error updating API Key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

