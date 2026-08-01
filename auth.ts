import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
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

/**
 * Sağlayıcılar yalnızca anahtarları tanımlıysa eklenir.
 *
 * Anahtarsız bir sağlayıcı eklemek, giriş sayfasında çalışmayan bir düğme
 * göstermek demek: kullanıcı tıklar, sağlayıcı hata sayfası döner.
 */
export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
);

/**
 * Apple ile giriş.
 *
 * `APPLE_CLIENT_SECRET`, Apple Developer hesabından üretilen ve altı ayda bir
 * yenilenmesi gereken imzalı bir JWT'dir (client id + team id + key id ile
 * üretilir); bu yüzden diğer sağlayıcılardaki gibi sabit bir "secret" değildir.
 */
export const appleAuthEnabled = Boolean(
  process.env.APPLE_CLIENT_ID?.trim() && process.env.APPLE_CLIENT_SECRET?.trim(),
);

if (googleAuthEnabled) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (appleAuthEnabled) {
  providers.push(
    Apple({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/giris" },
  // Üretimde sabit bir yedek gizli anahtar kullanmak oturum çerezlerini
  // taklit edilebilir hale getirir; bu yüzden yedek yalnızca geliştirmede
  // devreye girer. Üretimde AUTH_SECRET tanımlanmalıdır.
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : "kripto-sinyal-dev-secret"),
  trustHost: true,
  callbacks: {
    async signIn({ account, user }) {
      // OAuth ile gelen kullanıcıyı yerel depoya da yaz (takip listesi,
      // ayarlar ve kredi defteri bu kayda bağlı).
      if ((account?.provider === "google" || account?.provider === "apple") && user.email) {
        try {
          await upsertOAuthUser(user.email, user.name);
        } catch (error) {
          // Depo yazılamıyorsa (salt okunur disk) girişi engellemeyelim; kullanıcı
          // varsayılan ayarlarla devam eder, ayarları kaydetmeyi denediğinde
          // ilgili uç nokta açıklayıcı bir hata döndürür.
          console.error("Kullanıcı deposuna yazılamadı:", error);
        }
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
