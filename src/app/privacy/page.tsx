import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/pivot/legal-page";

export const metadata: Metadata = {
  title: "Privacy - Pivot",
  description: "What Pivot stores, what it never stores, and where your notes go.",
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Your data, plainly." lede="Pivot keeps only what it needs to help with your next moment. Here is exactly what that means.">
      <LegalSection title="What Pivot stores">
        <ul>
          <li>An anonymous session cookie, so Pivot can recognize your browser without an account. It lasts up to a year.</li>
          <li>The pivots you create, their actions, and the tags you add.</li>
          <li>Each moment you check in: the pivot, the action you chose, the tag and intensity you picked, the suggestion shown, and how it went.</li>
          <li>If you connect GitHub, your GitHub username, account ID, and avatar link, so your data can follow you to another device.</li>
        </ul>
      </LegalSection>
      <LegalSection title="What Pivot does not store">
        <p>The optional note you type during an urge is never saved by Pivot. It is not in History, not in your data export, and not in our database.</p>
      </LegalSection>
      <LegalSection title="Where your note goes">
        <p>When Gemini suggestions are on, your note, the tag you picked, and your list of actions are sent to Google&apos;s Gemini API to choose a suggestion. Google handles that request under the <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini API terms</a>, which set how long Google keeps it and how it may be used. If Gemini is off or unavailable, Pivot picks a suggestion on its own and nothing is sent.</p>
      </LegalSection>
      <LegalSection title="What Pivot never does">
        <p>No ads, no tracking scripts, and no selling or sharing your data. Pivot is hosted on Vercel and stores data with Turso, who process it only to run the app.</p>
      </LegalSection>
      <LegalSection title="Your control">
        <p>In <Link href="/settings">Settings</Link> you can download all of your data as JSON or delete it, along with your session or connected account. Deletion is immediate.</p>
      </LegalSection>
      <LegalSection title="Health and safety">
        <p>Pivot is not medical or mental-health treatment, and it is not crisis care. If you are in crisis in the US, call or text 988. Elsewhere, see <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>.</p>
      </LegalSection>
      <LegalSection title="Questions">
        <p>Open an issue on <a href="https://github.com/n8watkins/pivot/issues" target="_blank" rel="noopener noreferrer">GitHub</a>. Please do not include personal details there. If this policy changes, the date above will change too.</p>
      </LegalSection>
    </LegalPage>
  );
}
