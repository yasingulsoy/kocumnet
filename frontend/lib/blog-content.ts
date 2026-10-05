/**
 * Blog yazısı HTML'ini sayfaya hazırlar (yalnızca sunucuda çalışır).
 *
 * İçerik backend'de sanitize-html'den geçiyor; başlıklara `id` izni yok.
 * Burada iki şey yapılıyor:
 *
 * 1. İçerikteki göreli /uploads/... görsel yollarını backend adresine çözmek.
 * 2. h2/h3 başlıklarına okunabilir `id` vermek ve içindekiler listesini
 *    çıkarmak. Uzun yazıda okur bölüme atlayabilsin, bölüm bağlantısı
 *    (…/blog/yazi#calisma-plani) paylaşılabilsin.
 *
 * Kimlikler yalnızca [a-z0-9-] ya da "bolum-N": özniteliğe eklenen değer
 * HTML'e kaçış gerektiren hiçbir karakter taşımaz.
 */

export interface IcindekilerOgesi {
  id: string;
  /** Başlığın düz metni (etiketsiz, varlıkları çözülmüş). */
  metin: string;
  seviye: 2 | 3;
}

/** Bu sayıdan az başlıklı yazıda içindekiler kutusu gösterilmez. */
export const ICINDEKILER_ALT_SINIR = 3;

const VARLIKLAR: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function duzMetin(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27);/g, (v) => VARLIKLAR[v] ?? v)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Başlıktan adres parçası: "Kalıcı Öğrenme İçin 3 Adım" → "kalici-ogrenme-icin-3-adim".
 * Latin dışı (Arapça) başlıkta boş döner; çağıran "bolum-N" kullanır.
 */
function kimlikUret(metin: string): string {
  const latin = Array.from(
    metin
      .replace(/ı/g, "i")
      .replace(/İ/g, "I")
      .normalize("NFKD")
  )
    // NFKD harfi ve işaretini ayırır (ş → s + çengel); ASCII dışını atınca
    // geriye yalın harf kalır. Kaynakta kaçış dizisi yazmamak için kodla.
    .filter((c) => c.charCodeAt(0) < 128)
    .join("");

  return latin
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Göreli /uploads/... yollarını backend'e çözer. */
function gorselYollari(html: string, backendUrl: string): string {
  return html.replace(/src="(\/uploads\/[^"]+)"/g, `src="${backendUrl}$1"`);
}

export function blogIceriginiHazirla(
  html: string | null | undefined,
  backendUrl: string
): { html: string; icindekiler: IcindekilerOgesi[] } {
  // İçeriği boş bir yazı da gelebilir (taslaktan yayına alınmış, gövdesi
  // silinmiş). Eskiden burada .replace() çağrılıyordu ve sayfa 500 veriyordu.
  if (!html) return { html: "", icindekiler: [] };

  const icindekiler: IcindekilerOgesi[] = [];
  const kullanilan = new Set<string>();

  const islenmis = gorselYollari(html, backendUrl).replace(
    /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (tam, seviyeStr: string, oznitelikler: string | undefined, ic: string) => {
      const metin = duzMetin(ic);
      if (!metin) return tam;

      const taban = kimlikUret(metin) || `bolum-${icindekiler.length + 1}`;
      let id = taban;
      for (let n = 2; kullanilan.has(id); n++) id = `${taban}-${n}`;
      kullanilan.add(id);

      const seviye = (seviyeStr === "2" ? 2 : 3) as 2 | 3;
      icindekiler.push({ id, metin, seviye });

      // Varsa eski id'yi at (sanitize zaten siliyor; yine de çift id olmasın).
      const temiz = (oznitelikler ?? "").replace(/\sid\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      return `<h${seviye}${temiz} id="${id}">${ic}</h${seviye}>`;
    }
  );

  return { html: islenmis, icindekiler };
}
