"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Avatar button in the header with a dropdown: shows the signed-in user, a link
// to the admin dashboard (admins only), and sign-out.
export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!session?.user) return null;
  const { name, email, image, role } = session.user;
  const label = name || email || "Account";
  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        aria-label="Account menu"
        title={label}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-medium text-foreground">{label}</p>
            {email && (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            )}
            {role === "admin" && (
              <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Admin
              </span>
            )}
          </div>
          {role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Shield className="h-4 w-4" />
              Admin dashboard
            </Link>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/signin" })}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
