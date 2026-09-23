import { NextResponse } from "next/server";
import { syncMeta } from "@/lib/meta";

// Call from a cron job:  curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/sync/meta
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncMeta());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
