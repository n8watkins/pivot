import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/pivot/legal-page";
import { EmergencyAndInternational, ResourceList } from "@/components/pivot/crisis-resources";
import { allResources } from "@/lib/crisis-resources";

export const metadata: Metadata = {
  title: "Crisis lines - Pivot",
  description: "Free, confidential US crisis lines: 988, Crisis Text Line, domestic violence, sexual assault, Poison Control, and substance use.",
};

// Static and server-rendered, so it works without JavaScript and without the database.
export const dynamic = "force-static";

export default function HelpPage() {
  return (
    <LegalPage eyebrow="Crisis lines" title="Talk to someone now." lede="Pivot is a habit tool, not crisis care. These free, confidential lines have real people on them, any time.">
      <LegalSection title="If you are thinking about suicide or are in distress">
        <ResourceList resources={allResources.slice(0, 2)} />
      </LegalSection>
      <LegalSection title="For a specific situation">
        <ResourceList resources={allResources.slice(2)} />
      </LegalSection>
      <EmergencyAndInternational />
    </LegalPage>
  );
}
