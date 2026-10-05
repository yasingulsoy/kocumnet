/**
 * Sınav ekranının cevap kaydı kuyruğu ve eşitleme kuralları — React'ten ve
 * tarayıcıdan bağımsız, saf mantık. CheckupRunner bunları kullanır; birim
 * testleri `npm run smoke` içinde ("Sınav kuyruğu").
 *
 * Neden kuyruk: mobil internet kopar. Eski akışta kayıt isteği başarısız
 * olduğunda cevap yalnızca ekranda kalıyordu — öğrenci işaretli görüyor,
 * sunucuda hiçbir şey yok, test bitince o soru boş sayılıyordu. Kayıt
 * kuyrukta bekler, bağlantı gelince yazılır; testi bitirmeden ÖNCE kuyruğun
 * boşalması beklenir.
 */

/** Bekleyen kayıt: aynı soru için son işaret neyse o gider. */
export interface BekleyenKayit {
  choiceId: string | null;
  timeSpentMs: number;
}

/** Kayıt eyleminin yanıtı (saveAnswerAction ile aynı şekil). */
export interface KayitYaniti {
  ok: boolean;
  error?: string;
  kod?: "GECERSIZ" | "KAPANDI" | "SURE_DOLDU" | "OTURUM";
}

/** Bir kayıt turunun sonucu. */
export type TurSonucu = "tamam" | "gecici" | "oturum";

export type KayitDurumu = "saving" | "saved" | "error";

/** Kuyruğun ekrana bildirdiği olaylar; her biri bir ekran durumunu günceller. */
export type KuyrukOlayi =
  | { tur: "durum"; durum: KayitDurumu }
  | { tur: "bekleyen"; sayi: number }
  | { tur: "ardisikHata"; sayi: number }
  | { tur: "hata"; mesaj: string | null }
  | { tur: "oturumYok" }
  | { tur: "kayip"; toplam: number }
  /** Test başka bir yerde bitirilmiş: ekran sunucuyla eşitlenip sonuca gitmeli. */
  | { tur: "kapandi" }
  /** Süre (tolerans dahil) dolmuş: ekran testi bitirmeli. */
  | { tur: "sureDoldu" }
  /** Soru sunucuya yazıldı; bu andan önce okunmuş eşitleme yanıtı onu ezmemeli. */
  | { tur: "kaydedildi"; questionId: string; zaman: number }
  /** Kuyruk değişti: cihazdaki kopyayı güncelle. */
  | { tur: "depola" };

export interface KuyrukSecenekleri {
  kaydet: (questionId: string, kayit: BekleyenKayit) => Promise<KayitYaniti>;
  bildir: (olay: KuyrukOlayi) => void;
  /** Varsayılanı setTimeout / clearTimeout; testte sahte saat. */
  zamanla?: (fn: () => void, ms: number) => unknown;
  iptalEt?: (tutamak: unknown) => void;
  simdi?: () => number;
}

export const KAPANDI_MESAJI = "Bu test kapanmış. Sonucuna yönlendiriliyorsun.";

/** Geri adımlı bekleme: 1 sn, 2 sn, 4 sn … en çok 30 sn. */
export function geriAdimGecikmesi(deneme: number): number {
  return Math.min(30_000, 1_000 * 2 ** deneme);
}

export class KayitKuyrugu {
  private readonly kayitlar = new Map<string, BekleyenKayit>();
  private tur: Promise<TurSonucu> | null = null;
  private zamanlayici: unknown = null;
  private deneme = 0;
  private ardisik = 0;
  private kayip = 0;

  private readonly kaydet: KuyrukSecenekleri["kaydet"];
  private readonly bildir: KuyrukSecenekleri["bildir"];
  private readonly zamanla: NonNullable<KuyrukSecenekleri["zamanla"]>;
  private readonly iptalEt: NonNullable<KuyrukSecenekleri["iptalEt"]>;
  private readonly simdi: NonNullable<KuyrukSecenekleri["simdi"]>;

  constructor(secenekler: KuyrukSecenekleri) {
    this.kaydet = secenekler.kaydet;
    this.bildir = secenekler.bildir;
    this.zamanla = secenekler.zamanla ?? ((fn, ms) => setTimeout(fn, ms));
    this.iptalEt =
      secenekler.iptalEt ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
    this.simdi = secenekler.simdi ?? Date.now;
  }

  get boyut(): number {
    return this.kayitlar.size;
  }

  /** Cihaza yazmak için salt okunur görünüm. */
  get bekleyenler(): ReadonlyMap<string, BekleyenKayit> {
    return this.kayitlar;
  }

  bekliyorMu(questionId: string): boolean {
    return this.kayitlar.has(questionId);
  }

  /** Aynı soru için önceki bekleyen kaydın yerine geçer. Göndermek için bosalt(). */
  ekle(questionId: string, kayit: BekleyenKayit): void {
    this.kayitlar.set(questionId, kayit);
  }

  /** Öğrenci yeni bir işaret koydu ya da bağlantı geldi: beklemeyi baştan başlat. */
  sifirlaDeneme(): void {
    this.deneme = 0;
  }

  /** Bekleyen yeniden deneme zamanlayıcısını iptal eder (ekran kapanırken de). */
  durdur(): void {
    if (this.zamanlayici !== null) {
      this.iptalEt(this.zamanlayici);
      this.zamanlayici = null;
    }
  }

  /**
   * Kuyruğu sunucuya yazar.
   *
   * Bir tur zaten dönüyorsa yenisini başlatmıyoruz: tur, kuyruğa sonradan
   * eklenenleri de görüyor. Çağırana süren turun sözünü veriyoruz. Eskiden
   * burada "henüz değil" dönülüyordu ve son soruyu işaretleyip hemen Bitir
   * diyen öğrenci, bağlantısı sağlamken "bağlantını kontrol et" görüyordu.
   */
  bosalt(): Promise<TurSonucu> {
    this.durdur();
    if (this.kayitlar.size === 0) return Promise.resolve("tamam");
    if (this.tur) return this.tur;

    const tur = this.calistir();
    this.tur = tur;
    void tur.finally(() => {
      if (this.tur === tur) this.tur = null;
    });
    return tur;
  }

  private async calistir(): Promise<TurSonucu> {
    this.bildir({ tur: "durum", durum: "saving" });
    // Bu turda gösterilen bir hata turun sonunda silinmesin.
    let buTurHata = false;
    try {
      while (this.kayitlar.size > 0) {
        const [qid, veri] = this.kayitlar.entries().next().value!;
        const res = await this.kaydet(qid, veri);

        if (res.ok) {
          // Öğrenci bu sırada şıkkı değiştirdiyse yeni kayıt kuyrukta kalsın.
          if (this.kayitlar.get(qid) === veri) this.kayitlar.delete(qid);
          this.bildir({ tur: "kaydedildi", questionId: qid, zaman: this.simdi() });
        } else if (res.kod === "OTURUM") {
          // Giriş düşmüş: tekrar denemek boşuna. Kuyruk cihazda saklı kalır,
          // öğrenci giriş yapıp dönünce gönderilir.
          this.bildir({ tur: "oturumYok" });
          this.bildir({ tur: "durum", durum: "error" });
          return "oturum";
        } else if (res.kod === "KAPANDI" || res.kod === "SURE_DOLDU") {
          // Bu oturuma artık hiçbir cevap yazılamaz. Eskiden sonsuza kadar
          // tekrar deneniyor, bitirme de kuyruk boşalmadığı için hiç
          // gerçekleşmiyordu: öğrenci sıfırlanmış sayaçla ekranda kalıyordu.
          this.kayip += this.kayitlar.size;
          this.bildir({ tur: "kayip", toplam: this.kayip });
          this.kayitlar.clear();
          if (res.kod === "KAPANDI") {
            buTurHata = true;
            this.bildir({ tur: "hata", mesaj: KAPANDI_MESAJI });
            this.bildir({ tur: "kapandi" });
          } else {
            this.bildir({ tur: "sureDoldu" });
          }
        } else {
          // Geçersiz istek (ör. şık bu soruya ait değil): yalnızca bu kayıt düşer.
          buTurHata = true;
          this.bildir({ tur: "hata", mesaj: res.error ?? "Cevap kaydedilemedi." });
          if (this.kayitlar.get(qid) === veri) this.kayitlar.delete(qid);
        }
        this.bildir({ tur: "bekleyen", sayi: this.kayitlar.size });
        this.bildir({ tur: "depola" });
      }

      this.deneme = 0;
      this.ardisik = 0;
      this.bildir({ tur: "ardisikHata", sayi: 0 });
      this.bildir({ tur: "durum", durum: "saved" });
      if (!buTurHata) this.bildir({ tur: "hata", mesaj: null });
      return "tamam";
    } catch {
      // Ağ ya da sunucu hatası: geçici, geri adımlı olarak tekrar dene.
      this.bildir({ tur: "durum", durum: "error" });
      this.ardisik += 1;
      this.bildir({ tur: "ardisikHata", sayi: this.ardisik });
      const gecikme = geriAdimGecikmesi(this.deneme);
      this.deneme += 1;
      this.zamanlayici = this.zamanla(() => {
        this.zamanlayici = null;
        void this.bosalt();
      }, gecikme);
      return "gecici";
    } finally {
      this.bildir({ tur: "bekleyen", sayi: this.kayitlar.size });
      this.bildir({ tur: "depola" });
    }
  }
}

/**
 * Sunucudan gelen işaretleri ekrandakilerle birleştirir.
 *
 * Yerelde bekleyen ya da eşitleme isteği yoldayken değişen / kaydedilen soru
 * YEREL kalır: o soruda sunucunun yanıtı eski bir anı gösteriyor olabilir.
 * Ekranda olmayan soru kimlikleri yok sayılır.
 */
export function sunucuylaBirlestir(
  ekran: Readonly<Record<string, string | null>>,
  sunucu: Readonly<Record<string, string | null>>,
  bekliyorMu: (questionId: string) => boolean,
  sonDegisim: Readonly<Record<string, number>>,
  istekBaslangici: number
): Record<string, string | null> {
  const yeni = { ...ekran };
  for (const [qid, secim] of Object.entries(sunucu)) {
    if (!(qid in yeni)) continue;
    if (bekliyorMu(qid) || (sonDegisim[qid] ?? 0) >= istekBaslangici) continue;
    yeni[qid] = secim;
  }
  return yeni;
}

/**
 * Cihazda saklanan kopyayı bu testin sorularıyla süzer: başka testten kalan
 * ya da bozulmuş kayıt, bu soruda olmayan şık geri yüklenmez. Boş (null)
 * işaret geçerlidir — öğrenci işaretini kaldırmış demektir.
 */
export function depoyuSuz(
  depo: { sonra: readonly unknown[]; kuyruk: readonly unknown[] },
  sorular: readonly { id: string; choices: readonly { id: string }[] }[]
): { sonra: Set<string>; kuyruk: [string, BekleyenKayit][] } {
  const gecerli = new Map(sorular.map((q) => [q.id, new Set(q.choices.map((c) => c.id))]));

  const sonra = new Set(
    depo.sonra.filter((id): id is string => typeof id === "string" && gecerli.has(id))
  );

  const kuyruk: [string, BekleyenKayit][] = [];
  for (const giris of depo.kuyruk) {
    // Bozuk giriş geri yüklemeyi bütünüyle düşürmesin, yalnızca atlansın.
    if (!Array.isArray(giris)) continue;
    const [qid, kayit] = giris as [unknown, Partial<BekleyenKayit> | null];
    const secenekler = typeof qid === "string" ? gecerli.get(qid) : undefined;
    if (!secenekler || !kayit || typeof kayit.timeSpentMs !== "number") continue;
    const secim = kayit.choiceId;
    if (secim !== null && (typeof secim !== "string" || !secenekler.has(secim))) continue;
    kuyruk.push([qid as string, { choiceId: secim, timeSpentMs: kayit.timeSpentMs }]);
  }
  return { sonra, kuyruk };
}

/** Bulunduğun sorudan sonraki ilk boş soru (başa sararak); başka boş yoksa null. */
export function sonrakiBosIndeks(bosIndeksler: readonly number[], index: number): number | null {
  return bosIndeksler.find((i) => i > index) ?? bosIndeksler.find((i) => i !== index) ?? null;
}

/** Son dakikalar uyarısının eşiği (dakika): 5 ve 1; dışındaysa null. */
export function uyariEsigi(kalanMs: number): 1 | 5 | null {
  return kalanMs <= 60_000 ? 1 : kalanMs <= 5 * 60_000 ? 5 : null;
}
