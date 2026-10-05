import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowRight, CheckCheck, Mail, MailOpen, MessageSquareText, Reply, ShieldBan, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { MessageNoteForm } from "@/components/admin/MessageNoteForm";
import { Card, Forbidden, PageHeader, Pill, buttonClass, relative, trDate } from "@/components/admin/ui";
import { deleteMessageAction, setMessageStatusAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getMessage, listReplyTemplates } from "@/lib/admin/data";
import { yanitBaglantisi } from "@/lib/admin/reply";
import { LOCALE_LABEL, MANAGE_ROLES, MESSAGE_STATUS_LABEL, isContentLocale, personName, type MessageStatus } from "@/lib/admin/types";
import { MarkRead } from "./MarkRead";

export const metadata: Metadata = { title: "Mesaj" };

const KAYNAK: Record<string, string> = { contact: "İletişim sayfası", hero: "Ana sayfa formu" };
const DIL: Record<string, string> = { tr: "Türkçe", en: "İngilizce", ar: "Arapça" };
const TON: Record<MessageStatus, "brand" | "neutral" | "ok" | "bad"> = {
  new: "brand",
  read: "neutral",
  answered: "ok",
  archived: "neutral",
  spam: "bad",
};

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

      <PageHeader
        title={m.subject ?? "Konu yok"}
        crumbs={[{ href: "/admin/mesajlar", label: "Mesajlar" }]}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-faint">
            <Pill tone={TON[m.status]}>{MESSAGE_STATUS_LABEL[m.status]}</Pill>
            <time dateTime={m.created_at}>{trDate(m.created_at, { time: true })}</time> · {KAYNAK[m.source] ?? m.source} · {DIL[m.locale] ?? m.locale}
          </span>
        }
        actions={
          <>
            <a href={yanitla} className={buttonClass({ size: "sm" })}>
              <Reply /> E-postayla yanıtla
            </a>
            {m.status !== "answered" ? (
              <ActionButton action={setMessageStatusAction.bind(null, m.id, "answered")} variant="secondary" size="sm">
                <CheckCheck /> Yanıtlandı
              </ActionButton>
            ) : null}
            {sonraki ? (
              <Link href={`/admin/mesajlar/${sonraki.id}`} className={buttonClass({ variant: "ghost", size: "sm" })} title={`Sıradaki bekleyen: ${sonraki.name}`}>
                Sıradaki <ArrowRight />
              </Link>
            ) : null}
          </>
        }
      />

      {m.answered_at ? (
        <p className="-mt-3 mb-5 flex items-center gap-1.5 text-caption text-ok">
          <CheckCheck className="size-4" aria-hidden />
          {yanitlayan ?? "Bir personel"} {trDate(m.answered_at, { time: true })} yanıtlandı olarak işaretledi.
        </p>
      ) : bekliyor ? (
        <p className="-mt-3 mb-5 text-caption text-ink-soft">
          Yanıtı e-postayla gönderdikten sonra <strong className="font-semibold text-ink">Yanıtlandı</strong> düğmesine bas:
          ekipte başka biri aynı kişiye ikinci kez dönmesin.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5 sm:p-6">
            <p className="whitespace-pre-wrap break-words text-body leading-relaxed text-ink" dir="auto">
              {m.message}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-body font-semibold text-ink">
                <MessageSquareText className="size-4 text-ink-faint" aria-hidden /> Hazır yanıtlar
              </h2>
              <Link href="/admin/mesajlar/sablonlar" className="text-caption font-medium text-brand hover:underline">
                Şablonları düzenle
              </Link>
            </div>
            <p className="mt-0.5 text-caption text-ink-soft">
              Seçince posta programın açılır; metin {mesajDili} ve gönderenin adıyla dolu gelir, mesajın alıntısı altta.
            </p>
            {ayniDil.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {ayniDil.map((s) => (
                  <li key={s.id}>
                    <a
                      href={yanitBaglantisi(m, staff.name, s.body)}
                      className="block h-full rounded-xl border border-line px-3.5 py-2.5 transition hover:border-brand/40 hover:bg-brand-wash"
                    >
                      <span className="block text-caption font-semibold text-brand">{s.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-micro text-ink-faint" dir="auto">{s.body}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-caption text-ink-faint">
                {mesajDili} şablon yok.{" "}
                <Link href="/admin/mesajlar/sablonlar" className="font-medium text-brand hover:underline">Ekle</Link>
                {digerDiller.length ? " ya da aşağıdan başka dilde birini seç." : "."}
              </p>
            )}
            {digerDiller.length ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-caption font-medium text-ink-soft hover:text-ink">
                  Diğer diller ({digerDiller.length})
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {digerDiller.map((s) => (
                    <li key={s.id}>
                      <a href={yanitBaglantisi(m, staff.name, s.body)} className="text-caption text-brand hover:underline">
                        {s.title}
                      </a>{" "}
                      <span className="text-micro text-ink-faint">· {isContentLocale(s.locale) ? LOCALE_LABEL[s.locale] : s.locale}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">Ekip notu</h2>
            <p className="mt-0.5 text-caption text-ink-soft">Yalnızca personel görür: arama, randevu, kime yönlendirildiği…</p>
            <div className="mt-3">
              <MessageNoteForm id={m.id} note={m.note ?? null} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">Gönderen</h2>
            <dl className="mt-3 space-y-2 text-caption">
              <div>
                <dt className="text-micro uppercase tracking-wider text-ink-faint">Ad</dt>
                <dd className="font-medium text-ink">{m.name}</dd>
              </div>
              <div>
                <dt className="text-micro uppercase tracking-wider text-ink-faint">E-posta</dt>
                <dd className="break-all">
                  <a href={yanitla} className="font-medium text-brand hover:underline">{m.email}</a>
                </dd>
              </div>
              {m.phone ? (
                <div>
                  <dt className="text-micro uppercase tracking-wider text-ink-faint">Telefon</dt>
                  <dd><a href={`tel:${m.phone.replace(/\s+/g, "")}`} className="font-medium text-brand hover:underline">{m.phone}</a></dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-body font-semibold text-ink">Durum</h2>
            {ilgilenen && m.handled_at ? (
              <p className="mt-1 text-micro text-ink-faint">Son işlem: {ilgilenen} · {relative(m.handled_at)}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {m.status === "new" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "read")} variant="secondary" size="sm"><MailOpen /> Okundu</ActionButton>
              ) : (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "new")} variant="secondary" size="sm"><Mail /> Okunmadı yap</ActionButton>
              )}
              {m.status !== "archived" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "archived")} variant="secondary" size="sm"><Archive /> Arşivle</ActionButton>
              ) : null}
              {m.status !== "spam" ? (
                <ActionButton action={setMessageStatusAction.bind(null, m.id, "spam")} variant="ghost" size="sm" className="text-warn hover:bg-warn-wash"><ShieldBan /> Spam</ActionButton>
              ) : null}
            </div>
            {staff.role === "admin" ? (
              <div className="mt-4 border-t border-line pt-4">
                <ActionButton action={deleteMessageAction.bind(null, m.id)} variant="secondary" size="sm" className="text-bad ring-bad/30 hover:bg-bad-wash" confirm="Mesaj kalıcı olarak silinsin mi? KVKK gereği talep üzerine silinmesi gerekebilir; başka durumda arşivlemek yeterli.">
                  <Trash2 /> Kalıcı sil
                </ActionButton>
              </div>
            ) : null}
          </Card>

          {related.length ? (
            <Card className="p-5">
              <h2 className="font-display text-body font-semibold text-ink">Aynı adresten</h2>
              <p className="mt-0.5 text-micro text-ink-faint">Bu kişinin önceki mesajları.</p>
              <ul className="mt-3 space-y-3">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/mesajlar/${r.id}`} className="group flex items-center justify-between gap-2 text-caption">
                      <span className="min-w-0 truncate font-medium text-ink group-hover:text-brand">{r.subject ?? "Konu yok"}</span>
                      <span className="shrink-0 text-micro text-ink-faint">{trDate(r.created_at)}</span>
                    </Link>
                    <Pill tone={TON[r.status]} className="mt-1">{MESSAGE_STATUS_LABEL[r.status]}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
