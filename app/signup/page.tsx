import { redirect } from "next/navigation";
import { selfRegistrationEnabled } from "@/lib/users";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/signup-form";

export default function SignUpPage() {
  // Self-registration is opt-in; when off, there's no public sign-up.
  if (!selfRegistrationEnabled()) {
    redirect("/signin");
  }
  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building your prompt library"
    >
      <SignUpForm />
    </AuthCard>
  );
}
