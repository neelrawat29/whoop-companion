import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import authHero from "@/assets/auth-hero.jpg";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Whoop Companion" },
      { name: "description", content: "Sign in to your personal recovery tracker." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) router.navigate({ to: "/", replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) router.navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You're in.");
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (mode !== "forgot") router.navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error("Google sign-in failed");
  }

  async function apple() {
    const res = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
    if (res.error) toast.error("Apple sign-in failed");
  }

  const title =
    mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password";
  const subtitle =
    mode === "signin"
      ? "Sign in to continue your recovery journey."
      : mode === "signup"
      ? "Start tracking your recovery in seconds."
      : "We'll email you a link to set a new password.";

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Full-bleed background */}
      <img
        src={authHero}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/40 to-black/20" />

      {/* Brand watermark */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-2 text-white">
        <div className="size-9 rounded-md bg-white/15 grid place-items-center backdrop-blur">
          <Activity className="size-5" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Whoop Companion</span>
      </div>

      {/* Floating card */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 md:justify-end md:pr-12 lg:pr-20">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl sm:p-10">
          <header className="space-y-2">
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setResetSent(false);
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3" />
                Back to sign in
              </button>
            )}
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </header>

          <div className="mt-8 space-y-6">
          {mode === "forgot" ? (
            resetSent ? (
              <div className="space-y-4 rounded-md border border-border bg-accent/40 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Mail className="size-4 text-primary" />
                  Check your email
                </div>
                <p className="text-muted-foreground">
                  We sent a reset link to <span className="text-foreground">{email}</span>. It expires in 1 hour.
                </p>
              </div>
            ) : (
              <form onSubmit={sendReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            )
          ) : (
            <>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={google}>
                  <GoogleIcon className="size-4" />
                  Continue with Google
                </Button>
                <Button variant="outline" className="w-full" onClick={apple}>
                  <AppleIcon className="size-4" />
                  Continue with Apple
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or with email</span>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to our <Link to="/" className="underline hover:text-foreground">Terms</Link> and{" "}
            <Link to="/" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
          </div>
        </div>
      </main>
    </div>
  );
}


function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.42-1.7 4.16-5.5 4.16-3.31 0-6.01-2.74-6.01-6.12S8.69 6.02 12 6.02c1.88 0 3.14.8 3.86 1.49l2.63-2.53C16.8 3.43 14.62 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.93 0 9.5-4.86 9.5-7.36 0-.5-.05-.88-.12-1.25H12z"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.22-1.25 3.05-.84.84-1.93 1.34-2.99 1.27-.13-1.1.42-2.27 1.18-3.06.83-.86 2.06-1.42 3.06-1.26zM20.5 17.16c-.55 1.27-.81 1.83-1.51 2.96-.98 1.57-2.36 3.52-4.07 3.54-1.52.02-1.91-.99-3.97-.97-2.06.01-2.49.99-4.01.97-1.71-.02-3.02-1.78-4-3.34C-.07 15.43-.36 9.96 1.84 7.04 3.4 4.97 5.86 3.79 8.18 3.79c2.36 0 3.84 1.29 5.79 1.29 1.89 0 3.05-1.3 5.78-1.3 2.06 0 4.24 1.12 5.8 3.06-5.1 2.79-4.27 10.08-.05 10.32z"/>
    </svg>
  );
}
