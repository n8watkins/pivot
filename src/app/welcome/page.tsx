import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LegalLinks } from "@/components/pivot/legal-page";
import { Icon, Logo } from "@/components/pivot/ui";
import "./welcome.css";

// PREVIEW ONLY (landing page concept, not approved): static route for first-time visitors.

export const metadata: Metadata = {
  title: "Pivot - A pause button for everyday urges",
  description: "When the pull to scroll, snack, or check email hits, Pivot gives you one small next step you already chose. Free, no account, no streaks.",
};

const steps = [
  { title: "Name the habit.", body: "Late night scrolling, the 3 PM snack run, email in bed. Pick a few things you would rather do instead. They are yours, not ours." },
  { title: "Tap when the urge hits.", body: "Add a word about the moment if you want. Pivot picks one of your actions and gives you a first step that takes a few minutes." },
  { title: "Say how it went.", body: "Pivot learns which actions help you, and when. Next time it starts with what worked. That is the whole loop." },
];

const promises = [
  { title: "No streaks, no scores", body: "Missing a day is not a failure state. There is nothing to break." },
  { title: "No account needed", body: "Start in your browser. Connect GitHub later only if you want your data on another device." },
  { title: "Nothing to sell", body: "No ads, no tracking scripts. The note you type is never saved (it goes to Google Gemini once if AI picks your step). Export or delete the rest in one tap." },
];

export default function WelcomePage() {
  return (
    <main className="welcome" id="main-content">
      <header className="welcome-top">
        <Link className="brand" href="/welcome"><Logo /><span>pivot</span></Link>
        <Link className="welcome-top-link" href="/">Open the app <Icon name="arrowRight" size={15} /></Link>
      </header>

      <section className="welcome-hero">
        <div className="welcome-hero-copy">
          <p className="eyebrow">Free · works in your browser</p>
          <h1>A pause button for the urge.</h1>
          <p className="welcome-lede">When the pull to scroll, snack, or check your email hits, Pivot gives you one small next step you already picked. Then it asks if it helped.</p>
          <div className="welcome-ctas">
            <Link className="primary-button" href="/onboarding">Start your first pivot <Icon name="arrowRight" size={18} /></Link>
            <a className="quiet-button" href="#how">See how it works</a>
          </div>
          <p className="welcome-fine">No account. No streaks. Takes about a minute to set up.</p>
        </div>
        <div className="welcome-phones" aria-hidden="true">
          <div className="welcome-phone back"><Image src="/welcome/phone-step.png" alt="" width={780} height={1688} priority /></div>
          <div className="welcome-phone front"><Image src="/welcome/phone-home.png" alt="" width={780} height={1688} priority /></div>
        </div>
      </section>

      <section className="welcome-section" id="how" aria-labelledby="how-title">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title">Three steps, and one of them takes a minute.</h2>
        <ol className="welcome-steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="welcome-step-number">{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="welcome-section" aria-labelledby="promises-title">
        <p className="eyebrow">What it won&apos;t do</p>
        <h2 id="promises-title">Built to be quiet.</h2>
        <div className="welcome-promises">
          {promises.map((item) => (
            <article key={item.title}>
              <Icon name="check" size={18} />
              <div><strong>{item.title}</strong><p>{item.body}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="welcome-section welcome-honest" aria-labelledby="honest-title">
        <h2 id="honest-title">What Pivot is not</h2>
        <p>Pivot is for everyday habits. It is not therapy, treatment, or crisis care, and it will not fix anything on its own.</p>
        <p>If you are thinking about suicide or hurting yourself, please talk to a person now. In the US, call or text <a href="tel:988">988</a>, or <a href="https://988lifeline.org/chat/" target="_blank" rel="noopener noreferrer">chat online</a>. Elsewhere, find a local helpline at <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>.</p>
      </section>

      <section className="welcome-section welcome-close">
        <h2>Try it on the next urge.</h2>
        <Link className="primary-button" href="/onboarding">Start your first pivot <Icon name="arrowRight" size={18} /></Link>
        <p className="welcome-fine">Built by Nathan Watkins. The code is open on <a href="https://github.com/n8watkins/pivot" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
      </section>

      <footer className="welcome-footer"><LegalLinks /></footer>
    </main>
  );
}
