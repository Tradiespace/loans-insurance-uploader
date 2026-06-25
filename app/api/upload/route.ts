import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const webhookUrl =
    body.upload_type === "contacts"
      ? process.env.CONTACTS_WEBHOOK_URL
      : process.env.WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Webhook URL not configured for this upload type." },
      { status: 500 }
    );
  }

  // text/plain avoids a CORS preflight on the Zapier side
  const upstream = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Webhook responded with status ${upstream.status}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
