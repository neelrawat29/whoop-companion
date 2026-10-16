import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LEGAL_CONTACT_EMAIL } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Cove" },
      { name: "description", content: "How Cove collects, uses and protects your health, nutrition and wearable data." },
      { property: "og:title", content: "Privacy Policy — Cove" },
      { property: "og:description", content: "How Cove collects, uses and protects your health and wearable data." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        Cove ("we", "us") is a personal health companion that helps you track recovery, sleep, nutrition,
        hydration, supplements and weight. This policy explains what data we collect, how we use it, and the
        choices you have.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email address and sign-in provider (email, Google or Apple).</li>
        <li><strong>Profile data:</strong> sex, height, birth date, activity level and goals you choose to enter.</li>
        <li><strong>Health and wellness data you log:</strong> recovery, HRV, resting heart rate, sleep, strain, water, weight, habits, meals and supplements.</li>
        <li><strong>Apple Health (iOS):</strong> with your permission, we read sleep, HRV, resting heart rate, weight and water to pre-fill your logs. We never write to Apple Health and never use this data for advertising.</li>
        <li><strong>WHOOP (optional):</strong> if you connect your WHOOP account, we receive recovery, sleep, strain, workout and basic profile data through the official WHOOP API, only with your authorization.</li>
        <li><strong>Meal photos and AI chats:</strong> photos you upload for meal estimation and messages you send to the AI coach.</li>
        <li><strong>Technical data:</strong> basic logs needed to keep the service secure and working.</li>
      </ul>

      <h2>2. How we use your data</h2>
      <ul>
        <li>To show your dashboards, trends, insights, biological age estimate and daily targets.</li>
        <li>To generate AI meal estimates and coach responses. Relevant data is sent to our AI processing provider solely to produce the response and is not used to train public models.</li>
        <li>To show limited stats to members of community groups you choose to join.</li>
        <li>To send reminders you enable, such as the end-of-day recap.</li>
      </ul>
      <p>We do <strong>not</strong> sell your data, share it with advertisers, or use it for marketing profiling.</p>

      <h2>3. Sharing</h2>
      <p>
        We share data only with service providers that host and run Cove (cloud hosting, database, file storage
        and AI processing), under confidentiality obligations, or when required by law. WHOOP and Apple Health data
        is never shared with third parties beyond what is needed to provide the features you use.
      </p>

      <h2>4. Storage and security</h2>
      <p>
        Data is encrypted in transit and at rest. Access is restricted per account, so other users cannot read
        your records. Meal photos are stored in private storage.
      </p>

      <h2>5. Retention and deletion</h2>
      <p>
        We keep your data while your account is active. In Settings you can erase all your logged data or delete
        your account entirely; deletion removes your data from our systems. Disconnecting WHOOP stops further
        syncing, and you can also revoke access from your WHOOP account.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You can access, export, correct or delete your data at any time. Depending on where you live (for example
        under GDPR or CCPA), you may have additional rights; contact us to exercise them.
      </p>

      <h2>7. Children</h2>
      <p>Cove is not intended for anyone under 16, and we do not knowingly collect their data.</p>

      <h2>8. Medical disclaimer</h2>
      <p>Cove provides general wellness information and is not a medical device or a substitute for professional advice.</p>

      <h2>9. Changes</h2>
      <p>We may update this policy and will note the new date above. Significant changes will be shown in the app.</p>

      <h2>10. Contact</h2>

      <p>Questions? Email <a className="text-primary underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p>
    </LegalLayout>
  );
}
