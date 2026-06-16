import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, Eye, EyeOff, ArrowLeft, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import authHero from "@/assets/auth-bg-sunrise.jpg";

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
type Method = "email" | "phone";

const e164 = z.string().regex(/^\+[1-9]\d{6,14}$/, "Enter a valid number with country code, e.g. +14155551234");
const otpSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
const nationalNumberSchema = z.string().regex(/^\d{6,14}$/, "Enter a valid phone number (digits only)");

const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+39", label: "🇮🇹 +39" },
  { code: "+34", label: "🇪🇸 +34" },
  { code: "+31", label: "🇳🇱 +31" },
  { code: "+46", label: "🇸🇪 +46" },
  { code: "+47", label: "🇳🇴 +47" },
  { code: "+45", label: "🇩🇰 +45" },
  { code: "+41", label: "🇨🇭 +41" },
  { code: "+43", label: "🇦🇹 +43" },
  { code: "+32", label: "🇧🇪 +32" },
  { code: "+351", label: "🇵🇹 +351" },
  { code: "+353", label: "🇮🇪 +353" },
  { code: "+30", label: "🇬🇷 +30" },
  { code: "+48", label: "🇵🇱 +48" },
  { code: "+420", label: "🇨🇿 +420" },
  { code: "+36", label: "🇭🇺 +36" },
  { code: "+358", label: "🇫🇮 +358" },
  { code: "+7", label: "🇷🇺 +7" },
  { code: "+380", label: "🇺🇦 +380" },
  { code: "+90", label: "🇹🇷 +90" },
  { code: "+972", label: "🇮🇱 +972" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+966", label: "🇸🇦 +966" },
  { code: "+974", label: "🇶🇦 +974" },
  { code: "+965", label: "🇰🇼 +965" },
  { code: "+973", label: "🇧🇭 +973" },
  { code: "+968", label: "🇴🇲 +968" },
  { code: "+962", label: "🇯🇴 +962" },
  { code: "+961", label: "🇱🇧 +961" },
  { code: "+20", label: "🇪🇬 +20" },
  { code: "+27", label: "🇿🇦 +27" },
  { code: "+234", label: "🇳🇬 +234" },
  { code: "+254", label: "🇰🇪 +254" },
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+94", label: "🇱🇰 +94" },
  { code: "+880", label: "🇧🇩 +880" },
  { code: "+977", label: "🇳🇵 +977" },
  { code: "+86", label: "🇨🇳 +86" },
  { code: "+81", label: "🇯🇵 +81" },
  { code: "+82", label: "🇰🇷 +82" },
  { code: "+852", label: "🇭🇰 +852" },
  { code: "+886", label: "🇹🇼 +886" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+60", label: "🇲🇾 +60" },
  { code: "+66", label: "🇹🇭 +66" },
  { code: "+62", label: "🇮🇩 +62" },
  { code: "+63", label: "🇵🇭 +63" },
  { code: "+84", label: "🇻🇳 +84" },
  { code: "+64", label: "🇳🇿 +64" },
  { code: "+52", label: "🇲🇽 +52" },
  { code: "+55", label: "🇧🇷 +55" },
  { code: "+54", label: "🇦🇷 +54" },
  { code: "+56", label: "🇨🇱 +56" },
  { code: "+57", label: "🇨🇴 +57" },
  { code: "+58", label: "🇻🇪 +58" },
  { code: "+51", label: "🇵🇪 +51" },
];

function AuthPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("email");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Phone OTP state
  const [countryCode, setCountryCode] = useState("+1");
  const [nationalNumber, setNationalNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullPhone = `${countryCode}${nationalNumber}`;

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) router.navigate({ to: "/", replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) router.navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => () => { if (resendTimer.current) clearInterval(resendTimer.current); }, []);

  function startResendCooldown() {
    setResendIn(30);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) { if (resendTimer.current) clearInterval(resendTimer.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }

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

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    const digits = nationalNumber.replace(/\D/g, "");
    const nat = nationalNumberSchema.safeParse(digits);
    if (!nat.success) { toast.error(nat.error.issues[0].message); return; }
    const parsed = e164.safeParse(`${countryCode}${digits}`);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data });
      if (error) throw error;
      setOtpSent(true);
      startResendCooldown();
      toast.success("Code sent. Check your messages.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send code";
      if (/sms|provider|twilio|messagebird|not.*configured|unsupported/i.test(msg)) {
        toast.error("SMS delivery isn't configured yet. Add an SMS provider in backend settings to enable phone login.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = otpSchema.safeParse(otp.trim());
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: parsed.data,
        type: "sms",
      });
      if (error) throw error;
      router.navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  }

  function resetPhoneFlow() {
    setOtpSent(false);
    setOtp("");
    setResendIn(0);
    if (resendTimer.current) clearInterval(resendTimer.current);
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
    mode === "forgot"
      ? "Reset your password"
      : mode === "signin"
      ? "Welcome back"
      : "Create your account";
  const subtitle =
    mode === "forgot"
      ? "We'll email you a link to set a new password."
      : mode === "signin"
      ? "Sign in to continue your recovery journey."
      : "Start tracking your recovery in seconds.";

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <img src={authHero} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/40 to-black/20" />

      <div className="absolute top-6 left-6 z-10 flex items-center gap-2 text-white">
        <div className="size-9 rounded-md bg-white/15 grid place-items-center backdrop-blur">
          <Activity className="size-5" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Whoop Companion</span>
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 md:justify-end md:pr-12 lg:pr-20">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl sm:p-10">
          <header className="space-y-2">
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => { setMode("signin"); setResetSent(false); }}
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
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Tabs value={method} onValueChange={(v) => { setMethod(v as Method); resetPhoneFlow(); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email"><Mail className="size-3.5 mr-1.5" />Email</TabsTrigger>
                  <TabsTrigger value="phone"><Phone className="size-3.5 mr-1.5" />Phone</TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="mt-4">
                  <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {mode === "signin" && (
                          <button type="button" onClick={() => setMode("forgot")} className="text-xs text-muted-foreground hover:text-primary">
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

                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
                    <button
                      type="button"
                      onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {mode === "signin" ? "Sign up" : "Sign in"}
                    </button>
                  </p>
                </TabsContent>

                <TabsContent value="phone" className="mt-4">
                  {!otpSent ? (
                    <form onSubmit={sendOtp} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Phone number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          inputMode="tel"
                          placeholder="+1 415 555 1234"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          autoComplete="tel"
                        />
                        <p className="text-xs text-muted-foreground">Include your country code (e.g. +1 for US).</p>
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Sending..." : "Send code"}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        No password needed — we'll text you a 6-digit code.
                      </p>
                    </form>
                  ) : (
                    <form onSubmit={verifyOtp} className="space-y-4">
                      <button
                        type="button"
                        onClick={resetPhoneFlow}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ArrowLeft className="size-3" /> Use a different number
                      </button>
                      <div className="space-y-1.5">
                        <Label htmlFor="otp">Verification code</Label>
                        <Input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="123456"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="text-center text-lg tracking-[0.5em] font-mono"
                          required
                        />
                        <p className="text-xs text-muted-foreground">Sent to <span className="text-foreground">{phone}</span></p>
                      </div>
                      <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                        {loading ? "Verifying..." : "Verify & sign in"}
                      </Button>
                      <button
                        type="button"
                        disabled={resendIn > 0 || loading}
                        onClick={(ev) => sendOtp(ev as unknown as React.FormEvent)}
                        className="block w-full text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                      </button>
                    </form>
                  )}
                </TabsContent>
              </Tabs>
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
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.93 2.4-4.34 2.5-4.41-1.36-1.99-3.48-2.27-4.24-2.3-1.81-.18-3.53 1.06-4.45 1.06-.93 0-2.34-1.04-3.85-1.01-1.98.03-3.81 1.15-4.83 2.92-2.06 3.57-.53 8.85 1.48 11.75.98 1.42 2.15 3.02 3.69 2.96 1.48-.06 2.04-.96 3.83-.96 1.79 0 2.29.96 3.86.93 1.59-.03 2.6-1.45 3.58-2.88 1.13-1.65 1.6-3.25 1.62-3.33-.04-.02-3.11-1.19-3.14-4.73zM14.13 3.7c.82-1 1.37-2.38 1.22-3.76-1.18.05-2.61.79-3.45 1.78-.76.88-1.42 2.29-1.24 3.65 1.31.1 2.65-.67 3.47-1.67z"/>
    </svg>
  );
}
