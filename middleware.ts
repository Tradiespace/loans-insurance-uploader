import { NextRequest, NextResponse } from "next/server";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the login page and auth API
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const expected = process.env.UPLOADER_PASSWORD;
  if (!expected) return NextResponse.next(); // No password set = open

  const cookie       = req.cookies.get("auth")?.value;
  const expectedHash = await sha256Hex(expected);

  if (cookie !== expectedHash) {
    // Block API calls with 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Redirect everything else to /login
    const url      = req.nextUrl.clone();
    url.pathname   = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
