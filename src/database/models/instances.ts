import { db } from '../db.js';
import { instancesTable } from '../schemas/instances.js';
import { eq, and } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

type InstanceType = InferSelectModel<typeof instancesTable>;

export async function getInstanceByUserId(userId: string): Promise<InstanceType | undefined> {
    const result = await db.query.instancesTable.findFirst({
        where: eq(instancesTable.userId, userId),
    });
    return result;
}

export async function createInstance(
    userId: string,
    instanceKeyHash: string,
    name: string,
    description: string,
): Promise<InstanceType[]> { // #TODO: Replace 'any' with the actual return type
    const instance = await db.insert(instancesTable).values({
        name,
        instanceKeyHash,
        userId,
        description,
        arweave_wallet_address: '',
    }).returning();
    return instance;
}

export async function updateInstanceKeyHash(
    userId: string,
    instanceKeyHash: string,
): Promise<InstanceType | any> {
    const [updatedInstance] = await db.update(instancesTable)
        .set({
            instanceKeyHash,
            updatedAt: new Date(),
        })
        .where(eq(instancesTable.userId, userId))
        .returning();   
    return updatedInstance;
}

export async function updateInstance(
    userId: string,
    updates: Partial<Omit<InstanceType, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'instanceKeyHash' | 'keyId'>>,
): Promise<InstanceType | undefined> {
    const [updatedInstance] = await db.update(instancesTable)
        .set({
            ...updates,
            updatedAt: new Date(),
        })
        .where(eq(instancesTable.userId, userId))
        .returning();

    return updatedInstance;
}

export async function findHashedKeyInDb(keyHash: string): Promise<InstanceType | undefined> {
    const result = await db.query.instancesTable.findFirst({
        where: eq(instancesTable.instanceKeyHash, keyHash),
    });
    return result;
}

export async function deleteInstance(userId: string, id: string): Promise<void> {
    await db.delete(instancesTable)
        .where(and(eq(instancesTable.userId, userId), eq(instancesTable.id, id)));
}

export async function listInstances(userId: string): Promise<InstanceType[]> {
    const instances = await db.query.instancesTable.findMany({
        where: eq(instancesTable.userId, userId),
    });
    return instances;
}