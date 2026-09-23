import bcrypt from "bcryptjs";
import { connect } from "./_db";

// Usage: npm run user:create -- email@example.com "Password123" [admin|member] ["Full Name"]
async function main() {
  const [email, password, role = "member", fullName] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error('Usage: npm run user:create -- <email> <password (8+ chars)> [admin|member] ["Full Name"]');
    process.exit(1);
  }
  const client = await connect();
  await client.query(
    `INSERT INTO users (email, full_name, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
       full_name = COALESCE(EXCLUDED.full_name, users.full_name)`,
    [email.toLowerCase(), fullName ?? null, await bcrypt.hash(password, 12), role === "admin" ? "admin" : "member"],
  );
  await client.end();
  console.log(`Saved ${role} user ${email}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
