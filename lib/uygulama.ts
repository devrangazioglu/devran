/**
 * Mobil uygulama kabuğundan gelen istekleri tanır.
 *
 * Kabuk, kullanıcı aracına "Fibonex360App" ekler (bkz. mobil/capacitor.config.ts).
 * App Store 3.1.1 gereği uygulamanın içinde ücretli planlar, fiyatlar ve
 * "yükselt" yönlendirmeleri gösterilmez; uygulama içi satın alma bağlanana
 * kadar uygulama yalnızca kredi bakiyesini gösterir. Sunucu bu ayrımı
 * yaparken bu yardımcıyı, CSS ise `<html class="uygulama">` sınıfını kullanır
 * (`.yalniz-web` / `.yalniz-uygulama`).
 */

export const UYGULAMA_IZI = "Fibonex360App";

export function uygulamaUa(ua: string | null | undefined): boolean {
  return Boolean(ua?.includes(UYGULAMA_IZI));
}

/** API isteği uygulamanın içinden mi geliyor. */
export function uygulamaIstegi(request: Request): boolean {
  return uygulamaUa(request.headers.get("user-agent"));
}

/** Kredi/plan sınırı mesajının sonuna eklenen yönlendirme (uygulamada yok). */
export function yukseltmeNotu(request: Request): string {
  return uygulamaIstegi(request) ? "" : " Planlar sayfasından yükseltebilirsiniz.";
}
