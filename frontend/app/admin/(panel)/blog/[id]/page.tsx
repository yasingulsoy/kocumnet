import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, History, Layers, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/admin/ActionButtons";
import { BlogForm } from "@/components/admin/BlogForm";
import { relative, trDate } from "@/components/admin/ui";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { PageBreadcrumb } from "@/components/tailadmin/ui/PageBreadcrumb";
import { deleteBlogAction, restoreRevisionAction } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { BackendError } from "@/lib/admin/backend";
import { getBlog, listAudit, listRevisions } from "@/lib/admin/data";
import { CONTENT_ROLES, personName, type BlogRevisionSummary } from "@/lib/admin/types";
import { authorName } from "@/lib/blog";

export const metadata: Metadata = { title: "Yazıyı düzenle" };

const KAYIT_BILDIRIMI: Record<string, { variant: "success" | "info"; text: string }> = {
  "1": { variant: "success", text: "Kaydedildi." },
  yayinlandi: { variant: "success", text: "Yazı yayınlandı. Sitede birkaç saniye içinde görünür." },
  taslak: { variant: "info", text: "Yazı taslağa alındı; artık sitede görünmüyor." },
  geri: { variant: "success", text: "Yazı seçilen sürüme döndü. Yayındaysa sitede de bu hâli görünür; istersen yine sürümlerden geri alabilirsin." },
};

const SURUME_DON = {
  title: "Yazı bu sürüme dönsün mü?",
  description:
    "Başlık, içerik, özet, meta alanları ve etiketler değişir; adres ve yayın durumu aynı kalır. Editörde kaydedilmemiş değişiklik varsa kaybolur.",
  confirmLabel: "Bu sürüme dön",
  tone: "warning" as const,
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
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 sm:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-theme-sm text-gray-800">
          <span className="font-medium">{guncel ? "Şu anki sürüm" : relative(s.created_at)}</span>
          <span className="text-gray-500"> · {personName(s.author) ?? "Silinmiş hesap"}</span>
        </p>
        <p className="mt-0.5 truncate text-theme-xs text-gray-500">
          <time dateTime={s.created_at}>{trDate(s.created_at, { time: true })}</time>
          {s.title !== baslik ? <> · başlık: “{s.title}”</> : null}
        </p>
      </div>
      <Link
        href={`/admin/blog/${blogId}/onizleme?surum=${s.id}`}
        target="_blank"
        className="inline-flex items-center gap-1 text-theme-sm font-medium text-brand-500 hover:text-brand-600"
      >
        <Eye className="size-3.5" aria-hidden /> Önizle
      </Link>
      {!guncel && geriAlabilir ? (
        <ActionButton action={restoreRevisionAction.bind(null, blogId, s.id, acilanSurum)} variant="ghost" confirm={SURUME_DON}>
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
      <PageBreadcrumb
        pageTitle={blog.title}
        currentLabel="Düzenle"
        crumbs={[{ href: "/admin/blog", label: "Blog" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge size="sm" color={blog.is_published ? "success" : "warning"}>
              {blog.is_published ? "Yayında" : "Taslak"}
            </Badge>
            <span>
              {authorName(blog) ?? "—"} · oluşturuldu {trDate(blog.created_at)} · güncellendi {trDate(blog.updated_at, { time: true })} ·{" "}
              {blog.view_count ?? 0} görüntülenme
            </span>
          </span>
        }
      />

      {kayit ? (
        <Alert variant={kayit.variant} className="mb-4">
          {kayit.text}
        </Alert>
      ) : null}
      {sp.hata === "kapak" ? (
        <Alert variant="warning" className="mb-4" title="Yazı kaydedildi, kapak yüklenemedi">
          Görsel JPEG, PNG veya WebP olmalı ve 10 MB&apos;ı aşmamalı. Aşağıdan yeniden dene.
        </Alert>
      ) : null}

      {/* Her başarılı kayıttan sonra form sunucudaki yeni değerlerle, "kaydedilmedi" izi temiz başlar. */}
      <BlogForm
        key={`${blog.updated_at ?? blog.id}:${typeof sp.k === "string" ? sp.k : ""}`}
        blog={blog}
        readOnly={!yazar}
        kaydedildi={Boolean(kayit) || sp.hata === "kapak"}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {surumler && surumler.length ? (
          <ComponentCard
            title="Sürümler"
            icon={<Layers />}
            desc="Metni değiştiren her kayıt saklanır (son 30). Önizleyip istediğine dönebilirsin; adres, kapak ve yayın durumu değişmez."
            flush
          >
            <ol className="divide-y divide-gray-100">
              {surumler.slice(0, 8).map((s, i) => (
                <SurumSatiri key={s.id} s={s} guncel={i === 0} baslik={blog.title} blogId={blog.id} geriAlabilir={yazar} acilanSurum={blog.updated_at} />
              ))}
            </ol>
            {surumler.length > 8 ? (
              <details className="border-t border-gray-100">
                <summary className="cursor-pointer px-5 py-3 text-theme-sm font-medium text-gray-600 hover:text-gray-800 sm:px-6">
                  Daha eski {surumler.length - 8} sürüm
                </summary>
                <ol className="divide-y divide-gray-100">
                  {surumler.slice(8).map((s) => (
                    <SurumSatiri key={s.id} s={s} guncel={false} baslik={blog.title} blogId={blog.id} geriAlabilir={yazar} acilanSurum={blog.updated_at} />
                  ))}
                </ol>
              </details>
            ) : null}
          </ComponentCard>
        ) : null}

        {gecmis && gecmis.data.length ? (
          <ComponentCard title="Geçmiş" icon={<History />} desc="Bu yazıda kim ne zaman ne yaptı.">
            <ol className="space-y-2.5">
              {gecmis.data.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 text-theme-sm">
                  <span className="font-medium text-gray-800">{personName(e.actor) ?? "Silinmiş hesap"}</span>
                  <span className="text-gray-500">{e.summary.replace(/^“[^”]*”(: | yazısını )?/, "")}</span>
                  <time dateTime={e.created_at} className="text-theme-xs text-gray-500" title={trDate(e.created_at, { time: true })}>
                    {relative(e.created_at)}
                  </time>
                </li>
              ))}
            </ol>
          </ComponentCard>
        ) : null}
      </div>

      {yazar ? (
        <ComponentCard
          className="mt-6"
          tone="danger"
          title="Tehlikeli bölge"
          desc="Yazı ve tüm görselleri kalıcı olarak silinir; geri alınamaz. Yayından kaldırmak için yukarıdaki “Taslağa al” düğmesi yeter."
        >
          <ActionButton
            action={deleteBlogAction.bind(null, blog.id)}
            variant="danger-outline"
            icon={<Trash2 aria-hidden />}
            confirm={{
              title: `"${blog.title}" kalıcı olarak silinsin mi?`,
              description: "Yazı ve tüm görselleri silinir; bu işlem geri alınamaz.",
              confirmLabel: "Yazıyı sil",
              tone: "danger",
            }}
          >
            Yazıyı sil
          </ActionButton>
        </ComponentCard>
      ) : null}
    </>
  );
}
