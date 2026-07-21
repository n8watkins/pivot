import { auth, isAuthConfigured } from "@/auth";
import { getSnapshot } from "@/lib/domain";

export const dynamic = "force-dynamic";

export async function GET() {
  const [snapshot, accountSession] = await Promise.all([
    getSnapshot(),
    isAuthConfigured ? auth().catch(() => null) : Promise.resolve(null),
  ]);
  const exportData = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    account: accountSession?.user?.githubId ? { type: "github", login: accountSession.user.githubLogin } : { type: "anonymous" },
    pivots: snapshot.pivots,
    contextTags: snapshot.contextTags,
    history: snapshot.history,
    activeIntervention: snapshot.active ?? null,
  };
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="pivot-export-${date}.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
