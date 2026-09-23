# Perstrive Dashboard

Marketing reporting dashboard (Overview, Location Leaderboard, Location detail, Announcements, Admin) built with Next.js 15 (App Router), PostgreSQL and Tailwind CSS 4. It uses the reference app's design tokens and layout.

## Setup

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and ADMIN_EMAIL / ADMIN_PASSWORD
npm run db:migrate            # creates the database if needed and applies db/schema.sql
npm run db:seed               # creates the admin user from .env
npm run db:demo               # optional: sample brands, locations, 60 days of metrics
npm run dev                   # http://localhost:3000
```

For Neon, paste the connection string from the Neon console (keeps `?sslmode=require`). For local Postgres on this machine (port **5001**):
`DATABASE_URL=postgres://postgres:<password>@localhost:5001/perstrive`

Add more users from Admin Settings → User Access, or from the CLI:

```bash
npm run user:create -- jane@client.com "TempPass123" member "Jane Doe"
```

## Auth

- Email + password, bcrypt-hashed. A session is a random token in an httpOnly cookie. Only its SHA-256 hash is stored in the `sessions` table, and it expires after 30 days.
- `src/middleware.ts` sends requests without a cookie to `/login`. `src/app/(app)/layout.tsx` checks the session against the database.
- Roles: `admin` (can use Admin Settings and post announcements) and `member` (read-only).

## Data model (`db/schema.sql`)

| Table | Purpose |
| --- | --- |
| `brands` | Groups locations (leaderboard filter, announcement targeting) |
| `locations` | One per client location, with `meta_ad_account_id` and `status` |
| `daily_metrics` | One row per location per day: spend, impressions, clicks, leads, booked_appointments |
| `announcements`, `announcement_reads` | Posts and per-user read tracking (for the sidebar unread count) |
| `users`, `sessions` | Auth |

Every KPI comes from `daily_metrics`: CPL = spend / leads, and Leads per $1k = leads / (spend / 1000). A location shows green when Leads per $1k is at least 20 (`LP1K_TARGET` in `src/lib/format.ts`).

## Connecting the Meta API

The sync is already wired up in `src/lib/meta.ts`. To turn it on:

1. Set `META_ACCESS_TOKEN` in `.env`. Use a System User token with `ads_read` on the ad accounts.
2. Enter each location's **Meta Ad Account ID** in Admin Settings → Locations. It works with or without the `act_` prefix.
3. Click **Sync Now** in Admin Settings, or have a cron job call it:

   ```bash
   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/sync/meta
   ```

The sync pulls the last `META_SYNC_DAYS` days of daily account insights and upserts spend, impressions, clicks and leads. Leads come from the first of `lead`, `onsite_conversion.lead_grouped` or `offsite_conversion.fb_pixel_lead` found in the insights. The sync never touches `booked_appointments`, so you can fill that column from your CRM.

## Deploying to the VPS

The app runs under PM2 on port **7006**, bound to 127.0.0.1. nginx serves it at **https://base44.blendfoldmedia.com**. Both scripts run **on the VPS**, inside the project folder:

```bash
# on the VPS: put the project in a folder (e.g. /var/www/perstrive-dashboard) with your .env, then
./deploy.sh    # first time: Node 22, PM2, nginx site, SSL, Meta sync cron, build and start
./update.sh    # after each code change: install, migrate, build, swap in, restart
```

Before running `deploy.sh`, the DNS **A record** for `base44` must point at the VPS. Otherwise the SSL step fails and logins won't work, because the session cookie is HTTPS-only in production. `deploy.sh` is safe to re-run.

`update.sh` runs `git pull` first if the folder is a git checkout. It builds into `.next-build` while the live site keeps running, and only swaps the new build in once it succeeds. If the app doesn't come back up, it restores the previous build. The Meta sync runs every 3 hours and logs to `sync.log`.
