# Incident response runbook

1. Confirm the affected environment, time range, and user-visible symptom.
2. Disable Gemini recommendations first if the incident involves unsafe, invalid, or degraded model output.
3. Roll back the Vercel deployment if the current release caused a core-flow or security regression.
4. Revoke and rotate any exposed Turso, GitHub OAuth, Auth.js, Gemini, or Vercel credential.
5. Preserve relevant structured logs without copying free-text context or user exports into tickets.
6. Notify affected users and regulators according to the approved privacy and breach policy.
7. Document the timeline, impact, root cause, remediation, and prevention work after containment.
