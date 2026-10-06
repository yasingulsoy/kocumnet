import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, History, Layers, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { BlogForm } from "@/components/admin/BlogForm";
import { Card, Notice, PageHeader, Pill, relative, trDate } from "@/components/admin/ui";
import { deleteBlogAction, restoreRevisionAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getBlog, listAudit, listRevisions } from "@/lib/admin/data";
import { CONTENT_ROLES, personName, type BlogRevisionSummary } from "@/lib/admin/types";
import { authorName } from "@/lib/blog";

export const metadata: Metadata = { title: "Yazıyı düzenle" };

const KAYIT_BILDIRIMI: Record<string, { tone: "ok" | "info"; text: string }> = {
  "1": { tone: "ok", text: "Kaydedildi." },
  yayinlandi: { tone: "ok", text: "Yazı yayınlandı. Sitede birkaç saniye içinde görünür." },
  taslak: { tone: "info", text: "Yazı taslağa alındı; artık sitede görünmüyor." },
  geri: { tone: "ok", text: "Yazı seçilen sürüme döndü. Yayındaysa sitede de bu hâli görünür; istersen yine sürümlerden geri alabilirsin." },
};

/** Sürüm satırı: zaman, kaydeden; başlık şimdikinden farklıysa o başlık. */
function SurumSatiri({
  s,
  guncel,
  baslik,
  blogId,
  geriAlabilir,
  acilanSurum,
}: {
  s: BlogRevisionSummary;
  guncel: boolean;
  baslik: string;
  blogId: number;
  geriAlabilir: boolean;
  /** Sayfa açıldığında yazının updated_at'i: arada değiştiyse dönüş 409 alır. */
  acilanSurum: string | null;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-caption text-ink">
          <span className="font-medium">{guncel ? "Şu anki sürüm" : relative(s.created_at)}</span>
          <span className="text-ink-faint"> · {personName(s.author) ?? "Silinmiş hesap"}</span>
        </p>
        <p className="mt-0.5 truncate text-micro text-ink-faint">
          <time dateTime={s.created_at}>{trDate(s.created_at, { time: true })}</time>
          {s.title !== baslik ? <> · başlık: “{s.title}”</> : null}
        </p>
      </div>
      <Link
        href={`/admin/blog/${blogId}/onizleme?surum=${s.id}`}
        target="_blank"
        className="inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline"
      >
        <Eye className="size-3.5" aria-hidden /> Önizle
      </Link>
      {!guncel && geriAlabilir ? (
        <ActionButton
          action={restoreRevisionAction.bind(null, blogId, s.id, acilanSurum)}
          variant="ghost"
          size="sm"
          confirm="Yazı bu sürüme dönsün mü? Başlık, içerik, özet, meta alanları ve etiketler değişir; adres ve yayın durumu aynı kalır. Editörde kaydedilmemiş değişiklik varsa kaybolur."
        >
          Bu sürüme dön
        </ActionButton>
      ) : null}
    </li>
  );
}

export default async function BlogDuzenlePage({ params, searchParams }: PageProps<"/admin/blog/[id]">) {
  const { id } = await params;
  const { staff } = await requireStaff(undefined, `/admin/blog/${encodeURIComponent(id)}`);
  const yazar = CONTENT_ROLES.includes(staff.role);

  const sp = await searchParams;
  const sayi = Number(id);
  if (!Number.isInteger(sayi) || sayi <= 0) notFound();

  let blog;
  try {
    blog = await getBlog(sayi);
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }
  // Yazının geçmişi (kim, ne zaman) ve sürümleri: alınamazsa kartlar gösterilmez.
  const [gecmis, surumler] = await Promise.all([
    listAudit({ target: { type: "blog", id: blog.id }, limit: 8 }).catch(() => null),
    listRevisions(blog.id).catch(() => null),
  ]);

  const kayit = typeof sp.kaydedildi === "string" ? KAYIT_BILDIRIMI[sp.kaydedildi] : undefined;

  return (
    <>
      <PageHeader
        title={blog.title}
        crumbs={[{ href: "/admin/blog", label: "Blog" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={blog.is_published ? "ok" : "warn"}>{blog.is_published ? "Yayında" : "Taslak"}</Pill>
            <span className="text-caption text-ink-faint">
              {authorName(blog) ?? "—"} · oluşturuldu {trDate(blog.created_at)} · güncellendi {trDate(blog.updated_at, { time: true })} · {blog.view_count ?? 0} görüntülenme
            </span>
          </span>
        }
      />

      {kayit ? <Notice tone={kayit.tone} className="mb-4">{kayit.text}</Notice> : null}
      {sp.hata === "kapak" ? (
        <Notice tone="warn" className="mb-4" title="Yazı kaydedildi, kapak yüklenemedi">
          Görsel JPEG, PNG veya WebP olmalı ve 10 MB&apos;ı aşmamalı. Aşağıdan yeniden dene.
        </Notice>
      ) : null}

      {/* Her başarılı kayıttan sonra form sunucudaki yeni değerlerle, "kaydedilmedi" izi temiz başlar. */}
      <BlogForm
        key={`${blog.updated_at ?? blog.id}:${typeof sp.k === "string" ? sp.k : ""}`}
        blog={blog}
        readOnly={!yazar}
        kaydedildi={Boolean(kayit) || sp.hata === "kapak"}
      />

      {surumler && surumler.length ? (
        <Card className="mt-8 p-5">
          <h2 className="flex items-center gap-2 font-display text-body font-semibold text-ink">
            <Layers className="size-4 text-ink-faint" aria-hidden /> Sürümler
          </h2>
          <p className="mt-0.5 text-caption text-ink-soft">
            Metni değiştiren her kayıt saklanır (son 30). Önizleyip istediğine dönebilirsin; adres, kapak ve yayın durumu değişmez.
          </p>
          <ol className="mt-2 divide-y divide-line">
            {surumler.slice(0, 8).map((s, i) => (
              <SurumSatiri
                key={s.id}
                s={s}
                guncel={i === 0}
                baslik={blog.title}
                blogId={blog.id}
                geriAlabilir={yazar}
                acilanSurum={blog.updated_at}
              />
            ))}
          </ol>
          {surumler.length > 8 ? (
            <details className="mt-1">
              <summary className="cursor-pointer py-2 text-caption font-medium text-ink-soft hover:text-ink">
                Daha eski {surumler.length - 8} sürüm
              </summary>
              <ol className="divide-y divide-line">
                {surumler.slice(8).map((s) => (
                  <SurumSatiri
                    key={s.id}
                    s={s}
                    guncel={false}
                    baslik={blog.title}
                    blogId={blog.id}
                    geriAlabilir={yazar}
                    acilanSurum={blog.updated_at}
                  />
                ))}
              </ol>
            </details>
          ) : null}
        </Card>
      ) : null}

      {gecmis && gecmis.data.length ? (
        <Card className="mt-8 p-5">
          <h2 className="flex items-center gap-2 font-display text-body font-semibold text-ink">
            <History className="size-4 text-ink-faint" aria-hidden /> Geçmiş
          </h2>
          <ol className="mt-3 space-y-2">
            {gecmis.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 text-caption">
                <span className="font-medium text-ink">{personName(e.actor) ?? "Silinmiş hesap"}</span>
                <span className="text-ink-soft">{e.summary.replace(/^“[^”]*”(: | yazısını )?/, "")}</span>
                <time dateTime={e.created_at} className="text-micro text-ink-faint" title={trDate(e.created_at, { time: true })}>
                  {relative(e.created_at)}
                </time>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {yazar ? (
        <Card className="mt-8 border-bad/20 p-5">
          <h2 className="font-display text-body font-semibold text-bad">Tehlikeli bölge</h2>
          <p className="mt-1 text-caption text-ink-soft">Yazı ve tüm görselleri kalıcı olarak silinir; geri alınamaz. Yayından kaldırmak için yukarıdaki &quot;Taslağa al&quot; düğmesi yeter.</p>
          <div className="mt-4">
            <ActionButton action={deleteBlogAction.bind(null, blog.id)} variant="secondary" size="sm" className="text-bad ring-bad/30 hover:bg-bad-wash" confirm={`"${blog.title}" kalıcı olarak silinsin mi?`}>
              <Trash2 /> Yazıyı sil
            </ActionButton>
          </div>
        </Card>
      ) : null}
    </>
  );
}
