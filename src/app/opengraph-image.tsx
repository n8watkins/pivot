import { OG_SIZE, dataUrl, shareCard } from "@/lib/og-card";
import { readPublicFile } from "@/lib/publicFile";

// The share card (Open Graph and Twitter): the n8builds family layout in
// Pivot's sage and coral, with the in-progress screen drawn on the right.

export const alt = "Pivot: a calm pause when an urge shows up, and one small next step to take instead.";
export const size = OG_SIZE;
export const contentType = "image/png";

const ink = "#26302b";
const muted = "#667168";
const sage = "#4d6d5a";

export default async function Image() {
  // Geist (OFL, public/og/Geist-LICENSE.txt) and the marks, from public/.
  const [medium, bold, mark, n8] = await Promise.all([
    readPublicFile("/og/Geist-Medium.ttf"),
    readPublicFile("/og/Geist-Bold.ttf"),
    readPublicFile("/og/pivot-mark.svg"),
    readPublicFile("/og/n8-icon.png"),
  ]);

  return shareCard({
    colors: {
      bg: "#f5f7f2",
      bgImage: "radial-gradient(circle at 80% 45%, rgba(182,203,185,0.55), rgba(245,247,242,0) 60%)",
      ink,
      muted,
      body: "#53615a",
      accent: "#e88b70",
    },
    font: "Geist",
    fonts: [
      { name: "Geist", data: medium, weight: 500 },
      { name: "Geist", data: bold, weight: 700 },
      { name: "Geist", data: bold, weight: 800 },
    ],
    logo: dataUrl(mark, "image/svg+xml"),
    logoStyle: { width: 50, height: 60, borderRadius: 0 },
    n8Icon: dataUrl(n8, "image/png"),
    host: "pivot.n8builds.dev",
    name: "Pivot",
    tagline: "A calm pause when an urge shows up, and one small next step to take instead.",
    visual: <ActivePivot />,
  });
}

/** The in-progress screen: the timer ring, the step and the done button. */
function ActivePivot() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "absolute",
        left: 660,
        top: 70,
        width: 500,
        height: 600,
        padding: "40px 40px",
        borderRadius: 28,
        background: "#ffffff",
        border: "1.5px solid #e1e6de",
        boxShadow: "0 30px 70px rgba(38,48,43,0.14)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: 168,
          height: 168,
          borderRadius: 168,
          border: "10px solid #e4ebe2",
          borderTopColor: sage,
          borderRightColor: sage,
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: ink, letterSpacing: -1 }}>5:00</div>
        <div style={{ display: "flex", fontSize: 17, color: muted }}>remaining</div>
      </div>
      <div style={{ display: "flex", marginTop: 30, fontSize: 16, fontWeight: 700, letterSpacing: 2.4, color: sage }}>
        {"YOU'RE ON IT"}
      </div>
      <div style={{ display: "flex", marginTop: 10, fontSize: 40, fontWeight: 700, letterSpacing: -1, color: ink }}>
        Take a short walk
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginTop: 22,
          width: 420,
          padding: "16px 18px",
          borderRadius: 16,
          background: "#eef4ec",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 30,
            background: sage,
            color: "#fff",
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          1
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 14, fontWeight: 700, letterSpacing: 1.6, color: muted }}>FIRST STEP</div>
          <div style={{ display: "flex", fontSize: 21, color: ink }}>Put on your shoes and step outside</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 22,
          width: 420,
          height: 60,
          borderRadius: 14,
          background: sage,
          color: "#fff",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {"I'm done for now"}
      </div>
    </div>
  );
}
