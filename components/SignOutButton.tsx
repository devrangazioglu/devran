"use client";

import { signOut } from "next-auth/react";

import { useI18n } from "./I18nProvider";

export default function SignOutButton() {
  const { t } = useI18n();
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
      {t("nav.logout")}
    </button>
  );
}
