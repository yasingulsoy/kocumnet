/**
 * Check-up ayarının hazırlığı (checkup/API.md "Hazırlık"). Saf modül: sayılar
 * çağırandan gelir, sonuç Türkçe sorun cümleleridir.
 *
 * KARMA:
 *   - reçete toplamı tür soru sayısına eşit;
 *   - her kazanım satırı için kazanımda yeterli aktif soru;
 *   - her konu satırı için: konudaki aktif soru − aynı konunun reçetedeki
 *     kazanım satırlarının istediği ≥ konu satırının istediği.
 * SABIT: listede tam tür soru sayısı kadar soru, hepsi aktif ve o sınavın.
 */

export interface ReceteSatirGirdisi {
  konuId: number | null;
  kazanimId: number | null;
  soruSayisi: number;
  /** Cümlelerde kullanılır: konu ya da kazanım adı. */
  ad: string;
  /** Kazanım satırında kazanımın konusu. */
  kazanimKonuId?: number | null;
}

export interface SabitSoruGirdisi {
  soruId: number;
  aktif: boolean;
  /** Soru bu ayarın sınavına ait mi (soru sonradan başka sınava taşınmış olabilir). */
  sinavUygun: boolean;
}

export interface HazirlikGirdisi {
  turSoruSayisi: number;
  secim: "KARMA" | "SABIT";
  recete: ReceteSatirGirdisi[];
  /** kazanımId → aktif soru sayısı */
  kazanimAktif: Map<number, number>;
  /** konuId → aktif soru sayısı */
  konuAktif: Map<number, number>;
  sabit: SabitSoruGirdisi[];
}

export interface Hazirlik {
  hazir: boolean;
  sorunlar: string[];
}

const liste = (idler: number[]) => {
  const ilk = idler.slice(0, 10).map((id) => `#${id}`);
  return idler.length > 10 ? `${ilk.join(", ")} ve ${idler.length - 10} soru daha` : ilk.join(", ");
};

export function hazirlikHesapla(g: HazirlikGirdisi): Hazirlik {
  const sorunlar: string[] = [];

  if (g.secim === "KARMA") {
    if (g.recete.length === 0) {
      sorunlar.push(`Reçete boş. Konu ya da kazanım satırları ekleyin; toplam ${g.turSoruSayisi} soru olmalı.`);
    } else {
      const toplam = g.recete.reduce((t, s) => t + s.soruSayisi, 0);
      if (toplam !== g.turSoruSayisi) {
        sorunlar.push(`Reçete toplamı ${toplam} soru; türün soru sayısı ${g.turSoruSayisi}. İkisi eşit olmalı.`);
      }
    }

    // Konuların kazanım satırlarına ayrılan soru sayısı
    const konuyaAyrilan = new Map<number, number>();
    for (const s of g.recete) {
      if (s.kazanimId != null && s.kazanimKonuId != null) {
        konuyaAyrilan.set(s.kazanimKonuId, (konuyaAyrilan.get(s.kazanimKonuId) ?? 0) + s.soruSayisi);
      }
    }

    for (const s of g.recete) {
      if (s.kazanimId != null) {
        const havuz = g.kazanimAktif.get(s.kazanimId) ?? 0;
        if (havuz < s.soruSayisi) {
          sorunlar.push(`"${s.ad}" kazanımında ${havuz} aktif soru var; reçete ${s.soruSayisi} soru istiyor.`);
        }
      } else if (s.konuId != null) {
        const havuz = g.konuAktif.get(s.konuId) ?? 0;
        const ayrilan = konuyaAyrilan.get(s.konuId) ?? 0;
        const kalan = Math.max(0, havuz - ayrilan);
        if (kalan < s.soruSayisi) {
          sorunlar.push(
            ayrilan > 0
              ? `"${s.ad}" konusunda ${havuz} aktif soru var; bu konunun kazanım satırlarına ${ayrilan} soru ayrıldıktan sonra ${kalan} soru kalıyor, konu satırı ${s.soruSayisi} soru istiyor.`
              : `"${s.ad}" konusunda ${havuz} aktif soru var; reçete ${s.soruSayisi} soru istiyor.`
          );
        }
      }
    }
  } else {
    if (g.sabit.length !== g.turSoruSayisi) {
      sorunlar.push(`Sabit listede ${g.sabit.length} soru var; türün soru sayısı ${g.turSoruSayisi}. İkisi eşit olmalı.`);
    }
    const pasif = g.sabit.filter((s) => !s.aktif).map((s) => s.soruId);
    if (pasif.length) sorunlar.push(`Sabit listede ${pasif.length} pasif soru var: ${liste(pasif)}. Aktif yapın ya da listeden çıkarın.`);
    const yabanci = g.sabit.filter((s) => !s.sinavUygun).map((s) => s.soruId);
    if (yabanci.length) sorunlar.push(`Sabit listede bu sınava ait olmayan ${yabanci.length} soru var: ${liste(yabanci)}. Listeden çıkarın.`);
  }

  return { hazir: sorunlar.length === 0, sorunlar };
}
