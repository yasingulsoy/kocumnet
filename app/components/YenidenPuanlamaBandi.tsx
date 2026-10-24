import { Alert } from "@/components/tailadmin/ui/Alert";
import { yenidenPuanlamaBilgisi } from "@/lib/checkup";

/*
 * Sonuç ekranındaki bant: "1 sorunun cevap anahtarı 22 Ekim'de düzeltildi;
 * sonucun 12 → 13 doğru olarak yeniden hesaplandı."
 *
 * Neden gerekli: anahtar düzeltilince bakım işi sonucu yeniden puanlıyor
 * (lib/checkup.ts yenidenPuanla). Öğrenci dün 12 doğru gördüğü testte bugün
 * 13 görürse ve hiçbir yerde nedeni yazmazsa sayılara güveni sarsılır.
 *
 * Kendi verisini okuyan sunucu bileşeni: sayfaya tek satırla eklensin.
 * Yeniden puanlanmamış sonuçta hiçbir şey çizmez. Cevap anahtarı içermez.
 */

/** Ay adının bulunma eki ("Ekim'de", "Kasım'da", "Ağustos'ta"); ünlü uyumu elle. */
const AY_EKLI = [
  "Ocak'ta",
  "Şubat'ta",
  "Mart'ta",
  "Nisan'da",
  "Mayıs'ta",
  "Haziran'da",
  "Temmuz'da",
  "Ağustos'ta",
  "Eylül'de",
  "Ekim'de",
  "Kasım'da",
  "Aralık'ta",
];

function gunVeAy(an: Date): string {
  const parca = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "numeric",
  }).formatToParts(an);
  const gun = parca.find((p) => p.type === "day")?.value ?? "";
  const ay = Number(parca.find((p) => p.type === "month")?.value ?? "1");
  return `${gun} ${AY_EKLI[ay - 1] ?? ""}`.trim();
}

export async function YenidenPuanlamaBandi({ sessionId, userId }: { sessionId: string; userId: string }) {
  // Bant çizilemezse sonuç ekranı düşmesin: bilgi notu, sonucun kendisi değil.
  const b = await yenidenPuanlamaBilgisi(sessionId, userId).catch(() => null);
  if (!b) return null;

  const sonuc =
    b.onceki.dogru !== b.simdi.dogru
      ? `sonucun ${b.onceki.dogru} → ${b.simdi.dogru} doğru olarak yeniden hesaplandı.`
      : `sonucun yeniden hesaplandı (${b.simdi.dogru} doğru).`;

  return (
    <Alert variant="info" compact>
      {b.soruSayisi} sorunun cevap anahtarı {gunVeAy(b.tarih)} düzeltildi; {sonuc}
    </Alert>
  );
}
