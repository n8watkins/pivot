import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { authLogger } from "@/lib/log";

export const isAuthConfigured = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  trustHost: true,
  // Error type and a masked message only; see src/lib/log.ts.
  logger: authLogger,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account?.provider === "github") {
        token.githubId = account.providerAccountId;
        token.githubLogin = typeof profile?.login === "string" ? profile.login : token.name ?? undefined;
        token.picture = typeof profile?.avatar_url === "string" ? profile.avatar_url : token.picture;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.githubId = typeof token.githubId === "string" ? token.githubId : "";
        session.user.githubLogin = typeof token.githubLogin === "string" ? token.githubLogin : session.user.name ?? "GitHub user";
      }
      return session;
    },
  },
});
