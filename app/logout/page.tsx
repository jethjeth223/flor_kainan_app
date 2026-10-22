"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
export default function Logout() {
  const [error, setError] = useState("");
  async function logout() {
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { error } = await client.auth.signOut();
    if (error) setError(error.message);
    else window.location.assign("/");
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Sign out?</h1>
        <p>Your kitchen records are safely saved.</p>
        {error && <p role="alert">{error}</p>}
        <button className="button primary full-width" onClick={logout}>
          Sign out
        </button>
        <a className="button secondary full-width" href="/">
          Stay signed in
        </a>
      </section>
    </main>
  );
}
