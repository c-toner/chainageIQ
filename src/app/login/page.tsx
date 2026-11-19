"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import Link from "next/link";
export default function Login() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
        throw new Error("Configure Supabase before signing in.");
      const db = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );
      const { error } = await db.auth.signInWithOtp({
        email: String(new FormData(e.currentTarget).get("email")),
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
      setMessage("Check your email for a secure sign-in link.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="setup-page login">
      <div className="brand-mark">
        C<span>IQ</span>
      </div>
      <div className="eyebrow">WELCOME TO CHAINAGEIQ</div>
      <h1>
        Keep your project
        <br />
        moving forward.
      </h1>
      <form className="setup-card" onSubmit={login}>
        <h2>Sign in to your workspace</h2>
        <p>We’ll email you a secure, single-use link.</p>
        <label>
          Work email
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@contractor.com.au"
            required
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Sending…" : "Email sign-in link"}
        </button>
        <p role="status">{message}</p>
        <Link href="/demo">Explore the read-only demonstration</Link>
      </form>
    </main>
  );
}
