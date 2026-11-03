import type { ReactNode } from "react";
import type { ReplacementOption } from "@/lib/recommendation";

export type IconName =
  | "spark"
  | "sparkle"
  | "shield"
  | "edit"
  | "arrowRight"
  | "arrowUpRight"
  | "chevronUp"
  | "chevronDown"
  | "chevronDownSmall"
  | "close"
  | "check"
  | "plus"
  | "download"
  | "home"
  | "history"
  | "settings"
  | "account"
  | "ratingMuchLighter"
  | "ratingLighter"
  | "ratingSame"
  | "ratingStronger";

const iconShapes: Record<IconName, ReactNode> = {
  spark: <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />,
  sparkle: <path d="M12 3.5l2.1 6.1 6.1 2.1-6.1 2.1L12 20l-2.1-6.2L3.8 11.7l6.1-2.1z" />,
  shield: (
    <>
      <path d="M12 3.2 5.5 6v5c0 4.3 2.8 7.2 6.5 8.6 3.7-1.4 6.5-4.3 6.5-8.6V6z" />
      <path d="M9.3 11.6 11.2 13.5 15 9.6" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M13.5 6.5l3 3" />
    </>
  ),
  arrowRight: <path d="M5 12h13M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronDownSmall: <path d="M7 10l5 5 5-5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </>
  ),
  history: (
    <>
      <path d="M3.2 12a8.8 8.8 0 1 0 2.6-6.3" />
      <path d="M5 3v3.5h3.5" />
      <path d="M12 8v4.3l3 1.7" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h8.5M16.5 7H20M4 17h3.5M11.5 17H20" />
      <circle cx="14.5" cy="7" r="2.3" />
      <circle cx="9.5" cy="17" r="2.3" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8.5" r="3.4" />
      <path d="M5.6 20a6.4 6.4 0 0 1 12.8 0" />
    </>
  ),
  ratingMuchLighter: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </>
  ),
  ratingLighter: (
    <>
      <path d="M3.5 18h17" />
      <path d="M8 18a4 4 0 0 1 8 0" />
      <path d="M12 4v3M6 9l1.5 1.5M18 9l-1.5 1.5" />
    </>
  ),
  ratingSame: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12h7" />
    </>
  ),
  ratingStronger: (
    <>
      <path d="M4 16.5l5-5 3.5 3.5L20 7" />
      <path d="M15.5 7H20v4.5" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconShapes[name]}
    </svg>
  );
}

export function Logo() {
  return (
    <div className="logo-mark" aria-hidden="true">
      <Icon name="spark" size={16} strokeWidth={1.9} />
    </div>
  );
}

export function ReplacementIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    walk: "M12 3v5m0 0 3-2m-3 2-3-2M7 21l2.5-6L7 11l-3 3m10 7 1.5-5L13 12l-2-2",
    breathe: "M4 12c2.5-4 5.5-4 8 0s5.5 4 8 0M4 7c2.5-2 5.5-2 8 0s5.5 2 8 0",
    stretch: "M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-5 5 5-2 5 2m-5-2v6m0 0-4 7m4-7 4 7",
    water: "M12 3s6 6.2 6 11a6 6 0 1 1-12 0c0-4.8 6-11 6-11Z",
    friend: "M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v4a3.5 3.5 0 0 1-3.5 3.5H12l-4.5 4v-4.7A3.5 3.5 0 0 1 5 10.5v-4Z",
    custom: "M12 3v18M3 12h18",
  };
  return <svg className="replacement-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.custom} /></svg>;
}

export function Progress({ step, total = 3, label = "Progress" }: { step: number; total?: number; label?: string }) {
  return <div className="progress" role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-valuetext={`Step ${step} of ${total}`}><span>{step}</span><div className="progress-track"><i style={{ width: `${(step / total) * 100}%` }} /></div><span>{total}</span></div>;
}

export function ReplacementChoice({ item, selected, onToggle }: { item: ReplacementOption & { icon: string }; selected: boolean; onToggle: () => void }) {
  return <button type="button" aria-pressed={selected} className={`choice ${selected ? "selected" : ""}`} onClick={onToggle}><span className="choice-icon"><ReplacementIcon name={item.icon} /></span><span>{item.name}</span><span className="check">{selected ? <Icon name="check" size={15} /> : null}</span></button>;
}
