/**
 * Bellek içi hız sınırı (tek örnek çalıştığı için yeterli; yatay ölçeklenirse
 * her örnek kendi sayacını tutar).
 *
 * Sabit pencere: anahtarın ilk denemesiyle pencere açılır, süre dolunca sıfırlanır.
 * Her deneme sayılır ve aynı çağrıda karar verilir; aynı anda gelen istekler
 * sınırı aşamaz.
 */
export interface SinirKurali {
  limit: number;
  pencereMs: number;
}

export const SINIRLAR = {
  kayit: { limit: 10, pencereMs: 60 * 60 * 1000 }, // IP başına saatte 10
  giris: { limit: 10, pencereMs: 15 * 60 * 1000 }, // IP + e-posta başına 15 dakikada 10
  sifirlamaIstegi: { limit: 5, pencereMs: 60 * 60 * 1000 }, // IP başına saatte 5
} satisfies Record<string, SinirKurali>;

interface Kova {
  sayi: number;
  bitis: number;
}

export class HizSiniri {
  private readonly kovalar = new Map<string, Kova>();
  private readonly zamanlayici: NodeJS.Timeout;

  constructor(private readonly simdi: () => number = Date.now) {
    // Süresi dolan kovaları ara ara temizle; süreç kapanmasını engellemesin.
    this.zamanlayici = setInterval(() => this.temizle(), 5 * 60 * 1000);
    this.zamanlayici.unref();
  }

  /**
   * Denemeyi sayar. Sınır aşıldıysa kalan bekleme süresini (saniye) döner,
   * aşılmadıysa null.
   */
  say(anahtar: string, kural: SinirKurali): number | null {
    const simdi = this.simdi();
    let kova = this.kovalar.get(anahtar);
    if (!kova || kova.bitis <= simdi) {
      kova = { sayi: 0, bitis: simdi + kural.pencereMs };
      this.kovalar.set(anahtar, kova);
    }
    kova.sayi += 1;
    if (kova.sayi > kural.limit) return Math.max(1, Math.ceil((kova.bitis - simdi) / 1000));
    return null;
  }

  /** Başarılı girişte sayaç sıfırlanır: doğru parolayı bilen kilitli kalmasın. */
  sifirla(anahtar: string): void {
    this.kovalar.delete(anahtar);
  }

  temizle(): void {
    const simdi = this.simdi();
    for (const [anahtar, kova] of this.kovalar) if (kova.bitis <= simdi) this.kovalar.delete(anahtar);
  }

  kapat(): void {
    clearInterval(this.zamanlayici);
    this.kovalar.clear();
  }
}
