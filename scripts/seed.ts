import bcrypt from "bcryptjs";
import { connect } from "./_db";

// `npm run db:seed`  -> creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
// `npm run db:demo`  -> also adds sample brands, locations and 60 days of metrics
//                       so you can see the dashboard populated before Meta is connected.

const DEMO_LOCATIONS = [
  { brand: "Perstrive Coatings", name: "Dallas North", city: "Dallas", state: "TX", status: "active", base: 180 },
  { brand: "Perstrive Coatings", name: "Austin Central", city: "Austin", state: "TX", status: "active", base: 140 },
  { brand: "Perstrive Coatings", name: "Phoenix West", city: "Phoenix", state: "AZ", status: "active", base: 160 },
  { brand: "Perstrive Coatings", name: "Tampa Bay", city: "Tampa", state: "FL", status: "paused", base: 90 },
  { brand: "Perstrive Remodel", name: "Orlando East", city: "Orlando", state: "FL", status: "active", base: 120 },
  { brand: "Perstrive Remodel", name: "Denver Metro", city: "Denver", state: "CO", status: "onboarding", base: 70 },
];

async function main() {
  const demo = process.argv.includes("--demo");
  const client = await connect();

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    await client.query(
      `INSERT INTO users (email, full_name, password_hash, role) VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      [email, process.env.ADMIN_NAME ?? null, await bcrypt.hash(password, 12)],
    );
    console.log(`Admin user: ${email}`);
  } else {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin user.");
  }

  if (demo) {
    const brandIds: Record<string, string> = {};
    for (const b of new Set(DEMO_LOCATIONS.map((l) => l.brand))) {
      const existing = await client.query("SELECT id FROM brands WHERE name = $1", [b]);
      brandIds[b] =
        existing.rows[0]?.id ??
        (await client.query("INSERT INTO brands (name) VALUES ($1) RETURNING id", [b])).rows[0].id;
    }

    for (const l of DEMO_LOCATIONS) {
      const existing = await client.query("SELECT id FROM locations WHERE name = $1", [l.name]);
      const id =
        existing.rows[0]?.id ??
        (
          await client.query(
            `INSERT INTO locations (brand_id, name, city, state, status, last_synced_at)
             VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`,
            [brandIds[l.brand], l.name, l.city, l.state, l.status],
          )
        ).rows[0].id;

      for (let i = 0; i < 60; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const spend = Math.round(l.base * (0.7 + Math.random() * 0.6) * 100) / 100;
        const cpl = 28 + Math.random() * 40;
        const leads = Math.max(0, Math.round(spend / cpl));
        const impressions = Math.round(spend * (70 + Math.random() * 40));
        const clicks = Math.round(impressions * (0.01 + Math.random() * 0.015));
        const booked = Math.round(leads * (0.2 + Math.random() * 0.3));
        await client.query(
          `INSERT INTO daily_metrics (location_id, date, spend, impressions, clicks, leads, booked_appointments)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (location_id, date) DO NOTHING`,
          [id, date, spend, impressions, clicks, leads, booked],
        );
      }
    }

    const { rowCount } = await client.query("SELECT 1 FROM announcements LIMIT 1");
    if (!rowCount) {
      await client.query(
        `INSERT INTO announcements (title, body, author, pinned) VALUES
         ('Welcome to the new reporting dashboard', 'Spend, leads and cost per lead now update daily from Meta. Booked appointments are pulled from the CRM.', 'Perstrive', true),
         ('Q4 creative refresh', 'New ad creatives go live next Monday across all active locations. Expect some CPL movement during the learning phase.', 'Perstrive', false)`,
      );
    }
    console.log(`Demo data loaded for ${DEMO_LOCATIONS.length} locations.`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
