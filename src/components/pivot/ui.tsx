import type { ReplacementOption } from "@/lib/recommendation";

export function Logo() { return <div className="logo-mark" aria-hidden="true">✳</div>; }

export function Header({ onHistory, onReset }: { onHistory: () => void; onReset: () => void }) {
  return <header className="site-header"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); onReset(); }}><Logo /><span>pivot</span></a><button className="text-button" onClick={onHistory}>History <span aria-hidden="true">↗</span></button></header>;
}

export function Progress({ step, total = 3 }: { step: number; total?: number }) {
  return <div className="progress" aria-label={`Step ${step} of ${total}`}><span>{step}</span><div className="progress-track"><i style={{ width: `${(step / total) * 100}%` }} /></div><span>{total}</span></div>;
}

export function ReplacementChoice({ item, selected, onToggle }: { item: ReplacementOption & { icon: string }; selected: boolean; onToggle: () => void }) {
  return <button className={`choice ${selected ? "selected" : ""}`} onClick={onToggle}><span className="choice-icon">{item.icon}</span><span>{item.name}</span><span className="check">{selected ? "✓" : ""}</span></button>;
}
