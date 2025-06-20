import { pgTable, uuid, text, timestamp, pgEnum, boolean, integer } from 'drizzle-orm/pg-core';
import { userTable } from './user.js';
import { relations } from 'drizzle-orm';

export const instancesTable = pgTable('instances', {
    id: uuid('id').primaryKey().defaultRandom(),
    instanceKeyHash: text('instance_key_hash').notNull(),
    userId: text('user_id').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    arweave_wallet_address: text('arweave_wallet_address').notNull(), // Arweave wallet address
    isActive: boolean('is_active').notNull().default(false), // Acitvate api key after creating Arweave contract
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const instanceTableRelations = relations(instancesTable, ({ one }) => ({
    userId: one(userTable, { fields: [instancesTable.userId], references: [userTable.clerkId]})
}));