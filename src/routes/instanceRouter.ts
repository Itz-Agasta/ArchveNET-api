import express from 'express';
import { auth } from '../middlewares/auth.js';
import { generateContractHash } from '../utils/contractHash.js';
import { db } from '../database/db.js';
import { instancesTable } from '../database/schemas/instances.js';
import { createInstance, getInstanceByUserId, listInstances  } from '../database/models/instances.js';
import { eq, and } from 'drizzle-orm';
import { getUserSubscription } from '../database/models/UserSubscription.js';

export const instanceRouter = express.Router();

instanceRouter.post('/create', async (req, res) => {
    const userId = req.userId;
    const name = req.body.name || 'Default Instance';
    const description = req.body.description || 'Your ArchiveNET instance';
    
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    // Check if user has an active subscription before creating an instance
    const user_subscription = await getUserSubscription(userId);
    if(!user_subscription || !user_subscription.isActive) {
        res.status(400).json({ error: 'User subscription not found' });
        return;
    }

    //Check if user already has an instance
    const existingInstance = await getInstanceByUserId(userId);
    if (existingInstance) {
        res.status(201).json(existingInstance);
        return;
    }

    try{
        const createdApiKey = await createInstance(userId, "", name, description);
        if (!createdApiKey) {
            res.status(500).json({ error: 'Failed to create Instance in database' });
        }
    
        res.status(201).json({
            message: 'Your instance was generated successfully'
        })
    } catch (error) {
        console.error('Error creating Instance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }  
})

instanceRouter.get('/list', async (req, res) => {
    const userId = req.userId;

    try {
        if(!userId) {
            res.status(401).json({ error: 'Unauthorized' }); 
            return;
        }
        const apiKeys = await listInstances(userId);
        if (apiKeys.length === 0) {
            res.status(204).json([]);
        }
        res.status(200).json(apiKeys);
    } catch (error) {
        console.error('Error fetching API Keys:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

instanceRouter.put('/update/:id', async (req, res) => {
    const userId = req.userId;
    const apiKeyId = req.params.id;
    const updates = req.body;

    try {
        if (!userId || !apiKeyId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const updatedApiKey = await db.update(instancesTable)
            .set({
                ...updates,
                updatedAt: new Date(),
            })
            .where(and(eq(instancesTable.userId, userId), eq(instancesTable.id, apiKeyId)))
            .returning();

        if (!updatedApiKey) {
            res.status(404).json({ error: 'Instance not found or already deleted' });
        }
        res.status(201).json(updatedApiKey);
    } catch (error) {
        console.error('Error updating API Key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

