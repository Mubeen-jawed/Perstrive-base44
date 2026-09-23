import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { connect } from "./_db";

// Applies db/schema.sql. If the database in DATABASE_URL doesn't exist yet (local Postgres),
// it is created first. Hosted databases like Neon already exist, so that step is skipped.
async function createDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  const name = decodeURIComponent(url.pathname.slice(1));
  url.pathname = "/postgres";
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  await admin.end();
  console.log(`Created database ${name}`);
}

async function main() {
  let client;
  try {
    client = await connect();
  } catch (e) {
    if ((e as { code?: string }).code !== "3D000") throw e; // 3D000 = database does not exist
    await createDatabase();
    client = await connect();
  }
  await client.query(readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8"));
  await client.end();
  console.log("Schema applied.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
