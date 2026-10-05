import type { ContactMessage } from "./types";

/**
 * Mesaja e-postayla yanıt bağlantısı (mailto:) — SMTP gerektirmez, posta
 * personelin kendi istemcisinden gider. Gövde gönderenin dilinde: hazır
 * yanıt şablonu ya da boş selam + imza, altında alıntılanmış ilk mesaj.
 */

const YANIT = {
  tr: {
    konu: "Koçum.Net — mesajınız hakkında",
    selam: (ad: string) => `Merhaba ${ad},`,
    alinti: (t: string) => `${t} tarihinde yazdığınız mesaj:`,
    yerel: "tr-TR",
  },
  en: {
    konu: "Koçum.Net — about your message",
    selam: (ad: string) => `Hello ${ad},`,
    alinti: (t: string) => `Your message of ${t}:`,
    yerel: "en-GB",
  },
  ar: {
    konu: "Koçum.Net — بخصوص رسالتك",
    selam: (ad: string) => `مرحباً ${ad}،`,
    alinti: (t: string) => `رسالتك بتاريخ ${t}:`,
    yerel: "ar",
  },
} as const;

/** Bazı posta istemcileri (ör. masaüstü Outlook) ~2000 karakterden uzun mailto adresini kesiyor. */
const EN_UZUN_BAGLANTI = 2000;

/** Şablondaki {ad}, {imza}, {konu} yer tutucularını doldurur. */
export function sablonuDoldur(govde: string, d: { ad: string; imza: string; konu: string }) {
  return govde.replace(/\{(ad|imza|konu)\}/g, (_, k: "ad" | "imza" | "konu") => d[k]);
}

export function yanitBaglantisi(m: ContactMessage, imza: string, sablonGovdesi?: string): string {
  const d = YANIT[m.locale as keyof typeof YANIT] ?? YANIT.tr;
  const ad = m.name.split(" ")[0] || m.name;
  const giris = sablonGovdesi
    ? sablonuDoldur(sablonGovdesi, { ad, imza, konu: m.subject ?? "" })
    : [d.selam(ad), "", "", "", imza, "Koçum.Net"].join("\n");
  const tarih = new Date(m.created_at).toLocaleString(d.yerel, {
    timeZone: "Europe/Istanbul",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const konu = m.subject ? `Re: ${m.subject}` : d.konu;
  const adres = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(konu)}&body=`;

  // Alıntı, bağlantı istemcide açılabilecek uzunlukta kalana dek kısaltılır;
  // şablon metni hiç kesilmez.
  let son = "";
  for (const sinir of [900, 500, 250, 0]) {
    const metin = m.message.length > sinir ? m.message.slice(0, sinir) + " […]" : m.message;
    const alinti = metin
      .split(/\r?\n/)
      .map((s) => `> ${s}`)
      .join("\n");
    const govde = sinir > 0 ? [giris, "", d.alinti(tarih), alinti].join("\n") : giris;
    son = adres + encodeURIComponent(govde.replace(/\r?\n/g, "\r\n"));
    if (son.length <= EN_UZUN_BAGLANTI) break;
  }
  return son;
}
