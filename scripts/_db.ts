import "dotenv/config";
import { Client } from "pg";

export async function connect() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}
