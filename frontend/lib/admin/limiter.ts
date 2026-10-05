import "server-only";
import { istemciIp } from "./client-ip";

/**
 * Giriş ve parola formları için süreç belleğinde deneme sınırı.
 *
 * Neden backend'deki sınır yetmiyor: site yönetimi bir BFF; backend bütün
 * personeli frontend sunucusunun TEK IP'sinden görüyor. Backend'in IP başına
 * tavanı (15 dakikada 100 başarısız giriş) bu yüzden herkesin ortak kovası;
 * tek bir saldırgan onu doldurup herkesi kilitleyemesin diye her istemciyi
 * burada kendi IP'siyle ayrıca sayıyoruz. Hesap başına sınır backend'de.
 *
 * Tek konteynerde yeterli (check-up uygulamasının app/lib/rate-limit.ts'iyle
 * aynı desen); yatay ölçeklenince her kopya kendi sayacını tutar.
 */

interface Kayit {
  sayi: number;
  bitis: number;
}

const kayitlar = new Map<string, Kayit>();
let sonBudama = Date.now();

function buda(simdi: number) {
  if (simdi - sonBudama < 60_000) return;
  sonBudama = simdi;
  for (const [k, v] of kayitlar) if (v.bitis < simdi) kayitlar.delete(k);
}

/** Tarayıcının IP'si (vekilin yazdığı; bkz. client-ip.ts) ya da "yerel". */
async function istemci(): Promise<string> {
  return (await istemciIp()) ?? "yerel";
}

/**
 * Denemeyi sayar; true → sınır aşıldı, isteği backend'e göndermeden reddet.
 * @param eylem    "giris", "giris:ad@kocum.net" gibi (IP otomatik eklenir)
 */
export async function denemeSiniriAsildi(eylem: string, limit: number, pencereMs: number): Promise<boolean> {
  const simdi = Date.now();
  buda(simdi);
  const k = `${await istemci()}|${eylem}`;
  const kayit = kayitlar.get(k);
  if (!kayit || kayit.bitis < simdi) {
    kayitlar.set(k, { sayi: 1, bitis: simdi + pencereMs });
    return false;
  }
  kayit.sayi += 1;
  return kayit.sayi > limit;
}

/** Saymadan bakar: sınır dolu mu? (Yalnızca başarısızların sayıldığı akışlar için.) */
export async function denemeSiniriDolu(eylem: string, limit: number): Promise<boolean> {
  const kayit = kayitlar.get(`${await istemci()}|${eylem}`);
  return Boolean(kayit && kayit.bitis >= Date.now() && kayit.sayi >= limit);
}

/** Başarısız denemeyi sayar. */
export async function basarisizDenemeSay(eylem: string, pencereMs: number) {
  const simdi = Date.now();
  buda(simdi);
  const k = `${await istemci()}|${eylem}`;
  const kayit = kayitlar.get(k);
  if (!kayit || kayit.bitis < simdi) kayitlar.set(k, { sayi: 1, bitis: simdi + pencereMs });
  else kayit.sayi += 1;
}

/** Başarılı girişte sayaç sıfırlanır: doğru parolayı bilen kilitli kalmasın. */
export async function denemeSayaciniSifirla(eylem: string) {
  kayitlar.delete(`${await istemci()}|${eylem}`);
}
