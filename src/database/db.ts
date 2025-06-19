import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import * as schema1 from "./schemas/user.js";
import * as schema2 from "./schemas/instances.js";
import * as schema3 from "./schemas/subscriptions.js";

const schema = {
    ...schema1,
    ...schema2,
    ...schema3,
}

config({ path: ".env" }); // or .env.local
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const sql = neon(DATABASE_URL);
export const db = drizzle({ client: sql, schema });
