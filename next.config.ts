import type { NextConfig } from "next";

// React needs eval() in development for debugging callstacks; production never uses it.
const scriptSrc = process.env.NODE_ENV === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";

// Cloudflare Web Analytics: the zone injects its beacon script, which reports
// to cloudflareinsights.com. Sentry: browser errors go to the ingest host.
const analyticsScript = "https://static.cloudflareinsights.com";
const connectSrc = "'self' https://cloudflareinsights.com https://o4507767562371072.ingest.us.sentry.io";

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/sw.js", headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ] },
      { source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: `default-src 'self'; script-src ${scriptSrc} ${analyticsScript}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://avatars.githubusercontent.com; font-src 'self' data:; connect-src ${connectSrc}; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://github.com` },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ] },
    ];
  },
};

export default nextConfig;
