/**
 * Alıştırma, yanlış defteri ve günlük sınır kuralları — saf modül,
 * veritabanı bilmez.
 *
 * Hocanın kararı bekleyen bütün sayılar BURADA. Biri değişecekse yalnızca
 * bu dosya değişir; veritabanı tarafı (lib/practice.ts, lib/checkup.ts) ve
 * ekranlar bu sabitleri okur. Kuralların testleri `npm run smoke` içinde.
 *
 * GÜNLÜK SINIRLARIN HEPSİ TÜRKİYE GÜNÜ (00:00 Europe/Istanbul, gunBasi):
 * kontrol testi, alıştırma, bugünkü tekrar, koça soru ve hata bildirimi.
 * Eskiden kontrol testi ve alıştırma kayan 24 saat sayıyordu, mesaj ise
 * "yarın" diyordu: akşam 22:00'de hakkını dolduran öğrenci ertesi gün
 * 22:00'ye kadar bekliyordu.
 */

// ─────────────────────────────────────────────────────────────
// Alıştırma
// ─────────────────────────────────────────────────────────────

/**
 * Alıştırma oturumu ne kadar açık kalır (saat).
 *
 * Süre TUTULMAZ: bu yalnızca yarıda bırakılan oturumun bir gün sonra
 * kapanması için. Kapanan oturumun cevaplanmış soruları olduğu gibi kalır.
 */
export const ALISTIRMA_OMRU_SAAT = 24;

/** "Bu konuda çalış" kaç soru getirir. */
export const KONU_CALISMA_SORU = 5;

/** Benzer soruda zorluk farkı en fazla bu kadar (1-5 ölçeğinde). */
export const BENZER_ZORLUK_FARKI = 1;

/**
 * Son bu kadar saatte gösterilen soru ANINDA alıştırmaya ("Benzerini çöz",
 * "Bu konuda çalış") HİÇ gelmez.
 *
 * 30 günlük tekrar engeli alıştırmada yalnızca bir tercih (havuz darsa
 * görülmüş soru da gelir); ama az önce çözümüyle görülen soruyu yeniden
 * sormak "benzer soru" değil, ezber yoklaması olur. Bugünkü tekrara
 * uygulanmaz: vadeler gün başına yuvarlı, akşam testinin ertesi sabahı bu
 * yasak dar havuzda tekrarı boşaltıyordu (orada "önce hiç görülmemiş" yeter).
 */
export const ASGARI_ARA_SAAT = 24;

/**
 * Günde (Türkiye günü) en fazla kaç alıştırma sorusu AÇILIR ("Benzerini
 * çöz" + "Bu konuda çalış" + koçun konu ödevi). Sayılan, açılan oturumların
 * soruları; cevaplanıp cevaplanmadıkları değil (lib/practice.ts kullanilanHak).
 *
 * Alıştırma cevabı ve çözümü hemen gösterdiği için sınırsız bırakılırsa
 * havuz, cevap anahtarıyla birlikte birkaç günde boşaltılabilir (kontrol
 * testindeki günlük sınırla aynı gerekçe). Bugünkü tekrar bu sınıra girmez,
 * kendi sınırı var.
 */
export const GUNLUK_ALISTIRMA_SORU = 30;

/**
 * KOÇ ÖDEVİ SINIR KURALI — konu ödevinin bir oturumu kaç soru getirir.
 *
 * Ödev oturumları günlük sınıra SAYILIR (ödev yapan öğrencinin o günkü
 * serbest alıştırma hakkı azalır), ama sınır ödevi ENGELLEMEZ: ödevin
 * kalan sorusu bitene kadar oturum açılır. Neden: ödevi koç verdi ve kaç
 * soru olacağına o karar verdi; günlük sınır öğrencinin kendi başına havuzu
 * boşaltmasına karşı bir fren, koçun kararını geri çevirmek için değil.
 * Muafiyet ödevle sınırlı (panelde en fazla lib/odev.ts ODEV_SORU_UST), yani
 * fren delinmiyor.
 *
 * Oturum yine en fazla KONU_CALISMA_SORU soru: hak varsa normal konu
 * alıştırması kadar, hak bittiyse ödevin kalanı kadar.
 */
export function odevAlistirmaAdedi(odevKalan: number, gunlukKalan: number): number {
  return Math.min(KONU_CALISMA_SORU, Math.max(0, odevKalan, gunlukKalan));
}

// ─────────────────────────────────────────────────────────────
// Kontrol testi (konu tekrar testi)
// ─────────────────────────────────────────────────────────────

/**
 * Günde (Türkiye günü) en fazla kaç kontrol testi (TOPIC_RETEST) başlatılır.
 *
 * Hem havuzu korur hem öğrenciyi: günde on kontrol testi çözmek "çalışmak"
 * değil, çalışmaktan kaçmanın rahat yolu. Açık kontrol testine dönmek sınıra
 * takılmaz (lib/checkup.ts startTopicRetest önce açık testi arar).
 */
export const GUNLUK_TEKRAR_SINIRI = 8;

// ─────────────────────────────────────────────────────────────
// Yanlış defteri (aralıklı tekrar)
// ─────────────────────────────────────────────────────────────

/**
 * Tekrar aralıkları (gün). Ölçümdeki yanlıştan sonra ilk tekrar [0] gün
 * sonra; doğru bilinen her tekrar bir sonraki aralığa geçer, sonuncusu da
 * doğruysa madde defterden çıkar. Yanlış (ya da "Bilmiyorum") başa döndürür.
 *
 * ⚠️ Hoca kararı bekliyor (1/3/7). Aralık eklemek/çıkarmak yalnızca bu dizi;
 * maddedeki `stage` bu dizinin indeksidir.
 */
export const TEKRAR_ARALIKLARI_GUN = [1, 3, 7] as const;

/** Bugünkü tekrarda en fazla kaç soru (Türkiye saatiyle gün başına). */
export const GUNLUK_TEKRAR_SORU = 10;

/**
 * İpucuyla gelen doğru "Bugünkü tekrar"da TAM DOĞRU SAYILMAZ: madde
 * ilerlemez (aşaması aynı kalır), bu kadar gün sonra yeniden gelir.
 * Başa da dönmez: soruyu ipucuyla çözen öğrenci yanlış yapmış değil, ama
 * aralığı açmak için kendi başına çözmesini görmemiz gerekiyor.
 *
 * ⚠️ Hoca kararı bekliyor (1 gün, aşama korunur).
 */
export const IPUCLU_DOGRU_ARA_GUN = 1;

const GUN_MS = 86_400_000;

/**
 * Türkiye saatiyle günün başı (00:00). Vadeler gün başına yuvarlanır:
 * akşam 21:00'de yapılan yanlış "yarın" gelmeli, yarın 21:00'de değil —
 * yoksa sabah tekrara oturan öğrenci onu göremez.
 *
 * Türkiye 2016'dan beri yıl boyu UTC+3 (lib/digest.ts ile aynı varsayım).
 */
export function gunBasi(now: Date): Date {
  const gun = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${gun}T00:00:00+03:00`);
}

/** `zaman`ın gün başından `gun` gün sonrası. */
export function vade(zaman: Date, gun: number): Date {
  return new Date(gunBasi(zaman).getTime() + gun * GUN_MS);
}

export interface DefterDurumu {
  stage: number;
  dueAt: Date;
  resolvedAt: Date | null;
}

/** Ölçümde yanlış/boş: madde ilk aşamada, ilk aralık sonra. */
export function yanlisSonrasi(zaman: Date): DefterDurumu {
  return { stage: 0, dueAt: vade(zaman, TEKRAR_ARALIKLARI_GUN[0]), resolvedAt: null };
}

/**
 * Bir ölçümün yanlışı maddeye ne yapmalı? Yeniden puanlamada idempotent:
 *
 *  - madde yok → OLUSTUR;
 *  - maddeyi bu ölçüm zaten yazmış → DOKUNMA (aynı test ikinci kez puanlandı);
 *  - madde bu yanlıştan SONRA değişmiş (daha yeni bir yanlış ya da tekrar
 *    cevabı) → DOKUNMA (geç puanlanan eski test ilerlemeyi silmesin);
 *  - yoksa → SIFIRLA (ilk aşama; defterden çıkmışsa yeniden açılır).
 */
export function yanlisKarari(
  mevcut: { lastSessionId: string; lastWrongAt: Date; lastReviewedAt: Date | null } | null,
  olay: { sessionId: string; zaman: Date }
): "OLUSTUR" | "SIFIRLA" | "DOKUNMA" {
  if (!mevcut) return "OLUSTUR";
  if (mevcut.lastSessionId === olay.sessionId) return "DOKUNMA";
  if (mevcut.lastWrongAt.getTime() >= olay.zaman.getTime()) return "DOKUNMA";
  if (mevcut.lastReviewedAt && mevcut.lastReviewedAt.getTime() >= olay.zaman.getTime()) return "DOKUNMA";
  return "SIFIRLA";
}

/**
 * Tekrar cevabından sonra madde: doğruysa bir sonraki aralık ya da çıkış,
 * değilse başa. İpucuyla doğru: aşama aynı, IPUCLU_DOGRU_ARA_GUN sonra yine.
 */
export function tekrarSonrasi(
  stage: number,
  dogru: boolean,
  simdi: Date,
  ipucuyla = false
): DefterDurumu & { cozuldu: boolean } {
  if (!dogru) return { ...yanlisSonrasi(simdi), cozuldu: false };
  if (ipucuyla) return { stage, dueAt: vade(simdi, IPUCLU_DOGRU_ARA_GUN), resolvedAt: null, cozuldu: false };
  const sonraki = stage + 1;
  if (sonraki < TEKRAR_ARALIKLARI_GUN.length) {
    return { stage: sonraki, dueAt: vade(simdi, TEKRAR_ARALIKLARI_GUN[sonraki]), resolvedAt: null, cozuldu: false };
  }
  return { stage, dueAt: simdi, resolvedAt: simdi, cozuldu: true };
}

/** "bugün", "yarın", "3 gün sonra" — vade metni (Türkiye günleriyle). */
export function vadeMetni(dueAt: Date, now: Date): string {
  const fark = Math.round((gunBasi(dueAt).getTime() - gunBasi(now).getTime()) / GUN_MS);
  if (fark <= 0) return "bugün";
  if (fark === 1) return "yarın";
  if (fark < 7) return `${fark} gün sonra`;
  return dueAt.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long" });
}

// ─────────────────────────────────────────────────────────────
// Benzer soru
// ─────────────────────────────────────────────────────────────

/** Benzerlik için gereken alanlar. `level` boş = yalnızca paket sorusu. */
export interface BenzerSoru {
  questionId: string;
  topicId: string;
  objectiveId: string | null;
  level: string | null;
  difficulty: number;
  /** Kaynakta: sorunun sorulduğu sınav. */
  examScope?: string;
}

export interface BenzerAday extends BenzerSoru {
  /** Son 30 günde bu öğrenciye gösterildi mi (gösterildiyse ne zaman). */
  sonGosterim: Date | null;
  /**
   * Adayın sorulabildiği sınavlar (sorgu lib/exam-scope.ts kuralıyla
   * etiketler). Kaynağın sınavı burada yoksa aday o kaynağa verilmez.
   */
  kapsamlar?: readonly string[];
}

/**
 * Aday, kaynağın benzeri mi? Kural tek yerde:
 *
 *  - asla aynı soru değil,
 *  - kaynağın kazanımı varsa AYNI KAZANIM, yoksa aynı konu,
 *  - aynı seviye (seviyesiz soru yalnızca seviyesiz soruyla eşleşir),
 *  - zorluk farkı en fazla BENZER_ZORLUK_FARKI.
 *
 * Sınav kapsamı burada DEĞİL: o kural lib/exam-scope.ts'te ve aday sorgusu
 * onu uyguluyor.
 */
export function benzerMi(kaynak: BenzerSoru, aday: BenzerSoru): boolean {
  if (aday.questionId === kaynak.questionId) return false;
  if (kaynak.objectiveId ? aday.objectiveId !== kaynak.objectiveId : aday.topicId !== kaynak.topicId) {
    return false;
  }
  if ((aday.level ?? null) !== (kaynak.level ?? null)) return false;
  return Math.abs(aday.difficulty - kaynak.difficulty) <= BENZER_ZORLUK_FARKI;
}

/** Aday kaynağın sınavında sorulabilir mi (etiket yoksa sınav denetimi yok). */
export function kapsamUygun(kaynak: BenzerSoru, aday: BenzerAday): boolean {
  return !kaynak.examScope || !aday.kapsamlar || aday.kapsamlar.includes(kaynak.examScope);
}

/** Kaynağın en az bir benzeri var mı — seçimle AYNI kural ("ölü düğme" olmasın). */
export function benzeriVar(kaynak: BenzerSoru, adaylar: readonly BenzerAday[]): boolean {
  return adaylar.some((a) => benzerMi(kaynak, a) && kapsamUygun(kaynak, a));
}

/**
 * Her kaynağa (verilen sırayla) bir benzer soru seçer.
 *
 *  - Önce yakın zamanda gösterilmemiş sorular; hepsi gösterildiyse en eski
 *    gösterilen. Kaynak soruların hiçbiri aday olamaz.
 *  - Aynı soru iki kaynağa birden verilmez.
 *  - Benzeri bulunamayan kaynak sonuçta YOKTUR; çağıran bunu öğrenciye söyler.
 *
 * `rastgele` testte sabitlenebilsin diye parametre.
 */
export function benzerAta(
  kaynaklar: BenzerSoru[],
  adaylar: readonly BenzerAday[],
  rastgele: () => number = Math.random
): Map<string, BenzerAday> {
  const kaynakIdleri = new Set(kaynaklar.map((k) => k.questionId));
  const kullanilan = new Set<string>();
  const sonuc = new Map<string, BenzerAday>();

  for (const k of kaynaklar) {
    if (sonuc.has(k.questionId)) continue;
    const uygun = adaylar.filter(
      (a) =>
        !kaynakIdleri.has(a.questionId) &&
        !kullanilan.has(a.questionId) &&
        benzerMi(k, a) &&
        kapsamUygun(k, a)
    );
    if (uygun.length === 0) continue;

    const taze = uygun.filter((a) => a.sonGosterim === null);
    let secilen: BenzerAday;
    if (taze.length > 0) {
      secilen = taze[Math.floor(rastgele() * taze.length)];
    } else {
      // Hepsi yakında görülmüş: en eski gösterilen, öğrencinin en az hatırladığı.
      secilen = [...uygun].sort(
        (a, b) => (a.sonGosterim?.getTime() ?? 0) - (b.sonGosterim?.getTime() ?? 0)
      )[0];
    }
    kullanilan.add(secilen.questionId);
    sonuc.set(k.questionId, secilen);
  }

  return sonuc;
}
