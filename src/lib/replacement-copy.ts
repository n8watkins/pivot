type ActionDescriptor = { id: string; name: string };

export function fallbackFirstStep(option: ActionDescriptor) {
  const knownSteps: Record<string, string> = {
    walk: "Put on your shoes and step outside.",
    breathe: "Drop your shoulders. Breathe in for 4, out for 6.",
    stretch: "Let your arms hang, then slowly roll your shoulders back once.",
    water: "Stand up and reach for a glass.",
    friend: "Open a message to someone you trust and write one honest sentence.",
  };
  const action = option.name.trim().replace(/[.!?]+$/, "");
  return knownSteps[option.id] ?? `Start now: ${action}.`;
}
