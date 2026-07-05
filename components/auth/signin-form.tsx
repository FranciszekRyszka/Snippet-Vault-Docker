"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { PROVIDER_LABELS } from "./auth-card";

export function SignInForm({
  providers,
  allowRegister,
  callbackUrl,
}: {
  providers: string[];
  allowRegister: boolean;
  callbackUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    // Full navigation so the new session cookie is picked up everywhere.
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {providers.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => signIn(p, { callbackUrl })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Continue with {PROVIDER_LABELS[p] ?? p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {allowRegister && (
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
