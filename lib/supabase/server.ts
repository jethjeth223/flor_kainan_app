import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth is not configured");
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values)
          jar.set(name, value, options);
      },
    },
  });
}
export async function currentUser() {
  const client = await authClient();
  // Validate with Auth, never trust an unsigned header or getSession alone.
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !user.email_confirmed_at || !user.email) return null;
  const name =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  return {
    userId: user.id,
    email: user.email,
    displayName: name || user.email,
    fullName: name,
  };
}
