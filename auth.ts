import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";

import { authenticate, upsertOAuthUser } from "@/lib/users";

const providers: Provider[] = [
  Credentials({
    id: "credentials",
    name: "E-posta ve parola",
    credentials: {
      email: { label: "E-posta", type: "email" },
      password: { label: "Parola", type: "password" },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email : "";
      const password = typeof credentials?.password === "string" ? credentials.password : "";
      if (!email || !password) return null;

      const user = await authenticate(email, password);
      if (!user) return null;
      return { id: user.id, name: user.name, email: user.email };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/giris" },
  secret: process.env.AUTH_SECRET ?? "kripto-sinyal-dev-secret-change-me",
  trustHost: true,
  callbacks: {
    async signIn({ account, user }) {
      // Google ile gelen kullanıcıyı yerel depoya da yaz (takip listesi için).
      if (account?.provider === "google" && user.email) {
        await upsertOAuthUser(user.email, user.name);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.uid === "string") {
        session.user.id = token.uid;
      }
      return session;
    },
  },
});
