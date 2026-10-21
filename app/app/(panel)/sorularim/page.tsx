import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, EyeOff, MessageCircleQuestion, MessageCircleReply } from "lucide-react";
import { requirePageUser } from "@/lib/auth";
import { kocaSoruHakki, kocaSorulari } from "@/lib/koca-soru";
import {
  ACIK_KOCA_SORU_SINIRI,
  GUNLUK_KOCA_SORU_SINIRI,
  KOCA_SORU_DURUM_ETIKETI,
  type KocaSoruDurumu,
} from "@/lib/bildirim-kurallari";
import { MathContent } from "@/components/MathContent";
import { KocaSorFormu } from "@/components/KocaSor";
import { trDate } from "@/components/ui";
import { Badge, type BadgeColor } from "@/components/tailadmin/ui/Badge";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { OkunduIsaretle } from "./OkunduIsaretle";

export const metadata: Metadata = { title: "Koça sorularım" };

const DURUM_RENGI: Record<KocaSoruDurumu, BadgeColor> = {
  BEKLIYOR: "warning",
  CEVAPLANDI: "success",
  KAPATILDI: "light",
};

/**
 * Koça sorularım: öğrencinin sorduğu sorular ve koçun cevapları, en yeni
 * önce. Soru bağlamı varsa soru gövdesi sunucuda çizilir (KaTeX istemciye
 * gitmez). Koçun cevabı düz metin, satır sonları korunur.
 *
 * Görülen cevaplar sayfa tarayıcıda açılınca okundu sayılır (OkunduIsaretle).
 */
export default async function SorularimPage() {
  const user = await requirePageUser();
  const now = new Date();

  const [sorular, hak] = await Promise.all([kocaSorulari(user.id), kocaSoruHakki(user.id, now)]);
  const yeniIdler = sorular.filter((s) => s.yeni).map((s) => s.id);

  return (
    <div className="mx-auto w-full max-w-3xl animate-rise">
      <PageBreadcrumb
        pageTitle="Koça sorularım"
        description="Takıldığın bir soru ya da çalışma düzenin hakkında koçuna yaz; cevabı burada görürsün."
      />
      <OkunduIsaretle ids={yeniIdler} />

      <div className="space-y-4 md:space-y-6">
        <ComponentCard
          icon={<MessageCircleQuestion aria-hidden />}
          title="Yeni soru"
          desc={`Aynı anda en fazla ${ACIK_KOCA_SORU_SINIRI} cevap bekleyen soru, günde en fazla ${GUNLUK_KOCA_SORU_SINIRI}. Bir sorunun üstünden sormak için sonuç ekranındaki "Koça sor"u kullan.`}
        >
          <KocaSorFormu kapali={hak.kapali} />
        </ComponentCard>

        {sorular.length === 0 ? (
          <Card>
            <EmptyState
              icon={<MessageCircleReply />}
              title="Henüz bir şey sormadın"
              description="Sonuç ekranında ya da alıştırmada her sorunun altında “Koça sor” var. Genel bir sorun varsa yukarıdan yazabilirsin."
            />
          </Card>
        ) : (
          <section aria-labelledby="sorular-baslik" className="space-y-3">
            <h2 id="sorular-baslik" className="text-theme-xs font-semibold tracking-[0.14em] text-gray-500 uppercase">
              Sorduğun sorular
            </h2>
            <ul className="space-y-3">
              {sorular.map((s) => (
                <li key={s.id}>
                  <Card tone={s.yeni ? "brand" : "default"} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge size="sm" color={DURUM_RENGI[s.durum]}>
                        {KOCA_SORU_DURUM_ETIKETI[s.durum]}
                      </Badge>
                      {s.yeni ? (
                        <Badge size="sm" variant="solid" color="primary">
                          Yeni cevap
                        </Badge>
                      ) : null}
                      <span className="text-theme-xs text-gray-500">{trDate(s.createdAt)}</span>
                      {s.sonucId ? (
                        <Link
                          href={`/sonuc/${s.sonucId}`}
                          className="ms-auto inline-flex min-h-9 items-center gap-1 text-theme-sm font-medium text-brand-500 transition hover:text-brand-600"
                        >
                          Testte gör <ArrowUpRight className="size-3.5" aria-hidden />
                        </Link>
                      ) : null}
                    </div>

                    {s.gizli ? (
                      <p className="mt-3 flex items-start gap-2 rounded-xl bg-gray-50 px-3.5 py-3 text-theme-sm text-gray-600">
                        <EyeOff className="mt-0.5 size-4 shrink-0 text-gray-400" aria-hidden />
                        Bu soru şu an açık bir testinde de var. Soru ve koçun cevabı test bitince burada görünür.
                      </p>
                    ) : s.soru ? (
                      <details className="group mt-3 rounded-xl border border-gray-200">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 py-2 text-theme-sm text-gray-600 transition hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                          <span className="font-medium text-gray-700">Soru</span>
                          <span className="min-w-0 flex-1 truncate">· {s.soru.konu}</span>
                          <span className="text-theme-xs text-brand-500 group-open:hidden">Göster</span>
                          <span className="hidden text-theme-xs text-brand-500 group-open:inline">Gizle</span>
                        </summary>
                        <div className="border-t border-gray-100 px-3.5 py-3 text-read leading-relaxed text-gray-800">
                          <MathContent content={s.soru.stem} />
                        </div>
                      </details>
                    ) : null}

                    <div className="mt-3">
                      <p className="text-theme-xs font-semibold text-gray-500">Senin sorun</p>
                      <p className="mt-1 text-body leading-relaxed break-words whitespace-pre-wrap text-gray-800">
                        {s.body}
                      </p>
                    </div>

                    {s.answerBody ? (
                      <div className="mt-3 rounded-xl border border-brand-100 bg-brand-25 px-3.5 py-3">
                        <p className="text-theme-xs font-semibold text-brand-500">
                          Koçunun cevabı{s.answeredAt ? ` · ${trDate(s.answeredAt)}` : ""}
                        </p>
                        <p className="mt-1 text-body leading-relaxed break-words whitespace-pre-wrap text-gray-800">
                          {s.answerBody}
                        </p>
                      </div>
                    ) : s.durum === "KAPATILDI" ? (
                      <p className="mt-3 text-theme-sm text-gray-500">
                        Koçun bu soruyu cevapsız kapattı (yinelenen ya da konu dışı). Gerekirse yeniden sorabilirsin.
                      </p>
                    ) : s.durum === "BEKLIYOR" ? (
                      <p className="mt-3 text-theme-sm text-gray-500">Koçun cevabı bekleniyor.</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
