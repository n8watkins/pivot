import { emergency, internationalHelplines, type CrisisResource } from "@/lib/crisis-resources";

/** One crisis line: who it is for, the number as plain text, and call/text links. Works without JavaScript. */
export function ResourceCard({ resource }: { resource: CrisisResource }) {
  return (
    <section className="resource-card" aria-labelledby={`resource-${resource.id}`}>
      <strong id={`resource-${resource.id}`}>{resource.name}</strong>
      <p>{resource.when}</p>
      <p className="resource-contact">{resource.contact}</p>
      <div className="resource-actions">
        {resource.actions.map((action) => (
          <a key={action.href} className="secondary-button" href={action.href} {...(action.kind === "chat" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{action.label}</a>
        ))}
      </div>
    </section>
  );
}

export function ResourceList({ resources }: { resources: CrisisResource[] }) {
  return <div className="resource-list">{resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>;
}

/** The two lines every support screen ends with: 911 for danger, and where to look outside the US. */
export function EmergencyAndInternational() {
  return (
    <div className="resource-notes">
      <p><strong className="crisis-emergency">If you or someone else is in immediate danger, call your local emergency number (<a href={emergency.href}>911</a> in the US).</strong></p>
      <p>These are US numbers. Outside the US, find a local helpline at <a href={internationalHelplines} target="_blank" rel="noopener noreferrer">findahelpline.com</a>.</p>
    </div>
  );
}
