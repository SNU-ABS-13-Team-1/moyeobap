import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/app/lib/supabase/config";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

function safeInternalUrl(request: NextRequest, value: string | null): URL {
  try {
    const target = new URL(value || "/", request.nextUrl.origin);
    return target.origin === request.nextUrl.origin
      ? target
      : new URL("/", request.nextUrl.origin);
  } catch {
    return new URL("/", request.nextUrl.origin);
  }
}

function errorRedirect(request: NextRequest, reason: string) {
  const target = new URL("/", request.nextUrl.origin);
  target.searchParams.set("authError", reason);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  if (!getSupabaseConfig()) return errorRedirect(request, "not_configured");

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return errorRedirect(request, "missing_code");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return errorRedirect(request, "exchange_failed");

  const metadata = data.user.user_metadata;
  const displayName =
    (typeof metadata?.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata?.name === "string" && metadata.name.trim()) ||
    data.user.email?.split("@")[0] ||
    "사용자";
  const avatarUrl = typeof metadata?.avatar_url === "string" ? metadata.avatar_url : null;

  // 트리거가 아직 적용되지 않은 개발 DB에서도 최초 프로필을 보완합니다.
  await supabase.from("profiles").upsert(
    {
      id: data.user.id,
      display_name: displayName.slice(0, 40),
      avatar_url: avatarUrl,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  return NextResponse.redirect(safeInternalUrl(request, request.nextUrl.searchParams.get("next")));
}
