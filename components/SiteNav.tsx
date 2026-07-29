import Link from "next/link";

import { auth } from "@/auth";

/** Tanıtım sayfasının üst menüsü. */
export default async function SiteNav() {
  const session = await auth();

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">₿</span>
          <span>
            Kripto<em>sinyal</em>
          </span>
        </Link>

        <nav className="nav-links">
          <a href="#ozellikler">Özellikler</a>
          <a href="#nasil">Nasıl çalışır</a>
          <a href="#gostergeler">Göstergeler</a>
          <a href="#sss">SSS</a>
        </nav>

        <div className="nav-actions">
          {session?.user ? (
            <Link href="/panel" className="btn btn-primary">
              Panele git
            </Link>
          ) : (
            <>
              <Link href="/giris" className="btn btn-ghost btn-sm">
                Giriş yap
              </Link>
              <Link href="/kayit" className="btn btn-primary">
                Ücretsiz başla
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
