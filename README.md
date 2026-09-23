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

The app runs under PM2 on port **7006**, bound to 127.0.0.1. nginx serves it at **https://base44.blendfoldmedia.com**, with a certificate from Let's Encrypt. Run these commands from Git Bash:

```bash
cp deploy/deploy.config.example deploy/deploy.config   # set VPS_HOST (and VPS_USER if not root)
./deploy/deploy.sh setup    # first time: Node 22, PM2, nginx site, SSL, Meta sync cron, .env, deploy
./deploy/deploy.sh          # every later deploy
```

Before running `setup`, add a DNS **A record** pointing `base44` → your VPS IP. Otherwise the SSL step fails and logins won't work, because the session cookie is HTTPS-only in production. If that happens, fix DNS and run `./deploy/deploy.sh ssl`.

On the server:
- Each deploy goes into `/var/www/perstrive-dashboard/releases/<timestamp>` and runs `npm ci`, `db:migrate` and `build`. If `/login` responds, `current` switches to the new release. If it doesn't, the script rolls back to the previous release. The last 5 releases are kept.
- `.env` is stored once in `shared/.env`. Run `./deploy/deploy.sh env` after changing your local `.env`, for example with a new Meta token.
- The Meta sync runs every 3 hours from cron and logs to `shared/sync.log`.
- Other commands: `./deploy/deploy.sh status` and `./deploy/deploy.sh logs`.
