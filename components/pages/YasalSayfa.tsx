import Link from "next/link";

import { LogoWord } from "@/components/Logo";
import SiteNav from "@/components/SiteNav";
import YasalBaglantilar from "@/components/YasalBaglantilar";
import { intlTag } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import type { YasalBelge } from "@/lib/yasal";

/**
 * Gizlilik politikası ve kullanım koşulları için ortak sayfa iskeleti.
 *
 * Metin uzun olduğu için başta bir içindekiler listesi var; mağaza
 * incelemecisi de kullanıcı da aradığı bölüme doğrudan atlayabilsin.
 */
export default async function YasalSayfa({ belge }: { belge: YasalBelge }) {
  const { t, locale } = await getI18n();
  const tarih = new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "long" }).format(
    new Date(belge.guncelleme),
  );

  return (
    <>
      <SiteNav locale={locale} />
      <main className="app-main">
        <article className="container yasal">
          <h1>{belge.baslik}</h1>
          <p className="muted yasal-tarih">{t("legal.updated", { date: tarih })}</p>
          <p className="yasal-ozet">{belge.ozet}</p>

          <nav className="yasal-icindekiler" aria-label={t("legal.contents")}>
            <ol>
              {belge.bolumler.map((bolum, i) => (
                <li key={bolum.baslik}>
                  <a href={`#b${i + 1}`}>{bolum.baslik.replace(/^\d+\.\s*/, "")}</a>
                </li>
              ))}
            </ol>
          </nav>

          {belge.bolumler.map((bolum, i) => (
            <section key={bolum.baslik} id={`b${i + 1}`}>
              <h2>{bolum.baslik}</h2>
              {bolum.paragraflar.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </section>
          ))}
        </article>
      </main>
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <Link href="/" className="logo">
              <LogoWord />
            </Link>
            <YasalBaglantilar t={t} />
          </div>
          <p className="disclaimer">
            <strong>{t("footer.legalTitle")}</strong> {t("footer.legal")}
          </p>
        </div>
      </footer>
    </>
  );
}
