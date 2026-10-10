/**
 * Soru inceleme notu (QuestionNote) — kurallar. Saf modül: not kutusu
 * (istemci) ve eylem (sunucu) aynı sınırı ve aynı temizliği kullanır.
 *
 * Not yalnızca personel içindir: soru ekranında görünür, öğrenci uygulaması
 * bu tabloyu hiç okumaz. Yazma ve çözme içerik rollerinde (CONTENT_ROLES),
 * okuma herkeste.
 */

/** Şemadaki "~2000 karakter": veritabanında sınır yok, burada denetlenir. */
export const NOT_SINIRI = 2000;

/**
 * Satır sonları kalır (madde madde not yazılabilsin), denetim karakterleri
 * gider, üçten fazla boş satır ikiye iner, satır sonu boşlukları silinir.
 */
export function notuTemizle(ham: string): string {
  return ham
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, "")
    .replace(/[  ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Personel damgasından "(#id)" kısmı: ekranda e-posta, tamamı üstüne gelince. */
export function damgaAdi(damga: string | null | undefined): string {
  return damga?.replace(/\s*\(#\d+\)$/, "") ?? "—";
}

/** Madde analizi bulgusundan not metni (soru ekranı ve analiz listesi aynı dili konuşsun). */
export function bulguNotu(b: { baslik: string; aciklama: string }, kunye: { version: number; n: number }): string {
  return `Madde analizi · ${b.baslik} (v${kunye.version}, ${kunye.n} cevap): ${b.aciklama}`;
}

/** Birden çok bulgu: her biri ayrı satırda. */
export function bulgularNotu(liste: { baslik: string; aciklama: string }[], kunye: { version: number; n: number }): string {
  if (liste.length === 1) return bulguNotu(liste[0], kunye);
  return [`Madde analizi (v${kunye.version}, ${kunye.n} cevap):`, ...liste.map((b) => `- ${b.baslik}: ${b.aciklama}`)].join("\n");
}
