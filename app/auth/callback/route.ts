import { authClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const target = new URL(next, url.origin);
  if (
    code &&
    target.origin === url.origin &&
    next.startsWith("/") &&
    !next.startsWith("//")
  ) {
    const client = await authClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(target);
  }
  return NextResponse.redirect(new URL("/login", url.origin));
}
