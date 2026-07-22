import { Icon } from "@/components/pivot/ui";

type RecentMoment = { id?: string; choice: string; outcome: string; date: string };

function formatDate(value: string) {
  if (value === "Today") return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function PivotStatsRail({ count, recent }: { count: number; recent: RecentMoment[] }) {
  const dash = Math.max(6, Math.min(100, count === 0 ? 6 : 20 + count * 8));
  return (
    <div className="rail-stack">
      <div className="rail-card rail-stat">
        <svg className="rail-ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sage-track)" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--deep-sage)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${dash} 100`} transform="rotate(-90 18 18)" />
        </svg>
        <div>
          <strong>{count}</strong>
          <span>{count === 1 ? "moment redirected" : "moments redirected"} in this pivot</span>
        </div>
      </div>

      <div className="rail-card">
        <span className="rail-label">Recent in this pivot</span>
        {recent.length ? (
          <div className="rail-recent">
            {recent.map((moment, index) => (
              <div className="rail-recent-row" key={moment.id ?? `${moment.date}-${index}`}>
                <span className="rail-recent-icon" aria-hidden="true"><Icon name="sparkle" size={15} /></span>
                <div>
                  <strong>{moment.choice}</strong>
                  <span>{moment.outcome} &middot; {formatDate(moment.date)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rail-empty">Your recent moments in this pivot will show here.</p>
        )}
      </div>

      <div className="rail-note">
        <span className="rail-label">A small reminder</span>
        <p>There&rsquo;s no perfect way to begin. Just choose the next useful thing.</p>
      </div>
    </div>
  );
}
