import { enabledOAuthProviders } from "@/auth";
import { selfRegistrationEnabled } from "@/lib/users";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/signin-form";

// Only allow relative in-app redirects — never an absolute URL an attacker put
// in ?callbackUrl= (open-redirect guard).
function safeCallback(raw: string | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  return (
    <AuthCard title="Sign in to SnipVault" subtitle="Access your prompt library">
      <SignInForm
        providers={enabledOAuthProviders}
        allowRegister={selfRegistrationEnabled()}
        callbackUrl={safeCallback(callbackUrl)}
        initialError={error}
      />
    </AuthCard>
  );
}
