import type { Metadata } from "next";
import { ChevronDown, MessageSquareText, Sparkles, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { TemplateForm } from "@/components/admin/TemplateForm";
import { Forbidden } from "@/components/admin/ui";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Card, ComponentCard } from "@/components/tailadmin/ui/Card";
import { EmptyState } from "@/components/tailadmin/ui/EmptyState";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
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
      <PageBreadcrumb
        pageTitle="Hazır yanıtlar"
        crumbs={[{ href: "/admin/mesajlar", label: "Mesajlar" }]}
        description="Sık yazılan yanıtlar. Mesaj ekranında gönderenin dilindekiler önerilir; posta programın metin dolu açılır."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-6">
          {sablonlar.length === 0 ? (
            <Card>
              <EmptyState
                icon={<MessageSquareText />}
                title="Henüz şablon yok"
                description="Sağdan ilk şablonunu yaz ya da üç dilde genel örneklerle başla; sonra istediğin gibi değiştirirsin."
                action={
                  <ActionButton action={addSampleTemplatesAction} variant="soft" icon={<Sparkles aria-hidden />}>
                    Örnek şablonları ekle
                  </ActionButton>
                }
              />
            </Card>
          ) : (
            CONTENT_LOCALES.filter((d) => sablonlar.some((s) => s.locale === d)).map((dil) => (
              <section key={dil} aria-labelledby={`dil-${dil}`}>
                <h2 id={`dil-${dil}`} className="mb-3 text-theme-xs font-medium tracking-wide text-gray-500 uppercase">
                  {LOCALE_LABEL[dil]}
                </h2>
                <div className="space-y-3">
                  {sablonlar
                    .filter((s) => s.locale === dil)
                    .map((s) => (
                      <Card key={s.id}>
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                            <span className="min-w-0">
                              <span className="block font-display text-base font-semibold text-gray-800">{s.title}</span>
                              <span className="mt-0.5 line-clamp-2 text-theme-sm whitespace-pre-line text-gray-500" dir="auto">
                                {s.body}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <Badge size="sm" color="light">
                                {s.locale.toUpperCase()}
                              </Badge>
                              <span className="text-theme-sm font-medium text-brand-500 group-open:hidden">Düzenle</span>
                              <span className="hidden text-theme-sm font-medium text-gray-500 group-open:inline">Kapat</span>
                              <ChevronDown className="size-4 text-gray-500 transition-transform group-open:rotate-180" aria-hidden />
                            </span>
                          </summary>
                          <div className="border-t border-gray-100 px-5 py-5 sm:px-6">
                            <TemplateForm sablon={s} />
                            <div className="mt-5 border-t border-gray-100 pt-5">
                              <ActionButton
                                action={deleteReplyTemplateAction.bind(null, s.id)}
                                variant="danger-outline"
                                icon={<Trash2 aria-hidden />}
                                confirm={{ title: `“${s.title}” şablonu silinsin mi?`, confirmLabel: "Şablonu sil", tone: "danger" }}
                              >
                                Şablonu sil
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

        <div className="space-y-6">
          <ComponentCard title="Yeni şablon">
            <TemplateForm />
          </ComponentCard>
          <ComponentCard title="Yer tutucular" desc="Mesaj ekranında kendiliğinden doldurulur:">
            <dl className="space-y-2 text-theme-sm">
              {TEMPLATE_PLACEHOLDERS.map((p) => (
                <div key={p.kod} className="flex gap-2">
                  <dt className="font-mono text-gray-800">{p.kod}</dt>
                  <dd className="text-gray-500">{p.aciklama}</dd>
                </div>
              ))}
            </dl>
            <p className="text-theme-xs text-gray-500">
              Mesajın alıntısı şablonun altına eklenir. Fiyat ya da paket gibi değişebilecek bilgileri yazarken güncel olduğundan emin ol.
            </p>
          </ComponentCard>
        </div>
      </div>
    </>
  );
}
