import { prisma } from "@/lib/db";

/**
 * Bakım ucunun (/api/cron) iskeleti: kilit ve işlerin birbirinden bağımsız
 * koşulması. Rota dosyası yalnızca GET, dynamic, maxDuration gibi Next'in
 * tanıdığı adları dışa aktarabildiği için iskelet ayrı dosyada; test de
 * (scripts/tutarlilik-test.mts) buradan çağırıyor.
 */

export interface BakimIsi {
  /** Günlükte ve yanıtta görünen ad. */
  ad: string;
  calistir: () => Promise<unknown>;
}

export interface IsSonucu {
  ad: string;
  ok: boolean;
  /** İş başarılıysa döndürdüğü değer (sayı ya da küçük bir özet). */
  sonuc?: unknown;
  /** İş düştüyse hatanın iletisi; yığın yalnızca sunucu günlüğünde. */
  hata?: string;
  sureMs: number;
}

/** Yanıta giden hata iletisi kısa kalsın: Prisma hataları sorgu parçası taşıyabiliyor. */
function hataMetni(e: unknown): string {
  const ileti = e instanceof Error ? e.message : String(e);
  return ileti.length > 300 ? ileti.slice(0, 300) + "…" : ileti;
}

/**
 * İşleri AYNI ANDA ve birbirinden bağımsız koşar (Promise.allSettled).
 *
 * Eskiden Promise.all vardı: posta gönderimi bir SMTP hatasıyla düşünce
 * süresi dolan testlerin puanlanması da "başarısız" sayılıyor, yanıt 500
 * dönüyor ve hangi işin düştüğü hiçbir yerde yazmıyordu. Şimdi her iş için
 * bir günlük satırı var: ad, sonuç ya da hata, süre.
 */
export async function asamaCalistir(isler: readonly BakimIsi[]): Promise<IsSonucu[]> {
  const sureler: number[] = [];
  const sonuclar = await Promise.allSettled(
    isler.map((is, i) => {
      const t0 = Date.now();
      // Promise.resolve().then: iş eşzamanlı fırlatsa da reddedilmiş söz olur,
      // öbür işleri düşürmez.
      return Promise.resolve()
        .then(is.calistir)
        .finally(() => {
          sureler[i] = Date.now() - t0;
        });
    })
  );

  return sonuclar.map((s, i) => {
    const ad = isler[i].ad;
    const sureMs = sureler[i] ?? 0;
    if (s.status === "fulfilled") {
      console.log(`[cron] ${ad}: tamam ${JSON.stringify(s.value ?? null)} (${sureMs} ms)`);
      return { ad, ok: true, sonuc: s.value ?? null, sureMs };
    }
    console.error(`[cron] ${ad}: HATA (${sureMs} ms)`, s.reason);
    return { ad, ok: false, hata: hataMetni(s.reason), sureMs };
  });
}

/**
 * Üst üste binmeyi engelleyen kilidin anahtarı (iki int4: "kocm", "cron").
 * Başka bir iş advisory kilit kullanırsa farklı anahtar seçsin.
 */
const KILIT_A = 0x6b6f636d;
const KILIT_B = 0x63726f6e;

/**
 * Kilidin en uzun süresi. Cron 15 dakikada bir: takılan bir koşu, sonraki
 * çağrıyı bu süre boyunca "zaten çalışıyor"a düşürür; süre dolunca işlem
 * kapanır ve kilit kendiliğinden bırakılır.
 */
const KILIT_SURESI_MS = 14 * 60_000;

export type KilitSonucu<T> = { alindi: true; deger: T } | { alindi: false };

/**
 * `is`'i yalnızca kilit alınabildiyse koşar; alınamadıysa (başka bir cron
 * çağrısı sürüyor) hiçbir şey yapmadan `{ alindi: false }` döner.
 *
 * Neden üst üste binme sorun: iki çağrı aynı süresi dolmuş testi aynı anda
 * puanlamaya girişiyor, ikisi de aynı kişiye haftalık postayı gönderiyordu.
 *
 * Kilit pg_try_advisory_XACT_lock: bağlantı havuzunda oturum düzeyindeki
 * pg_try_advisory_lock'ı ALAN bağlantı ile BIRAKAN bağlantı farklı olabilir;
 * bırakma sessizce başarısız olur ve kilit havuzdaki bir bağlantıda asılı
 * kalır (bakım bir daha hiç çalışmaz). İşlem düzeyindeki kilit, işlem
 * kapanınca (bitiş, hata, zaman aşımı, süreç çökmesi) her durumda kalkar.
 * İşler kendi bağlantılarıyla çalışır; bu işlem yalnızca kilidi tutar.
 */
export async function kilitle<T>(is: () => Promise<T>): Promise<KilitSonucu<T>> {
  const kutu: { sonuc?: KilitSonucu<T> } = {};
  try {
    await prisma.$transaction(
      async (tx) => {
        const [satir] = await tx.$queryRaw<{ alindi: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${KILIT_A}::int4, ${KILIT_B}::int4) AS alindi
        `;
        if (!satir?.alindi) {
          kutu.sonuc = { alindi: false };
          return;
        }
        kutu.sonuc = { alindi: true, deger: await is() };
      },
      { maxWait: 10_000, timeout: KILIT_SURESI_MS }
    );
  } catch (e) {
    // İşler bitti ama kilit işlemi kapanırken hata çıktı (ör. zaman aşımı):
    // sonuçlar yine geçerli, kilit zaten kalktı.
    if (kutu.sonuc) {
      console.error("[cron] kilit işlemi kapanırken hata:", e);
      return kutu.sonuc;
    }
    throw e;
  }
  return kutu.sonuc ?? { alindi: false };
}
