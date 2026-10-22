"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeft, ArrowRight, UtensilsCrossed } from "lucide-react";

export default function LoginForm({
  initialMode = "login",
}: {
  initialMode?: "login" | "reset";
}) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    initialMode,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const configured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");
      const client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
      if (mode === "signup") {
        const result = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(data.get("name") || "").trim() },
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });
        if (result.error) throw result.error;
        setNotice(
          "Check your email to confirm your account, then sign in here.",
        );
      } else if (mode === "forgot") {
        const result = await client.auth.resetPasswordForEmail(email, {
          redirectTo:
            window.location.origin + "/auth/callback?next=/login%3Fmode=reset",
        });
        if (result.error) throw result.error;
        setNotice(
          "If your account exists, a password reset link will arrive by email.",
        );
      } else if (mode === "reset") {
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
        window.location.assign("/");
      } else {
        const result = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (result.error) throw result.error;
        window.location.assign("/");
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const title = {
    login: "Tuloy po kayo.",
    signup: "Join our kitchen.",
    forgot: "Forgot your password?",
    reset: "Choose a new password.",
  }[mode];
  return (
    <main className="auth-page">
      <a href="/" className="auth-back">
        <ArrowLeft size={18} /> Back to the kitchen
      </a>
      <section className="auth-card">
        <div className="auth-mark">
          <UtensilsCrossed size={26} />
        </div>
        <span className="eyebrow">FLOR’S KAINAN</span>
        <h1>{title}</h1>
        <p>
          Lutong bahay, alagang Flor. Your orders and messages, in one place.
        </p>
        {configured ? (
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
            )}
            {mode !== "reset" && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            )}
            {mode !== "forgot" && (
              <label>
                {mode === "reset" ? "New password" : "Password"}
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "login" ? 1 : 10}
                />
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="auth-notice" role="status">
                {notice}
              </p>
            )}
            <button className="button primary full-width" disabled={busy}>
              {busy
                ? "Sandali lang…"
                : {
                    login: "Sign in",
                    signup: "Create account",
                    forgot: "Send reset link",
                    reset: "Save password",
                  }[mode]}
              <ArrowRight size={18} />
            </button>
          </form>
        ) : (
          <p role="alert">Sign-in is being set up. Please try again later.</p>
        )}
        {mode === "login" ? (
          <div className="auth-links">
            <button
              onClick={() => {
                setMode("signup");
                setError("");
                setNotice("");
              }}
            >
              Create an account
            </button>
            <button
              onClick={() => {
                setMode("forgot");
                setError("");
                setNotice("");
              }}
            >
              Forgot password?
            </button>
          </div>
        ) : (
          <div className="auth-links">
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setNotice("");
              }}
            >
              Back to sign in
            </button>
          </div>
        )}
      </section>
      <small className="auth-footer">
        Pickup only · Mactan, Lapu-Lapu City
        <br />
        <a href="https://soeptuxxgxvluorkhkgt.supabase.co/storage/v1/object/public/app-releases/flors-kainan-0.1.1.apk?download=flors-kainan-0.1.1.apk">
          Download for Android
        </a>
      </small>
    </main>
  );
}
