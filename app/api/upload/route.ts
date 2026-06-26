import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

type ContactRecord = Record<string, unknown>;

export type ProgressEvent =
  | { stage: "hubspot" | "beehiiv"; processed: number; total: number }
  | { stage: "waiting"; source: "hubspot" | "beehiiv"; seconds: number }
  | { stage: "done";  processed: number; total: number }
  | { stage: "error"; message: string };

const BEEHIIV_CUSTOM_FIELDS: Record<string, string> = {
  email:                    "Email Address",
  firstname:                "First Name",
  lastname:                 "Last Name",
  phone:                    "Contact Number",
  trade:                    "Trade",
  business_name:            "Business Name",
  business_size:            "Business Size",
  are_you_a_business_owner: "Are You A Business Owner",
  abn:                      "ABN",
  location:                 "Location",
  state__territory:         "State / Territory",
  signed_up:                "Signed Up",
  verified_trade_account:   "Verified Trade Account",
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch with 429 retry + exponential backoff.
 * Reads RateLimit-Reset (Beehiiv) or Retry-After (HubSpot) from headers.
 * Calls onWait() before sleeping so the UI can show the pause.
 */
async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  source: "hubspot" | "beehiiv",
  onWait: (source: "hubspot" | "beehiiv", seconds: number) => void,
  maxRetries = 4
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;

    const resetHeader      = res.headers.get("RateLimit-Reset"); // Beehiiv: unix ts (s)
    const retryAfterHeader = res.headers.get("Retry-After");     // seconds

    let waitMs: number;
    if (resetHeader) {
      waitMs = Math.max(0, parseInt(resetHeader) * 1000 - Date.now()) + 1000;
    } else if (retryAfterHeader) {
      waitMs = parseInt(retryAfterHeader) * 1000 + 500;
    } else {
      // Exponential backoff: 2s, 4s, 8s, 16s
      waitMs = Math.min(1000 * Math.pow(2, attempt + 1), 30_000);
    }

    if (attempt < maxRetries) {
      onWait(source, Math.ceil(waitMs / 1000));
      await sleep(waitMs);
    } else {
      throw new Error(`${source === "hubspot" ? "HubSpot" : "Beehiiv"} rate limit: max retries exceeded`);
    }
  }
  // Unreachable but satisfies TS
  throw new Error("fetchWithBackoff: unexpected exit");
}

/* ─── HubSpot ────────────────────────────────────────────────
   Batch upsert (100 contacts/request).
   Checks X-HubSpot-RateLimit-Remaining after each batch and
   pauses proactively before the limit is hit.
──────────────────────────────────────────────────────────── */
async function upsertHubSpotContacts(
  records: ContactRecord[],
  apiKey: string,
  send: (e: ProgressEvent) => void
) {
  const total   = records.length;
  const batches = chunk(records, 100);
  let processed = 0;

  const onWait = (source: "hubspot" | "beehiiv", seconds: number) =>
    send({ stage: "waiting", source, seconds });

  for (let i = 0; i < batches.length; i++) {
    const inputs = batches[i].map((r) => ({
      properties: Object.fromEntries(
        Object.entries(r).filter(([, v]) => v !== "" && v != null)
      ),
      id:         String(r.email),
      idProperty: "email",
    }));

    const res = await fetchWithBackoff(
      "https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert",
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body:    JSON.stringify({ inputs }),
      },
      "hubspot",
      onWait
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`HubSpot batch ${i + 1} failed: ${body.message || res.status}`);
    }

    processed += batches[i].length;
    send({ stage: "hubspot", processed, total });

    if (i < batches.length - 1) {
      // Proactive pause: if remaining capacity is ≤ 2, wait out the full interval
      const remaining  = parseInt(res.headers.get("X-HubSpot-RateLimit-Remaining") ?? "99");
      const intervalMs = parseInt(res.headers.get("X-HubSpot-RateLimit-Interval-Milliseconds") ?? "10000");

      if (remaining <= 2) {
        const waitSecs = Math.ceil((intervalMs + 200) / 1000);
        send({ stage: "waiting", source: "hubspot", seconds: waitSecs });
        await sleep(intervalMs + 200);
      } else {
        await sleep(150); // small breathing room between batches
      }
    }
  }
}

/* ─── Beehiiv ────────────────────────────────────────────────
   Sequential — one request per contact with 340ms base delay
   (safely under the 3 req/s = 180 req/min limit).
   Checks RateLimit-Remaining after each call and pauses until
   RateLimit-Reset when headroom drops below 10.
──────────────────────────────────────────────────────────── */
async function syncBeehiivSubscribers(
  records: ContactRecord[],
  apiKey: string,
  pubId: string,
  send: (e: ProgressEvent) => void
) {
  const total   = records.length;
  let processed = 0;

  const onWait = (source: "hubspot" | "beehiiv", seconds: number) =>
    send({ stage: "waiting", source, seconds });

  for (const record of records) {
    const custom_fields = Object.entries(BEEHIIV_CUSTOM_FIELDS)
      .filter(([key]) => record[key] !== "" && record[key] != null)
      .map(([key, name]) => ({ name, value: String(record[key]) }));

    const res = await fetchWithBackoff(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          email:               record.email,
          reactivate_existing: false,
          send_welcome_email:  false,
          custom_fields,
        }),
      },
      "beehiiv",
      onWait
    );

    // 409 = subscriber already exists and unchanged — not an error
    if (!res.ok && res.status !== 409) {
      console.error(`Beehiiv: ${record.email} → ${res.status}`);
    }

    processed++;
    send({ stage: "beehiiv", processed, total });

    // Proactive: if remaining headroom drops below 10, wait until the window resets
    const remaining = parseInt(res.headers.get("RateLimit-Remaining") ?? "999");
    const resetTs   = parseInt(res.headers.get("RateLimit-Reset")     ?? "0");

    if (remaining < 10 && resetTs > 0) {
      const waitMs   = Math.max(0, resetTs * 1000 - Date.now()) + 500;
      const waitSecs = Math.ceil(waitMs / 1000);
      send({ stage: "waiting", source: "beehiiv", seconds: waitSecs });
      await sleep(waitMs);
    } else {
      // 340ms between calls → ~2.9 req/s, safely under the 3 req/s cap
      await sleep(340);
    }
  }
}

/* ─── Contact processing ─────────────────────────────────── */
async function processContacts(
  records: ContactRecord[],
  send: (e: ProgressEvent) => void
) {
  const hubspotKey = process.env.HUBSPOT_API_KEY;
  const beehiivKey = process.env.BEEHIIV_API_KEY;
  const pubId      = process.env.BEEHIIV_PUBLICATION_ID;

  if (!hubspotKey)         throw new Error("HUBSPOT_API_KEY not configured");
  if (!beehiivKey || !pubId) throw new Error("Beehiiv credentials not configured");

  await upsertHubSpotContacts(records, hubspotKey, send);
  await syncBeehiivSubscribers(records, beehiivKey, pubId, send);
  send({ stage: "done", processed: records.length, total: records.length });
}

/* ─── Route handler ──────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.upload_type === "contacts") {
    const testLimit      = process.env.UPLOAD_TEST_LIMIT ? parseInt(process.env.UPLOAD_TEST_LIMIT, 10) : null;
    const allRecords: ContactRecord[] = body.records ?? [];
    const records        = testLimit ? allRecords.slice(0, testLimit) : allRecords;

    const encoder = new TextEncoder();
    const stream  = new ReadableStream({
      async start(controller) {
        const send = (event: ProgressEvent) =>
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        try {
          await processContacts(records, send);
        } catch (err) {
          send({ stage: "error", message: err instanceof Error ? err.message : "Unknown error" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Loans / Insurance → Zapier webhook
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Webhook URL not configured." }, { status: 500 });
  }

  const upstream = await fetch(webhookUrl, {
    method:  "POST",
    headers: { "Content-Type": "text/plain" },
    body:    JSON.stringify(body),
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Webhook responded with status ${upstream.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
