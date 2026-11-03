import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page and route renders per request and nothing uses ISR, revalidateTag
// or "use cache", so the default no-op incremental cache is right.
export default defineCloudflareConfig();
