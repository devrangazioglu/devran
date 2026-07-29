import Link from "next/link";

import { auth } from "@/auth";
import SignOutButton from "./SignOutButton";

const LINKS = [
  { href: "/panel", label: "Panel" },
  { href: "/tarayici", label: "Sinyal tarayıcı" },
  { href: "/takip", label: "Takip listem" },
  { href: "/ayarlar", label: "Ayarlar" },
];

/** Üye alanının üst menüsü. */
export default async function AppNav() {
  const session = await auth();

  return (
    <header className="nav">
      <div className="container container-wide nav-inner">
        <Link href="/panel" className="logo">
          <span className="logo-mark">₿</span>
          <span>
            Kripto<em>sinyal</em>
          </span>
        </Link>

        <nav className="nav-links">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          <span className="muted" style={{ fontSize: 13 }}>
            {session?.user?.email}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
