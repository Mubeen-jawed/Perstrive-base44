import { connect } from "./_db";

// Creates a location for every Meta ad account (visible to META_ACCESS_TOKEN) whose name
// contains the given text. Existing locations with the same ad account ID are left as-is.
//
// Usage: npm run meta:import -- perstrive

const ACTIVE = 1; // Meta account_status: 1 = active, 2 = disabled, 3 = unsettled, 101 = closed

async function main() {
  const match = (process.argv[2] ?? "").toLowerCase();
  const token = process.env.META_ACCESS_TOKEN;
  if (!match) throw new Error("Usage: npm run meta:import -- <text in account name>");
  if (!token) throw new Error("META_ACCESS_TOKEN is not set.");

  const version = process.env.META_API_VERSION || "v23.0";
  const accounts: { id: string; name: string; account_status: number }[] = [];
  let url: string | undefined =
    `https://graph.facebook.com/${version}/me/adaccounts?fields=id,name,account_status&limit=200&access_token=${token}`;
  while (url) {
    const res: Response = await fetch(url);
    const json: { data?: typeof accounts; paging?: { next?: string }; error?: { message: string } } =
      await res.json();
    if (json.error) throw new Error(json.error.message);
    accounts.push(...(json.data ?? []));
    url = json.paging?.next;
  }

  const picked = accounts.filter((a) => a.name.toLowerCase().includes(match));
  const client = await connect();
  let added = 0;
  for (const a of picked) {
    const exists = await client.query("SELECT 1 FROM locations WHERE meta_ad_account_id = $1", [a.id]);
    if (exists.rowCount) continue;
    // "Patriot Coatings Denver - Perstrive" -> "Patriot Coatings Denver"
    const name = a.name.replace(/\s*-\s*perstrive\s*$/i, "").trim() || a.name.trim();
    await client.query(
      "INSERT INTO locations (name, meta_ad_account_id, status) VALUES ($1, $2, $3)",
      [name, a.id, a.account_status === ACTIVE ? "active" : "paused"],
    );
    added++;
    console.log(`+ ${name}  (${a.id}, ${a.account_status === ACTIVE ? "active" : "paused"})`);
  }
  await client.end();
  console.log(`\n${picked.length} matching accounts, ${added} new locations added.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
