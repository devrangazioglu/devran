/**
 * Dil katmanı testleri: sözlük bütünlüğü, yer tutucular ve yedek dil zinciri.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { analysisReady, isLocale, LOCALES, makeT, translate } from "../lib/i18n";
import { en } from "../lib/i18n/dictionaries/en";
import { tr, type DictionaryKey } from "../lib/i18n/dictionaries/tr";

const KEYS = Object.keys(tr) as DictionaryKey[];

test("desteklenen diller tanımlı ve tekil", () => {
  assert.ok(LOCALES.length >= 8, `beklenen ≥8 dil, gelen: ${LOCALES.length}`);
  const codes = LOCALES.map((l) => l.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.includes("tr") && codes.includes("en"));
  assert.equal(isLocale("tr"), true);
  assert.equal(isLocale("xx"), false);

  // Arapça sağdan sola yazılır.
  assert.equal(LOCALES.find((l) => l.code === "ar")?.dir, "rtl");
});

test("İngilizce sözlük Türkçe ile aynı anahtarlara sahip", () => {
  const missing = KEYS.filter((key) => !(key in en));
  assert.deepEqual(missing, [], `İngilizce sözlükte eksik anahtarlar: ${missing.join(", ")}`);

  const extra = Object.keys(en).filter((key) => !(key in tr));
  assert.deepEqual(extra, [], `İngilizce sözlükte fazla anahtarlar: ${extra.join(", ")}`);
});

test("çeviriler aynı yer tutucuları kullanır", () => {
  const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();

  for (const key of KEYS) {
    assert.deepEqual(
      placeholders(en[key]),
      placeholders(tr[key]),
      `yer tutucular uyuşmuyor: ${key}`,
    );
  }
});

test("eksik anahtar İngilizceye, oradan Türkçeye düşer", () => {
  // Almanca sözlükte analiz metinleri yok; İngilizce karşılığı gelmeli.
  const german = translate("de", "note.rsi.overbought", { rsi: "72" });
  assert.equal(german, translate("en", "note.rsi.overbought", { rsi: "72" }));
  assert.ok(!german.startsWith("note."));

  // Arayüz anahtarı Almanca'da tanımlı — Almanca gelmeli.
  assert.equal(translate("de", "nav.settings"), "Einstellungen");
});

test("yer tutucular verilen değerlerle dolduruluyor", () => {
  const text = translate("tr", "asset.target", { n: 2 });
  assert.equal(text, "Hedef 2");
  assert.ok(!text.includes("{"));

  const t = makeT("en");
  assert.equal(t("asset.target", { n: 3 }), "Target 3");

  // Değer verilmezse yer tutucu olduğu gibi kalır (sessizce yanlış metin üretmez).
  assert.equal(translate("tr", "asset.target"), "Hedef {n}");
});

test("analiz metinleri yalnızca hazır dillerde işaretli", () => {
  assert.equal(analysisReady("tr"), true);
  assert.equal(analysisReady("en"), true);
  assert.equal(analysisReady("de"), false);
  assert.equal(analysisReady("zh"), false);
});

test("her dilde temel gezinme anahtarları çevrilmiş", () => {
  const essentials: DictionaryKey[] = [
    "nav.panel",
    "nav.scanner",
    "nav.watchlist",
    "nav.settings",
    "market.kripto",
    "market.abd",
    "market.bist",
    "market.emtia",
    "signal.BUY",
    "signal.SELL",
    "signal.WAIT",
    "common.price",
    "common.search",
    "footer.legal",
  ];

  for (const locale of LOCALES) {
    for (const key of essentials) {
      const value = translate(locale.code, key);
      assert.ok(value.length > 0, `${locale.code}/${key} boş`);
      assert.notEqual(value, key, `${locale.code}/${key} çevrilmemiş`);
      if (locale.code !== "en") {
        // Türkçe dışındaki diller İngilizceden farklı olmalı (kopyala-yapıştır kontrolü).
        if (["nav.settings", "common.price", "market.bist"].includes(key) && locale.code !== "tr") {
          assert.notEqual(
            value,
            en[key],
            `${locale.code}/${key} İngilizce ile aynı kalmış`,
          );
        }
      }
    }
  }
});
