import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/app/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  if (process.env.SUPABASE_EGRESS_METRICS === "1" && request.nextUrl.pathname === "/auth/callback") {
    console.info(JSON.stringify({ event: "auth_callback_received" }));
  }
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
