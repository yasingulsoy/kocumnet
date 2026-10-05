import type { Metadata } from "next";
import { Sparkles, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { TemplateForm } from "@/components/admin/TemplateForm";
import { Card, EmptyState, Forbidden, PageHeader, Pill } from "@/components/admin/ui";
import { addSampleTemplatesAction, deleteReplyTemplateAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { listReplyTemplates } from "@/lib/admin/data";
import { CONTENT_LOCALES, LOCALE_LABEL, MANAGE_ROLES, TEMPLATE_PLACEHOLDERS } from "@/lib/admin/types";

export const metadata: Metadata = { title: "Hazır yanıtlar" };

/**
 * Hazır yanıt şablonları — mesajları yanıtlayan ekip (yönetici, müdür)
 * kendi metinlerini yazar. Mesaj ekranında gönderenin dilindekiler önerilir;
 * seçilen şablon posta programında, gönderenin adıyla dolu açılır.
 */
export default async function SablonlarPage() {
  const { allowed } = await requireStaff(MANAGE_ROLES, "/admin/mesajlar/sablonlar");
  if (!allowed) return <Forbidden roles="Yönetici, Müdür" />;

  const sablonlar = await listReplyTemplates();

  return (
    <>
      <PageHeader
        title="Hazır yanıtlar"
        crumbs={[{ href: "/admin/mesajlar", label: "Mesajlar" }]}
        description="Sık yazılan yanıtlar. Mesaj ekranında gönderenin dilindekiler önerilir; posta programın metin dolu açılır."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {sablonlar.length === 0 ? (
            <Card>
              <EmptyState
                title="Henüz şablon yok"
                description="Sağdan ilk şablonunu yaz ya da üç dilde genel örneklerle başla; sonra istediğin gibi değiştirirsin."
                action={
                  <ActionButton action={addSampleTemplatesAction} variant="soft" size="sm">
                    <Sparkles /> Örnek şablonları ekle
                  </ActionButton>
                }
              />
            </Card>
          ) : (
            CONTENT_LOCALES.filter((d) => sablonlar.some((s) => s.locale === d)).map((dil) => (
              <section key={dil} aria-labelledby={`dil-${dil}`}>
                <h2 id={`dil-${dil}`} className="mb-2 text-micro font-semibold uppercase tracking-wider text-ink-faint">
                  {LOCALE_LABEL[dil]}
                </h2>
                <div className="space-y-3">
                  {sablonlar
                    .filter((s) => s.locale === dil)
                    .map((s) => (
                      <Card key={s.id}>
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                            <span className="min-w-0">
                              <span className="block font-display text-body font-semibold text-ink">{s.title}</span>
                              <span className="mt-0.5 line-clamp-2 block whitespace-pre-line text-caption text-ink-soft" dir="auto">
                                {s.body}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <Pill>{s.locale.toUpperCase()}</Pill>
                              <span className="text-caption font-medium text-brand group-open:hidden">Düzenle</span>
                              <span className="hidden text-caption font-medium text-ink-faint group-open:inline">Kapat</span>
                            </span>
                          </summary>
                          <div className="border-t border-line px-5 py-4">
                            <TemplateForm sablon={s} />
                            <div className="mt-4 border-t border-line pt-4">
                              <ActionButton
                                action={deleteReplyTemplateAction.bind(null, s.id)}
                                variant="ghost"
                                size="sm"
                                className="text-bad hover:bg-bad-wash"
                                confirm={`“${s.title}” şablonu silinsin mi?`}
                              >
                                <Trash2 /> Şablonu sil
                              </ActionButton>
                            </div>
                          </div>
                        </details>
                      </Card>
                    ))}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="space-y-5">
          <Card className="self-start p-5">
            <h2 className="font-display text-body font-semibold text-ink">Yeni şablon</h2>
            <div className="mt-4">
              <TemplateForm />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">Yer tutucular</h2>
            <p className="mt-1 text-caption text-ink-soft">Mesaj ekranında kendiliğinden doldurulur:</p>
            <dl className="mt-3 space-y-1.5 text-caption">
              {TEMPLATE_PLACEHOLDERS.map((p) => (
                <div key={p.kod} className="flex gap-2">
                  <dt className="font-mono text-ink">{p.kod}</dt>
                  <dd className="text-ink-soft">{p.aciklama}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-micro text-ink-faint">
              Mesajın alıntısı şablonun altına eklenir. Fiyat ya da paket gibi değişebilecek bilgileri yazarken güncel olduğundan emin ol.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
