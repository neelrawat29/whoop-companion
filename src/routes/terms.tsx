import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LEGAL_CONTACT_EMAIL } from "@/components/LegalLayout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Cove" },
      { name: "description", content: "The terms that govern your use of the Cove health companion app." },
      { property: "og:title", content: "Terms of Service — Cove" },
      { property: "og:description", content: "The terms that govern your use of the Cove health companion app." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>
        By creating an account or using Cove on the web or iOS, you agree to these terms. If you do not agree,
        please do not use Cove.
      </p>

      <h2>1. The service</h2>
      <p>
        Cove helps you log and understand wellness data such as recovery, sleep, nutrition, hydration,
        supplements and weight, and offers AI-generated estimates and coaching.
      </p>

      <h2>2. Not medical advice</h2>
      <p>
        Cove is for general wellness and informational purposes only. It is not a medical device and does not
        diagnose, treat or prevent any condition. AI estimates (including meal macros and biological age) may be
        inaccurate. Always consult a qualified professional before making health decisions.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You must be at least 16 years old.</li>
        <li>You are responsible for keeping your login secure and for activity on your account.</li>
        <li>Provide accurate information and do not impersonate others.</li>
      </ul>

      <h2>4. Third-party connections</h2>
      <p>
        You may connect services such as WHOOP or Apple Health. Their use is also subject to their own terms. Cove
        is not affiliated with or endorsed by WHOOP, Inc. or Apple Inc. You can disconnect at any time.
      </p>

      <h2>5. Acceptable use</h2>
      <ul>
        <li>No unlawful, abusive or harmful content in chats, community groups or uploads.</li>
        <li>No attempts to access other users' data, disrupt the service or reverse engineer it.</li>
        <li>No automated scraping or misuse of the AI features.</li>
      </ul>

      <h2>6. Your content</h2>
      <p>
        You own the data you add to Cove. You give us permission to store and process it only to provide the
        service, as described in our <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
      </p>

      <h2>7. Termination</h2>
      <p>
        You can delete your account at any time from Settings. We may suspend accounts that violate these terms.
      </p>

      <h2>8. Disclaimers and liability</h2>
      <p>
        Cove is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not
        liable for indirect or consequential damages, or for decisions made based on information in the app.
      </p>

      <h2>9. Changes</h2>
      <p>We may update these terms; continued use after changes means you accept them.</p>

      <h2>10. Contact</h2>
      <p>Email <a className="text-primary underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>
    </LegalLayout>
  );
}
