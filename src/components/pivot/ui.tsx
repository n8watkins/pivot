import Link from "next/link";
import type { ReplacementOption } from "@/lib/recommendation";

export function Logo() { return <div className="logo-mark" aria-hidden="true">✳</div>; }

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

export function Header({ onHistory, onReset }: { onHistory: () => void; onReset: () => void }) {
  return <header className="site-header"><button type="button" className="brand brand-button" onClick={onReset}><Logo /><span>pivot</span></button><nav className="header-nav" aria-label="Main navigation"><button type="button" className="text-button" onClick={onHistory}>History <span aria-hidden="true">↗</span></button><Link className="text-button" href="/settings">Settings <span aria-hidden="true">↗</span></Link></nav></header>;
}

export function Progress({ step, total = 3 }: { step: number; total?: number }) {
  return <div className="progress" aria-label={`Step ${step} of ${total}`}><span>{step}</span><div className="progress-track"><i style={{ width: `${(step / total) * 100}%` }} /></div><span>{total}</span></div>;
}

export function ReplacementChoice({ item, selected, onToggle }: { item: ReplacementOption & { icon: string }; selected: boolean; onToggle: () => void }) {
  return <button className={`choice ${selected ? "selected" : ""}`} onClick={onToggle}><span className="choice-icon"><ReplacementIcon name={item.icon} /></span><span>{item.name}</span><span className="check">{selected ? "✓" : ""}</span></button>;
}
