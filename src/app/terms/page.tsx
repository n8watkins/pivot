import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/pivot/legal-page";

export const metadata: Metadata = {
  title: "Terms - Pivot",
  description: "The short terms for using Pivot.",
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms" title="The short version." lede="Pivot is a small, free tool for everyday habits. By using it, you agree to these terms.">
      <LegalSection title="What Pivot is">
        <p>Pivot helps you choose a different next step when an urge appears, using actions you approve. Suggestions are ideas, not instructions, and you decide what is right for you.</p>
      </LegalSection>
      <LegalSection title="What Pivot is not">
        <p>Pivot is not medical or mental-health treatment, therapy, diagnosis, or crisis care, and it is not an emergency service. It does not replace a qualified professional, and it does not monitor what you enter or contact anyone on your behalf. If you are in crisis in the US, call or text 988. Elsewhere, see <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>, or call your local emergency number.</p>
      </LegalSection>
      <LegalSection title="Using Pivot">
        <ul>
          <li>You must be 18 or older to use Pivot.</li>
          <li>Use Pivot for yourself, lawfully, and without trying to disrupt or misuse the service.</li>
          <li>Notes you write may be sent to Google&apos;s Gemini API for a suggestion, as described in the <Link href="/privacy">privacy policy</Link>.</li>
          <li>Your pivots and History belong to you. You can export or delete them at any time in <Link href="/settings">Settings</Link>.</li>
        </ul>
      </LegalSection>
      <LegalSection title="No guarantees">
        <p>Pivot is provided as is, without warranties. It may change, pause, or stop, and to the extent the law allows, Pivot and its maker are not liable for how you use it or for any loss from using it.</p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>If these terms change, the date above will change too. Questions are welcome on <a href="https://github.com/n8watkins/pivot/issues" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
      </LegalSection>
    </LegalPage>
  );
}
