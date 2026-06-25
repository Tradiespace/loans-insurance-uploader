import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

function hashPassword(pw: string): string {
  return createHash("sha256").update(pw).digest("hex");
}

// POST /api/auth — validate password and set session cookie
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.UPLOADER_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", hashPassword(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}

// DELETE /api/auth — clear session cookie (logout)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("auth");
  return res;
}
