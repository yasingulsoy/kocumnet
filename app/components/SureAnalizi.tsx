import { CircleCheck, Lightbulb, Timer } from "lucide-react";
import { sureAnaliziGetir } from "@/lib/checkup";
import { SON_DAKIKA_PENCERESI, sureMetni, type SiraTuru } from "@/lib/sure-analizi";
import { cx } from "@/components/tailadmin/cx";
import { ComponentCard } from "@/components/tailadmin/ui/Card";

const SIRA_ADI: Record<SiraTuru, string> = {
  SIRALI: "Sırayla",
  TURLAMA: "Turlayarak",
  ATLAMALI: "Atlayıp dönerek",
};

function Olcu({ etiket, deger, alt, uyari }: { etiket: string; deger: string; alt?: string; uyari?: boolean }) {
  return (
    <div className={cx("rounded-xl p-3", uyari ? "bg-warning-50" : "bg-gray-50")}>
      <p className="text-theme-xs text-gray-500">{etiket}</p>
      <p className={cx("tabular mt-0.5 font-display text-base font-semibold", uyari ? "text-warning-700" : "text-gray-800")}>
        {deger}
      </p>
      {alt ? <p className="tabular text-theme-xs text-gray-500">{alt}</p> : null}
    </div>
  );
}

/**
 * Sonuç ekranının "Süre ve strateji" kartı (lib/sure-analizi.ts). Yalnızca
 * ekranda çözülmüş süreli ölçümde; kâğıtta, alıştırmada ve süresi hiç
 * kaydedilmemiş eski oturumda hiçbir şey çizmez.
 *
 * Soru numaraları cevap incelemesindeki karta bağlanır (#soru-N).
 */
export async function SureAnaliziKarti({ sessionId, userId }: { sessionId: string; userId: string }) {
  const a = await sureAnaliziGetir(sessionId, userId);
  if (!a) return null;

  const sira = a.sira;
  return (
    <ComponentCard
      title="Süre ve strateji"
      desc="Bildiğini sınavda nasıl kullandın: hangi soruda takıldın, nasıl bir sırayla gittin."
      icon={<Timer aria-hidden />}
      flush
    >
      <div className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-4 sm:p-6">
        <Olcu
          etiket="Soru başına"
          deger={sureMetni(a.ortalamaMs)}
          alt={`hedef ${sureMetni(a.hedefOrtalamaMs)}`}
          uyari={a.hedefOrani > 1.3}
        />
        <Olcu
          etiket="Çözüm sırası"
          deger={sira ? SIRA_ADI[sira.tur] : "—"}
          alt={sira ? (sira.donulen > 0 ? `${sira.donulen} soruya döndün` : "hiç geri dönmedin") : "bu testte ölçülmedi"}
        />
        <Olcu
          etiket="İlk yarı · son yarı"
          deger={a.yarilar ? `${a.yarilar.ilk} · ${a.yarilar.son}` : "—"}
          alt="işaretlenen soru"
          uyari={a.yarilar ? a.yarilar.ilk * 2 < a.yarilar.son : false}
        />
        <Olcu
          etiket={`Son ${SON_DAKIKA_PENCERESI} dakika`}
          deger={a.sonDakika ? `${a.sonDakika.sayi} soru` : "—"}
          alt={a.sonDakika ? (a.sonDakika.yanlis > 0 ? `${a.sonDakika.yanlis} yanlış` : "işaretlendi") : "kısa testte yok"}
        />
      </div>

      <ul className="space-y-2.5 border-t border-gray-100 px-5 py-4 sm:px-6">
        {a.tavsiyeler.map((t) => (
          <li key={t.metin} className="flex gap-2.5 text-theme-sm leading-relaxed text-gray-700">
            {t.ton === "ok" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden />
            ) : (
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning-600" aria-hidden />
            )}
            <span className="min-w-0">{t.metin}</span>
          </li>
        ))}
      </ul>

      {a.takilinanlar.length > 0 || a.uzunBoslar.length > 0 ? (
        <div className="space-y-3 border-t border-gray-100 px-5 py-4 sm:px-6">
          {a.takilinanlar.length > 0 ? (
            <SoruSeridi
              baslik="Takıldığın sorular (hedefin 2 katından uzun)"
              sorular={a.takilinanlar.map((t) => ({ sira: t.sira, ms: t.sureMs }))}
            />
          ) : null}
          {a.uzunBoslar.length > 0 ? (
            <SoruSeridi
              baslik="Uzun süre harcayıp boş bıraktıkların"
              sorular={a.uzunBoslar.map((t) => ({ sira: t.sira, ms: t.sureMs }))}
            />
          ) : null}
        </div>
      ) : null}
    </ComponentCard>
  );
}

function SoruSeridi({ baslik, sorular }: { baslik: string; sorular: { sira: number; ms: number }[] }) {
  return (
    <div>
      <p className="text-theme-xs font-semibold text-gray-500">{baslik}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {sorular.map((s) => (
          <li key={s.sira}>
            <a
              href={`#soru-${s.sira}`}
              className="tabular inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-2.5 text-theme-xs font-medium text-gray-700 ring-1 ring-gray-200 ring-inset transition hover:bg-gray-50"
            >
              <span className="font-display font-semibold text-gray-800">{s.sira + 1}.</span>
              {sureMetni(s.ms)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
