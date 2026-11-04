import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SafetyFooter } from "@/components/pivot/legal-page";
import { Icon, Logo } from "@/components/pivot/ui";
import { WelcomeInstall } from "./welcome-install";
import "./welcome.css";

// The front door for people who have not used Pivot yet. It is static and prerendered, so it
// loads fast, works without JavaScript, and never touches the database. `/` stays the app itself,
// so someone who already uses Pivot reaches the urge button and the crisis lines in one tap.

const description = "When the pull to scroll, snack, or check your email hits, Pivot gives you one small next step you already picked. Free, no account, no streaks.";

export const metadata: Metadata = {
  title: "Pivot - A pause button for everyday urges",
  description,
  alternates: { canonical: "/welcome" },
  openGraph: { title: "Pivot - A pause button for everyday urges", description, url: "/welcome", siteName: "Pivot", type: "website", images: [{ url: "/icons/pivot-512.png", width: 512, height: 512, alt: "The Pivot logo" }] },
};

export const dynamic = "force-static";

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
    <div className="welcome-page">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="welcome-top">
        <Link className="brand" href="/welcome"><Logo /><span>pivot</span></Link>
        <nav className="welcome-nav" aria-label="Pivot">
          <Link href="/help">Crisis lines</Link>
          <Link className="welcome-top-link" href="/">Open the app <Icon name="arrowRight" size={15} /></Link>
        </nav>
      </header>

      <main className="welcome" id="main-content">
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <div className="welcome-hero-copy">
            <p className="eyebrow">Free · works in your browser</p>
            <h1 id="welcome-title">A pause button for the urge.</h1>
            <p className="welcome-lede">When the pull to scroll, snack, or check your email hits, Pivot gives you one small next step you already picked. Then it asks if it helped.</p>
            <div className="welcome-ctas">
              <Link className="primary-button" href="/onboarding">Start your first pivot <Icon name="arrowRight" size={18} /></Link>
              <a className="quiet-button" href="#how">See how it works</a>
            </div>
            <p className="welcome-fine">No account. No streaks. Takes about a minute to set up.</p>
            <p className="welcome-crisis">Having a hard time right now? Pivot is not crisis care. Call or text <a href="tel:988">988</a>, or see <Link href="/help">all crisis lines</Link>.</p>
          </div>
          <div className="welcome-phones">
            <figure className="welcome-phone back">
              <Image src="/welcome/phone-step.png" alt="Pivot suggesting Slow breathing for two minutes, because you said you were tired" width={780} height={1688} priority sizes="(max-width: 860px) 190px, 250px" />
            </figure>
            <figure className="welcome-phone front">
              <Image src="/welcome/phone-home.png" alt="Pivot's pause space with the I'm having an urge button" width={780} height={1688} priority sizes="(max-width: 860px) 190px, 250px" />
            </figure>
          </div>
        </section>

        <section className="welcome-section" id="how" aria-labelledby="how-title">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title">Three steps, and one of them takes a minute.</h2>
          <ol className="welcome-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="welcome-step-number" aria-hidden="true">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="welcome-section" aria-labelledby="promises-title">
          <p className="eyebrow">What it won&apos;t do</p>
          <h2 id="promises-title">Built to be quiet.</h2>
          <ul className="welcome-promises">
            {promises.map((item) => (
              <li key={item.title}>
                <Icon name="check" size={18} />
                <div><h3>{item.title}</h3><p>{item.body}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="welcome-section welcome-install-section" aria-labelledby="install-title">
          <div className="welcome-install-copy">
            <p className="eyebrow">On your phone</p>
            <h2 id="install-title">On your home screen, like an app.</h2>
            <p>There is nothing to download from a store. Add Pivot to your home screen and it opens full screen, one tap from the urge button. Weekly or monthly check-ins arrive like any app&apos;s notifications, and only if you turn them on.</p>
          </div>
          <WelcomeInstall />
        </section>

        <section className="welcome-section welcome-honest" aria-labelledby="honest-title">
          <h2 id="honest-title">What Pivot is not</h2>
          <p>Pivot is for everyday habits. It is not therapy, treatment, or crisis care, and it will not fix anything on its own.</p>
          <p>If you are thinking about suicide or hurting yourself, please talk to a person now. In the US, call or text <a href="tel:988">988</a>, or <a href="https://988lifeline.org/chat/" target="_blank" rel="noopener noreferrer">chat online</a>. If you or someone else is in immediate danger, call <a href="tel:911">911</a>. Outside the US, find a local helpline at <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>. <Link href="/help">All crisis lines</Link> covers domestic violence, sexual assault, poisoning and substance use too.</p>
        </section>

        <section className="welcome-section welcome-close" aria-labelledby="close-title">
          <h2 id="close-title">Try it on the next urge.</h2>
          <Link className="primary-button" href="/onboarding">Start your first pivot <Icon name="arrowRight" size={18} /></Link>
          <p className="welcome-fine">Built by Nathan Watkins. The code is open on <a href="https://github.com/n8watkins/pivot" target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
        </section>
      </main>

      <SafetyFooter />
    </div>
  );
}
