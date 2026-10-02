"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ExternalLink, ImageOff, Loader2, Save } from "lucide-react";
import { getImageUrl, PUBLIC_BACKEND_URL } from "@/lib/api";
import { saveBlogAction } from "@/lib/admin/actions";
import type { AdminBlog, FormState } from "@/lib/admin/types";
import { Editor } from "./Editor";
import {
  Button,
  Card,
  CHECKBOX_CLASS,
  Field,
  INPUT_CLASS,
  Notice,
  SELECT_CLASS,
  TEXTAREA_CLASS,
  cn,
} from "./ui";

const initial: FormState = {};
const DIL: Record<string, string> = { tr: "Türkçe", en: "English", ar: "العربية" };
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const BLOG_YOLU: Record<string, string> = { tr: "/blog", en: "/en/blog", ar: "/ar/blog" };

/** İçerikteki göreli /uploads yollarını editörde görünmesi için mutlak yapar. */
function gorselleriMutlaklastir(html: string) {
  if (!PUBLIC_BACKEND_URL) return html;
  return html.replace(/(src=["'])\/uploads\//g, `$1${PUBLIC_BACKEND_URL}/uploads/`);
}

export function BlogForm({ blog, readOnly }: { blog?: AdminBlog; readOnly?: boolean }) {
  const [state, action, pending] = useActionState(saveBlogAction, initial);
  const [kapakSil, setKapakSil] = useState(false);
  const [onizleme, setOnizleme] = useState<string | null>(null);

  const mevcutKapak = blog?.image && !kapakSil ? getImageUrl(blog.image) : null;
  const kapak = onizleme ?? mevcutKapak;
  const yayinUrl = blog?.is_published && SITE_URL ? `${SITE_URL}${BLOG_YOLU[blog.locale] ?? "/blog"}/${blog.slug}` : null;

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {blog ? <input type="hidden" name="id" value={blog.id} /> : null}

      <div className="min-w-0 space-y-5">
        {state.error ? <Notice>{state.error}</Notice> : null}

        <Field label="Başlık" error={state.fields?.title}>
          <input
            name="title"
            defaultValue={blog?.title ?? ""}
            required
            maxLength={500}
            readOnly={readOnly}
            className={cn(INPUT_CLASS, "font-display text-lead font-semibold")}
            placeholder="Yazının başlığı"
          />
        </Field>

        <div>
          <span className="mb-1.5 flex items-center justify-between text-caption font-medium text-ink">
            İçerik
            {state.fields?.content ? <span className="text-bad">{state.fields.content}</span> : null}
          </span>
          <Editor name="content" initialHtml={gorselleriMutlaklastir(blog?.content ?? "")} invalid={Boolean(state.fields?.content)} />
        </div>

        <Field label="Özet" hint="Liste kartlarında ve paylaşım önizlemelerinde görünür. 1-2 cümle.">
          <textarea
            name="excerpt"
            defaultValue={blog?.excerpt ?? ""}
            rows={3}
            maxLength={1000}
            readOnly={readOnly}
            className={TEXTAREA_CLASS}
          />
        </Field>

        <Card className="p-5">
          <h2 className="font-display text-body font-semibold text-ink">Arama motoru</h2>
          <p className="mt-0.5 text-caption text-ink-soft">Boş bırakılırsa başlık ve özet kullanılır.</p>
          <div className="mt-4 space-y-4">
            <Field label="Meta başlık" hint="En fazla 60 karakter idealdir.">
              <input name="meta_title" defaultValue={blog?.meta_title ?? ""} maxLength={255} readOnly={readOnly} className={INPUT_CLASS} />
            </Field>
            <Field label="Meta açıklama" hint="150-160 karakter idealdir.">
              <textarea name="meta_description" defaultValue={blog?.meta_description ?? ""} rows={2} maxLength={320} readOnly={readOnly} className={TEXTAREA_CLASS} />
            </Field>
          </div>
        </Card>
      </div>

      <aside className="space-y-5">
        <Card className="p-5">
          <h2 className="font-display text-body font-semibold text-ink">Yayın</h2>
          <label className="mt-4 flex items-start gap-3">
            <input type="checkbox" name="is_published" defaultChecked={blog?.is_published ?? false} disabled={readOnly} className={cn(CHECKBOX_CLASS, "mt-0.5")} />
            <span>
              <span className="block text-caption font-medium text-ink">Yayında</span>
              <span className="block text-micro text-ink-faint">Kapalıysa taslak: sitede görünmez, yalnızca personel görür.</span>
            </span>
          </label>
          <div className="mt-4">
            <Field label="Dil">
              <select name="locale" defaultValue={blog?.locale ?? "tr"} disabled={readOnly} className={SELECT_CLASS}>
                {Object.entries(DIL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {!readOnly ? (
            <Button type="submit" block className="mt-5" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {pending ? "Kaydediliyor…" : blog ? "Kaydet" : "Yazıyı oluştur"}
            </Button>
          ) : null}
          {yayinUrl ? (
            <Link href={yayinUrl} target="_blank" className="mt-3 flex items-center justify-center gap-1.5 text-caption font-medium text-brand hover:underline">
              Sitede gör <ExternalLink className="size-3.5" />
            </Link>
          ) : null}
          {blog ? (
            <p className="mt-3 text-micro text-ink-faint">
              Adres: <span className="font-mono">/{blog.slug}</span>. Başlık değişirse adres de değişir.
            </p>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-body font-semibold text-ink">Kapak görseli</h2>
          <p className="mt-0.5 text-caption text-ink-soft">1200×630 önerilir. JPEG, PNG veya WebP; 10 MB&apos;a kadar.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface-sunk">
            {kapak ? (
              // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob) ve backend kapağı; next/image gerekmiyor
              <img src={kapak} alt="" className="aspect-[1.9/1] w-full object-cover" />
            ) : (
              <div className="flex aspect-[1.9/1] items-center justify-center text-ink-faint">
                <ImageOff className="size-6" />
              </div>
            )}
          </div>
          {!readOnly ? (
            <>
              <input
                type="file"
                name="cover"
                accept="image/jpeg,image/png,image/webp"
                className="mt-3 block w-full text-caption text-ink-soft file:me-3 file:rounded-lg file:border-0 file:bg-brand-wash file:px-3 file:py-2 file:text-caption file:font-semibold file:text-brand hover:file:bg-brand-wash-strong"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setOnizleme(f ? URL.createObjectURL(f) : null);
                  if (f) setKapakSil(false);
                }}
              />
              {blog?.image ? (
                <label className="mt-3 flex items-center gap-2 text-caption text-ink-soft">
                  <input type="checkbox" name="remove_cover" value="1" checked={kapakSil} onChange={(e) => setKapakSil(e.target.checked)} className={CHECKBOX_CLASS} />
                  Kapağı kaldır
                </label>
              ) : null}
            </>
          ) : null}
        </Card>

        <Card className="p-5">
          <Field label="Etiketler" hint="Virgülle ayır: tyt, matematik, çalışma planı">
            <input name="tags" defaultValue={blog?.tags?.join(", ") ?? ""} readOnly={readOnly} className={INPUT_CLASS} />
          </Field>
        </Card>
      </aside>
    </form>
  );
}
