import "server-only";
import { BackendError, backend } from "./backend";
import { listBlogs, listMessages } from "./data";
import type { AdminBlog } from "./types";

/**
 * Genel bakış grafikleri:
 *  · haftalık mesaj: backend'in /api/admin/stats/contact-messages ucu. Sayım
 *    SQL'de, haftalar İstanbul saatiyle pazartesi başlar; gelenin yanında
 *    yanıtlanan ya da arşivlenen sayısı da gelir. Uç yoksa (backend ayrı
 *    dağıtılıyor, eski sürüm 404 verir) eski yol: mesaj listesini sayfa sayfa
 *    çekip burada saymak (en fazla 5 × 100 mesaj, yalnızca gelen);
 *  · en çok okunanlar: /api/blogs yayındakiler (view_count birikimli
 *    toplamdır; dönemlik okuma verisi yok).
 */

const GUN = 86_400_000;

/** Europe/Istanbul takvim günü (yyyy-aa-gg). */
const gun = (v: string | Date) => new Date(v).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

/** O haftanın pazartesisi (yyyy-aa-gg). */
function haftaBasi(gunAnahtari: string) {
  const d = new Date(`${gunAnahtari}T12:00:00Z`);
  const fark = (d.getUTCDay() + 6) % 7; // pazartesi = 0
  return gun(new Date(d.getTime() - fark * GUN));
}

/** "6 Eki" gibi hafta başı etiketi. */
const etiket = (h: string) =>
  new Date(`${h}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });

export interface HaftalikMesaj {
  /** "6 Eki" gibi hafta başı etiketleri, eskiden yeniye. */
  etiketler: string[];
  /** Gelen mesaj (spam hariç). */
  sayilar: number[];
  /** Spam hariç dönemdeki toplam. */
  toplam: number;
  /** O hafta yanıtlanan ya da arşivlenen; eski backend'de (yedek yol) null. */
  kapanan: number[] | null;
  kapananToplam: number | null;
  /** Mesaj çoksa ve dönemin başına inilemediyse dönem kısaltıldı (yalnızca yedek yol). */
  kisaltildi: boolean;
}

/** GET /api/admin/stats/contact-messages yanıtı (backend routes/admin.js). */
interface MesajIstatistigi {
  timezone: string;
  weeks: { week_start: string; received: number; answered: number }[];
  totals: { received: number; answered: number };
  /** Spam hariç bütün mesajların yanıtlanan ya da arşivlenen payı (0-1). */
  answered_share: number | null;
  unread: number;
}

export async function haftalikMesajlar(hafta = 12): Promise<HaftalikMesaj> {
  let veri: MesajIstatistigi;
  try {
    veri = (await backend<{ data: MesajIstatistigi }>(`/api/admin/stats/contact-messages?weeks=${hafta}`)).data;
  } catch (e) {
    // Backend henüz bu ucu tanımıyor: eski yol.
    if (e instanceof BackendError && e.status === 404) return sayfalayarak(hafta);
    throw e;
  }
  if (!Array.isArray(veri?.weeks)) throw new Error("Mesaj istatistiği beklenmeyen biçimde geldi.");

  const sayilar = veri.weeks.map((w) => w.received);
  const kapanan = veri.weeks.map((w) => w.answered);
  return {
    etiketler: veri.weeks.map((w) => etiket(w.week_start)),
    sayilar,
    toplam: sayilar.reduce((a, b) => a + b, 0),
    kapanan,
    kapananToplam: kapanan.reduce((a, b) => a + b, 0),
    kisaltildi: false,
  };
}

/** Yedek yol: en yeni mesajlardan geriye, dönemin başına inene kadar en fazla 5 sayfa. */
async function sayfalayarak(hafta: number): Promise<HaftalikMesaj> {
  const buHafta = haftaBasi(gun(new Date()));
  const haftalar: string[] = [];
  for (let i = hafta - 1; i >= 0; i--) haftalar.push(gun(new Date(new Date(`${buHafta}T12:00:00Z`).getTime() - i * 7 * GUN)));
  const ilk = haftalar[0];

  const tarihler: string[] = [];
  let sayfa = 1;
  let indi = false;
  for (; sayfa <= 5; sayfa++) {
    const r = await listMessages({ page: sayfa, limit: 100 });
    for (const m of r.data) if (m.status !== "spam") tarihler.push(m.created_at);
    const enEski = r.data[r.data.length - 1];
    if (!enEski || haftaBasi(gun(enEski.created_at)) < ilk || sayfa >= r.pagination.totalPages) {
      indi = true;
      break;
    }
  }

  const sayac = new Map(haftalar.map((h) => [h, 0]));
  for (const t of tarihler) {
    const h = haftaBasi(gun(t));
    if (sayac.has(h)) sayac.set(h, (sayac.get(h) ?? 0) + 1);
  }

  // 500 mesajdan sonra da dönemin başına inilemediyse: eldeki en eski haftadan başla.
  let gecerli = haftalar;
  if (!indi && tarihler.length) {
    const enEskiHafta = haftaBasi(gun(tarihler[tarihler.length - 1]));
    gecerli = haftalar.filter((h) => h > enEskiHafta);
  }

  const sayilar = gecerli.map((h) => sayac.get(h) ?? 0);
  return {
    etiketler: gecerli.map(etiket),
    sayilar,
    toplam: sayilar.reduce((a, b) => a + b, 0),
    kapanan: null,
    kapananToplam: null,
    kisaltildi: gecerli.length < haftalar.length,
  };
}

export interface YayinOzeti {
  /** Yayındaki en yeni yazılar (en fazla 100), oluşturulma sırasına göre. */
  yazilar: AdminBlog[];
  /** Yayındaki toplam yazı; 100'den çoksa "en çok okunan" bunların içinden. */
  toplam: number;
}

export async function yayindakiYazilar(): Promise<YayinOzeti> {
  const r = await listBlogs({ durum: "published", limit: 100 });
  return { yazilar: r.data, toplam: r.pagination.total };
}
