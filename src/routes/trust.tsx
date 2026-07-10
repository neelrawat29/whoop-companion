import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, Mail, Lock, Database, Cookie, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & Privacy — Cove" },
      { name: "description", content: "Security, privacy, and data practices for Cove." },
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <Activity className="size-5 text-primary" />
            <span>Cove</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Back to app</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12 space-y-8">
        {/* Qualifier */}
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 border border-border">
          <p className="font-medium text-foreground mb-1">About this page</p>
          <p>
            This page is maintained by the app owner to answer common security and privacy questions about Cove.
            It describes current controls and practices; it is not an independent certification or audit report.
          </p>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Trust & Privacy</h1>
          <p className="text-muted-foreground">
            How we protect your data and what you can expect when using Cove.
          </p>
        </div>

        {/* Access & Authentication */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Lock className="size-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Access & Authentication</CardTitle>
              <CardDescription>How accounts and access are secured.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Cove uses email/password authentication and OAuth providers (Google, Apple)
              managed by the platform auth service. Passwords are hashed and never stored in plain text.
              Row-level security policies ensure users can only access their own data.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>All data access requires authentication.</li>
              <li>Database queries are scoped to the authenticated user.</li>
              <li>Session tokens are managed securely by the auth provider.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Platform & Hosting */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Shield className="size-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Platform & Hosting</CardTitle>
              <CardDescription>Where the app runs and how it is kept online.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The application is hosted on a managed edge platform with automatic HTTPS, DDoS protection,
              and continuous deployment. The database is a managed PostgreSQL service with automated backups
              and point-in-time recovery.
            </p>
            <p>
              <span className="font-medium text-foreground">Shared responsibility:</span> The platform provides
              infrastructure security (network, compute, storage). The app owner is responsible for application-level
              security (authentication, access controls, input validation, and data handling).
            </p>
          </CardContent>
        </Card>

        {/* Data Collection & Use */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Database className="size-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Data Collection & Use</CardTitle>
              <CardDescription>What data is collected and why.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Cove collects health and wellness data that you choose to log — such as sleep scores,
              recovery metrics, meals, supplements, and body measurements. This data is used solely to provide
              personal insights and recommendations inside the app.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>We do not sell personal data to third parties.</li>
              <li>We do not use your health data for advertising.</li>
              <li>Data is stored in the region associated with your project.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Cookies & Analytics */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Cookie className="size-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Cookies & Analytics</CardTitle>
              <CardDescription>Tracking and analytics practices.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The app uses essential cookies for authentication and session management. Optional analytics
              may be enabled to understand usage and improve features. Analytics data is aggregated and anonymized
              where possible.
            </p>
          </CardContent>
        </Card>

        {/* Retention & Deletion */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Trash2 className="size-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Retention & Deletion</CardTitle>
              <CardDescription>How long data is kept and how to delete it.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Your data is retained for as long as your account is active. You can export your data at any time
              from the Settings page. To delete your account and all associated data, contact us using the
              email below.
            </p>
          </CardContent>
        </Card>

        {/* Privacy Requests & Contact */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Mail className="size-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Privacy Requests & Contact</CardTitle>
              <CardDescription>How to reach us about privacy or security questions.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              For privacy-related requests (access, correction, deletion, portability) or general security
              questions, please contact the app owner at the email address provided in the app.
            </p>
          </CardContent>
        </Card>

        {/* Vulnerability Reporting */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <AlertTriangle className="size-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-base">Vulnerability Reporting</CardTitle>
              <CardDescription>How to report a security issue.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              If you discover a security vulnerability, please report it responsibly. Do not exploit the issue
              or publicly disclose details before a fix is in place. Contact the app owner with a description
              of the issue, steps to reproduce, and potential impact.
            </p>
          </CardContent>
        </Card>

        {/* Footer qualifier */}
        <p className="text-xs text-muted-foreground text-center pt-4">
          This page was last updated on {new Date().toLocaleDateString()} and reflects the current practices
          of Cove. Controls and practices may evolve over time.
        </p>
      </main>
    </div>
  );
}
