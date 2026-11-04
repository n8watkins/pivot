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
          <li>If you turn on check-in reminders, how often you want them, your timezone, and the push address your browser gives Pivot to deliver them.</li>
        </ul>
      </LegalSection>
      <LegalSection title="What Pivot does not store">
        <p>The optional note you type during an urge is never saved by Pivot. It is not in History, not in your data export, and not in our database.</p>
      </LegalSection>
      <LegalSection title="Where your note goes">
        <p>AI suggestions use Google&apos;s Gemini API on its free tier. When you ask for a suggestion, your note, the tag you picked, and your list of actions are sent to Gemini to choose one. Under the free tier&apos;s <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini API terms</a>, Google may use submitted text to improve its products, which can include review by people. Please leave names and other identifying details out of your note. If Gemini is off or unavailable, Pivot picks a suggestion on its own and nothing is sent.</p>
        <p>Before anything is sent, Pivot checks the note on your device for crisis language. If it finds any, it shows crisis resources instead and does not send the note.</p>
      </LegalSection>
      <LegalSection title="Who else handles data">
        <p>No ads, no cross-site tracking, and no selling or sharing your data. Pivot counts page visits with Cloudflare Web Analytics, which sets no cookies and does not identify you. When something in Pivot breaks, an error report goes to Sentry: the error and the page it happened on, with emails, codes, and anything you typed left out. Pivot runs on Cloudflare Workers and stores data in a Turso database, and both process it only to run the app. Like most websites, Cloudflare keeps short-lived request logs (such as IP address, browser, and the page requested) for security and debugging. If you connect GitHub, GitHub handles that sign-in. If you turn on check-in reminders, they are delivered through your browser&apos;s push service (such as Google for Chrome or Mozilla for Firefox), which carries the reminder encrypted and cannot read it.</p>
      </LegalSection>
      <LegalSection title="How long data is kept">
        <ul>
          <li>Your pivots, actions, tags, and History stay until you delete them in Settings. Deletion is immediate and complete.</li>
          <li>The anonymous session cookie expires after a year.</li>
          <li>If you clear your cookies without deleting first, Pivot can no longer connect that data to you, and it stays stored until it is removed. Pivot does not yet delete inactive data automatically.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Your control">
        <p>In <Link href="/settings">Settings</Link> you can download all of your data as JSON or delete it, along with your session or connected account.</p>
      </LegalSection>
      <LegalSection title="Who Pivot is for">
        <p>Pivot is meant for adults 18 and over. It is not designed for children and does not knowingly collect data from them.</p>
      </LegalSection>
      <LegalSection title="Health and safety">
        <p>Pivot is not medical or mental-health treatment, therapy, or an emergency service, and it is not crisis care. If you are in crisis in the US, call or text 988. If you are in immediate danger, call your local emergency number. Elsewhere, see <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>.</p>
      </LegalSection>
      <LegalSection title="Questions">
        <p>Open an issue on <a href="https://github.com/n8watkins/pivot/issues" target="_blank" rel="noopener noreferrer">GitHub</a>, and please do not include personal details there. Security problems can be reported privately through <a href="https://github.com/n8watkins/pivot/security/advisories/new" target="_blank" rel="noopener noreferrer">GitHub security advisories</a>. If this policy changes, the date above will change too.</p>
      </LegalSection>
    </LegalPage>
  );
}
