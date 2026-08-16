import { NextResponse, type NextRequest } from "next/server";
import { AUTH_RETURN_COOKIE, normalizeAuthReturnPath } from "@/app/lib/auth-return";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const returnPath = normalizeAuthReturnPath(body?.returnPath);
  const response = NextResponse.json({ ok: true });

  response.cookies.set(AUTH_RETURN_COOKIE, returnPath, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
