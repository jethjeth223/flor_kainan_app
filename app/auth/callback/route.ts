import { authClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/app-origin";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(request);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  let target: URL | null = null;
  try {
    const parsed = new URL(next, origin);
    if (parsed.origin === origin && next.startsWith("/") && !next.startsWith("//"))
      target = parsed;
  } catch {
    // An invalid return path must not break the login fallback.
  }
  const options = { headers: { "Cache-Control": "no-store" } };
  if (code && target) {
    const client = await authClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(target, options);
  }
  return NextResponse.redirect(new URL("/login", origin), options);
}
