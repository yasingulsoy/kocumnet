import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowRight, CheckCheck, Mail, MailOpen, MessageSquareText, Reply, ShieldBan, StickyNote, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { MessageNoteForm } from "@/components/admin/MessageNoteForm";
import { Forbidden, MESAJ_RENGI, relative, trDate } from "@/components/admin/ui";
import { Avatar } from "@/components/tailadmin/ui/Avatar";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ButtonLink, buttonClass } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { deleteMessageAction, setMessageStatusAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getMessage, listReplyTemplates } from "@/lib/admin/data";
import { yanitBaglantisi } from "@/lib/admin/reply";
import { LOCALE_LABEL, MANAGE_ROLES, MESSAGE_STATUS_LABEL, isContentLocale, personName } from "@/lib/admin/types";
import { MarkRead } from "./MarkRead";

export const metadata: Metadata = { title: "Mesaj" };

const KAYNAK: Record<string, string> = { contact: "İletişim sayfası", hero: "Ana sayfa formu" };
const DIL: Record<string, string> = { tr: "Türkçe", en: "İngilizce", ar: "Arapça" };

export default async function MesajPage({ params }: PageProps<"/admin/mesajlar/[id]">) {
  const { id } = await params;
  const { staff, allowed } = await requireStaff(MANAGE_ROLES, `/admin/mesajlar/${encodeURIComponent(id)}`);
  if (!allowed) return <Forbidden roles="Yönetici, Müdür" />;

  const sayi = Number(id);
  if (!Number.isInteger(sayi) || sayi <= 0) notFound();

  let detay;
  try {
    detay = await getMessage(sayi);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }
  const { data: m, related, next_waiting: sonraki } = detay;
  // Hazır yanıtlar: gönderenin dilindekiler önce. Alınamazsa kart boş kalır, sayfa düşmez.
  const sablonlar = await listReplyTemplates().catch(() => []);
  const ayniDil = sablonlar.filter((s) => s.locale === m.locale);
  const digerDiller = sablonlar.filter((s) => s.locale !== m.locale);
  const mesajDili = isContentLocale(m.locale) ? LOCALE_LABEL[m.locale] : m.locale;

  const yanitla = yanitBaglantisi(m, staff.name);
  const ilgilenen = personName(m.handler);
  const yanitlayan = personName(m.answerer);
  const bekliyor = m.status === "new" || m.status === "read";

  return (
    <>
      <MarkRead id={m.id} status={m.status} />

      <PageBreadcrumb
        pageTitle={m.subject ?? "Konu yok"}
        currentLabel={m.name}
        crumbs={[{ href: "/admin/mesajlar", label: "Mesajlar" }]}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge size="sm" color={MESAJ_RENGI[m.status]}>
              {MESSAGE_STATUS_LABEL[m.status]}
            </Badge>
            <span>
              <time dateTime={m.created_at}>{trDate(m.created_at, { time: true })}</time> · {KAYNAK[m.source] ?? m.source} ·{" "}
              {DIL[m.locale] ?? m.locale}
            </span>
          </span>
        }
        actions={
          <>
            <a href={yanitla} className={buttonClass({ size: "xs" })}>
              <Reply aria-hidden /> E-postayla yanıtla
            </a>
            {m.status !== "answered" ? (
              <ActionButton action={setMessageStatusAction.bind(null, m.id, "answered")} icon={<CheckCheck aria-hidden />}>
                Yanıtlandı
              </ActionButton>
            ) : null}
            {sonraki ? (
              <ButtonLink
                href={`/admin/mesajlar/${sonraki.id}`}
                variant="ghost"
                size="xs"
                title={`Sıradaki bekleyen: ${sonraki.name}`}
                endIcon={<ArrowRight className="rtl:rotate-180" aria-hidden />}
              >
                Sıradaki
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {m.answered_at ? (
        <p className="-mt-3 mb-5 flex items-center gap-1.5 text-theme-sm text-success-700">
          <CheckCheck className="size-4" aria-hidden />
          {yanitlayan ?? "Bir personel"} {trDate(m.answered_at, { time: true })} yanıtlandı olarak işaretledi.
        </p>
      ) : bekliyor ? (
        <p className="-mt-3 mb-5 text-theme-sm text-gray-600">
          Yanıtı e-postayla gönderdikten sonra <strong className="font-semibold text-gray-800">Yanıtlandı</strong> düğmesine bas:
          ekipte başka biri aynı kişiye ikinci kez dönmesin.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={m.name} size="large" decorative />
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-800">{m.name}</p>
                <p className="truncate text-theme-xs text-gray-500">{m.email}</p>
              </div>
            </div>
            <p className="text-base leading-relaxed break-words whitespace-pre-wrap text-gray-800" dir="auto">
              {m.message}
            </p>
          </section>

          <ComponentCard
            title="Hazır yanıtlar"
            icon={<MessageSquareText />}
            desc={`Seçince posta programın açılır; metin ${mesajDili} ve gönderenin adıyla dolu gelir, mesajın alıntısı altta.`}
            actions={
              <Link href="/admin/mesajlar/sablonlar" className="text-theme-sm font-medium text-brand-500 hover:text-brand-600">
                Şablonları düzenle
              </Link>
            }
          >
            {ayniDil.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {ayniDil.map((s) => (
                  <li key={s.id}>
                    <a
                      href={yanitBaglantisi(m, staff.name, s.body)}
                      className="block h-full rounded-xl border border-gray-200 px-4 py-3 transition hover:border-brand-300 hover:bg-brand-25"
                    >
                      <span className="block text-theme-sm font-semibold text-brand-500">{s.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-theme-xs text-gray-500" dir="auto">
                        {s.body}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-theme-sm text-gray-500">
                {mesajDili} şablon yok.{" "}
                <Link href="/admin/mesajlar/sablonlar" className="font-medium text-brand-500 hover:text-brand-600">
                  Ekle
                </Link>
                {digerDiller.length ? " ya da aşağıdan başka dilde birini seç." : "."}
              </p>
            )}
            {digerDiller.length ? (
              <details>
                <summary className="cursor-pointer text-theme-sm font-medium text-gray-600 hover:text-gray-800">
                  Diğer diller ({digerDiller.length})
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {digerDiller.map((s) => (
                    <li key={s.id}>
                      <a href={yanitBaglantisi(m, staff.name, s.body)} className="text-theme-sm text-brand-500 hover:text-brand-600">
                        {s.title}
                      </a>{" "}
                      <span className="text-theme-xs text-gray-500">· {isContentLocale(s.locale) ? LOCALE_LABEL[s.locale] : s.locale}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </ComponentCard>

          <ComponentCard title="Ekip notu" icon={<StickyNote />} desc="Yalnızca personel görür: arama, randevu, kime yönlendirildiği…">
            <MessageNoteForm id={m.id} note={m.note ?? null} />
          </ComponentCard>
        </div>

        <div className="space-y-6">
          <ComponentCard title="Gönderen">
            <dl className="space-y-3 text-theme-sm">
              <div>
                <dt className="text-theme-xs text-gray-500">Ad</dt>
                <dd className="font-medium text-gray-800">{m.name}</dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500">E-posta</dt>
                <dd className="break-all">
                  <a href={yanitla} className="font-medium text-brand-500 hover:text-brand-600">
                    {m.email}
                  </a>
                </dd>
              </div>
              {m.phone ? (
                <div>
                  <dt className="text-theme-xs text-gray-500">Telefon</dt>
                  <dd>
                    <a href={`tel:${m.phone.replace(/\s+/g, "")}`} className="font-medium text-brand-500 hover:text-brand-600">
                      {m.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </ComponentCard>

          <ComponentCard title="Durum" desc={ilgilenen && m.handled_at ? `Son işlem: ${ilgilenen} · ${relative(m.handled_at)}` : undefined}>
            <div className="flex flex-wrap gap-2">
              {m.status === "new" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "read")} icon={<MailOpen aria-hidden />}>
                  Okundu
                </ActionButton>
              ) : (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "new")} icon={<Mail aria-hidden />}>
                  Okunmadı yap
                </ActionButton>
              )}
              {m.status !== "archived" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "archived")} icon={<Archive aria-hidden />}>
                  Arşivle
                </ActionButton>
              ) : null}
              {m.status !== "spam" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "spam")} variant="ghost" icon={<ShieldBan aria-hidden />}>
                  Spam
                </ActionButton>
              ) : null}
            </div>
            {staff.role === "admin" ? (
              <div className="border-t border-gray-100 pt-5">
                <ActionButton
                  action={deleteMessageAction.bind(null, m.id)}
                  variant="danger-outline"
                  icon={<Trash2 aria-hidden />}
                  confirm={{
                    title: "Mesaj kalıcı olarak silinsin mi?",
                    description: "KVKK gereği talep üzerine silinmesi gerekebilir; başka durumda arşivlemek yeterli.",
                    confirmLabel: "Kalıcı sil",
                    tone: "danger",
                  }}
                >
                  Kalıcı sil
                </ActionButton>
              </div>
            ) : null}
          </ComponentCard>

          {related.length ? (
            <ComponentCard title="Aynı adresten" desc="Bu kişinin önceki mesajları.">
              <ul className="space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/mesajlar/${r.id}`} className="group flex items-center justify-between gap-2 text-theme-sm">
                      <span className="min-w-0 truncate font-medium text-gray-800 group-hover:text-brand-500">{r.subject ?? "Konu yok"}</span>
                      <span className="shrink-0 text-theme-xs text-gray-500">{trDate(r.created_at)}</span>
                    </Link>
                    <Badge size="sm" color={MESAJ_RENGI[r.status]} className="mt-1">
                      {MESSAGE_STATUS_LABEL[r.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </ComponentCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
