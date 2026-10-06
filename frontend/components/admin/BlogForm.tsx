"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { Eye, EyeOff, ExternalLink, History, ImageOff, Loader2, RefreshCw, Save, Send } from "lucide-react";
import { getImageUrl, PUBLIC_BACKEND_URL } from "@/lib/api";
import { saveBlogAction } from "@/lib/admin/actions";
import type { AdminBlog } from "@/lib/admin/types";
import { Editor } from "./Editor";
import { useDraftBackup } from "./useDraftBackup";
import { useFormAction } from "./useFormAction";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { Button, CHECKBOX_CLASS, Card, Field, INPUT_CLASS, Notice, Pill, SELECT_CLASS, TEXTAREA_CLASS, cn, relative } from "./ui";

const DIL: Record<string, string> = { tr: "Türkçe", en: "English", ar: "العربية" };
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const BLOG_YOLU: Record<string, string> = { tr: "/blog", en: "/en/blog", ar: "/ar/blog" };
/** Yedeklenen ve geri yüklenen form alanları. */
const ALANLAR = ["title", "excerpt", "meta_title", "meta_description", "tags", "slug", "locale", "image_alt"] as const;
const MB = 1024 * 1024;
/** Sunucu action gövde sınırı 12 MB (next.config.ts); pay bırakıyoruz. */
const GOVDE_SINIRI = 11.5 * MB;
const KAPAK_SINIRI = 10 * MB;

/**
 * Göndermeden önce boyut denetimi. Sınırı aşan gövde sunucuya hiç ulaşmıyor,
 * Next isteği reddediyordu: kullanıcı anlamsız bir hata görüyordu.
 */
function boyutDenetimi(fd: FormData): string | null {
  const kapak = fd.get("cover");
  const kapakBoyutu = kapak instanceof File ? kapak.size : 0;
  if (kapakBoyutu > KAPAK_SINIRI) return "Kapak görseli 10 MB'ı aşıyor. Daha küçük bir görsel seç.";
  const icerik = String(fd.get("content") ?? "").length;
  if (icerik + kapakBoyutu > GOVDE_SINIRI) {
    return `Yazı gömülü görsellerle birlikte çok büyük (${((icerik + kapakBoyutu) / MB).toFixed(1)} MB; sınır 11,5 MB). Görsel sayısını azalt ya da kapağı küçült.`;
  }
  return null;
}

/** İçerikteki göreli /uploads yollarını editörde görünmesi için mutlak yapar. */
function gorselleriMutlaklastir(html: string) {
  if (!PUBLIC_BACKEND_URL) return html;
  return html.replace(/(src=["'])\/uploads\//g, `$1${PUBLIC_BACKEND_URL}/uploads/`);
}

/** Yeni yazının adres önizlemesi — backend'deki createSlug ile aynı kural. */
function adresOnizle(baslik: string) {
  return baslik
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Formdaki alanların anlık değerleri (uncontrolled alanlar DOM'dan okunur).
 * Formda olmayan alan (yeni yazıda adres, kapaksız yazıda alt metin) boş metin.
 */
function formDegerleri(form: HTMLFormElement | null): Record<string, string> {
  const d: Record<string, string> = Object.fromEntries(ALANLAR.map((a) => [a, ""]));
  if (!form) return d;
  for (const ad of ALANLAR) {
    const el = form.elements.namedItem(ad);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) d[ad] = el.value;
  }
  return d;
}

/** Karakter sayacı: ideal aralıkta yeşil, uzunsa turuncu (Google keser). */
function Sayac({
  uzunluk,
  ideal,
  bos,
  uzunNotu = " · uzun, Google kısaltır",
}: {
  uzunluk: number;
  ideal: [number, number];
  bos?: string;
  uzunNotu?: string;
}) {
  if (uzunluk === 0) return <span className="text-micro text-ink-faint">{bos ?? "boş"}</span>;
  const [alt, ust] = ideal;
  const ton = uzunluk > ust ? "text-warn" : uzunluk >= alt ? "text-ok" : "text-ink-faint";
  const not = uzunluk > ust ? uzunNotu : uzunluk < alt ? " · biraz kısa" : " · iyi";
  return (
    <span className={cn("tabular text-micro", ton)}>
      {uzunluk} / {ust}
      {not}
    </span>
  );
}

/**
 * Google sonuç önizlemesi: yazar, meta alanlarının arama sonucunda nasıl
 * görüneceğini yazarken görsün. Site başlığa " | Koçum.Net" ekliyor.
 */
function AramaOnizlemesi({ baslik, aciklama, yol }: { baslik: string; aciklama: string; yol: string }) {
  const tamBaslik = `${baslik || "Yazının başlığı"} | Koçum.Net`;
  return (
    <div className="rounded-xl border border-line bg-surface p-4" aria-label="Arama sonucu önizlemesi">
      <p className="truncate text-micro text-ink-soft">kocum.net{yol.split("/").filter(Boolean).map((p) => ` › ${p}`).join("")}</p>
      <p className="mt-1 line-clamp-1 text-h4 text-brand">{tamBaslik}</p>
      <p className={cn("mt-1 line-clamp-2 text-caption leading-relaxed", aciklama ? "text-ink-soft" : "italic text-ink-faint")}>
        {aciklama || "Açıklama yok: Google sayfadan kendisi bir parça seçer. Özet ya da meta açıklama yaz."}
      </p>
    </div>
  );
}

/**
 * Yazı editörü.
 *
 * Yayın durumu düğmeden gelir: taslakta "Yayınla" / "Taslağı kaydet",
 * yayındaki yazıda "Güncelle" / "Taslağa al". Ctrl+S (⌘S) kaydeder ve
 * durumu değiştirmez. Kaydedilmemiş değişiklik varken sayfadan çıkmadan
 * önce sorulur; yazılanlar bu tarayıcıda yedeklenir.
 *
 * Sayfa, başarılı her kayıttan sonra bileşeni yeniden bağlar (key): alanlar
 * sunucudaki yeni değerlerle, "kaydedilmedi" izi temiz başlar.
 */
export function BlogForm({ blog, readOnly, kaydedildi }: { blog?: AdminBlog; readOnly?: boolean; kaydedildi?: boolean }) {
  // Süren görsel yüklemesi varken kaydedilmez: içerikte görsel henüz yok.
  const [yuklenenGorsel, setYuklenenGorsel] = useState(0);
  const { state, pending, formRef, formProps, yenidenGonder } = useFormAction(saveBlogAction, {
    dogrula: (fd) => (yuklenenGorsel > 0 ? "Görsel yükleniyor; bitince kaydet." : boyutDenetimi(fd)),
  });
  /** Çakışmada "yenile": tarayıcının "ayrılıyor musun" sorusu bu kez çıkmasın. */
  const [cikisSerbest, setCikisSerbest] = useState(false);
  const editorRef = useRef<TiptapEditor | null>(null);
  const [kapakSil, setKapakSil] = useState(false);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [kapakHatasi, setKapakHatasi] = useState<string | null>(null);
  const [degisti, setDegisti] = useState(false);
  const [surum, setSurum] = useState(0);
  const [yedekKapandi, setYedekKapandi] = useState(false);

  /*
   * Meta alanı başlığın/özetin birebir kopyasıysa boş göster: eskiden
   * backend yeni yazıda başlığı buraya kopyalıyordu; yazar başlığı sonra
   * değiştirince Google'daki başlık eski kalıyordu. Boş alan başlığı izler.
   */
  const ilk: Record<string, string> = {
    title: blog?.title ?? "",
    excerpt: blog?.excerpt ?? "",
    meta_title: blog?.meta_title && blog.meta_title !== blog.title ? blog.meta_title : "",
    meta_description: blog?.meta_description && blog.meta_description !== blog.excerpt ? blog.meta_description : "",
    tags: blog?.tags?.join(", ") ?? "",
    slug: blog?.slug ?? "",
    locale: blog?.locale ?? "tr",
    image_alt: blog?.image_alt ?? "",
  };
  const [deger, setDeger] = useState(ilk);
  const ilkIcerik = gorselleriMutlaklastir(blog?.content ?? "");

  const yedekKimligi = blog ? String(blog.id) : "yeni";
  const { bulunan, yaz, sil } = useDraftBackup(yedekKimligi);
  // Kayıttan hemen sonra açılan sayfada eski yedek gösterilmez (aşağıda silinir).
  const yedek =
    !readOnly && !kaydedildi && !yedekKapandi && bulunan && (bulunan.icerik !== ilkIcerik || ALANLAR.some((a) => (bulunan.alanlar[a] ?? "") !== ilk[a]))
      ? bulunan
      : null;
  // Yedek, yazının şimdikinden eski bir sürümüne dayanıyorsa arada başkası kaydetmiştir.
  const sunucuDahaYeni = Boolean(
    yedek &&
      blog?.updated_at &&
      (yedek.taban ? yedek.taban !== blog.updated_at : new Date(blog.updated_at).getTime() > yedek.zaman)
  );

  useUnsavedGuard(degisti && !pending && !readOnly && !cikisSerbest);

  useEffect(() => {
    if (cikisSerbest) window.location.reload();
  }, [cikisSerbest]);

  // Başarılı kayıt: yedeği sil, adres çubuğundaki ?kaydedildi'yi temizle
  // (yenilemede yeni yedek yanlışlıkla silinmesin).
  useEffect(() => {
    if (!kaydedildi) return;
    sil("yeni");
    const url = new URL(window.location.href);
    url.searchParams.delete("kaydedildi");
    url.searchParams.delete("hata");
    // `k` kalır: sayfa formun anahtarını ondan alıyor; silinirse ilk yenilemede
    // form yeniden bağlanır, yazılanlar giderdi.
    // Next, yerel replaceState'i kendi yönlendiricisiyle eşitliyor (sayfa yenilenmez).
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [kaydedildi, sil]);

  // Değişiklikten 1 sn sonra yerel yedek.
  useEffect(() => {
    if (!surum || readOnly) return;
    const t = window.setTimeout(() => {
      const icerik = editorRef.current?.getHTML() ?? "";
      yaz({ alanlar: formDegerleri(formRef.current), icerik, zaman: Date.now(), taban: blog?.updated_at ?? null });
    }, 1000);
    return () => window.clearTimeout(t);
  }, [surum, readOnly, yaz, formRef, blog?.updated_at]);

  // Ctrl+S / ⌘S: kaydet, yayın durumunu değiştirme.
  useEffect(() => {
    if (readOnly) return;
    const tus = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [readOnly, formRef]);

  /**
   * Çakışmada güvenli yol: yazdıklarını hemen yedekle, sayfayı yenile. Yeni
   * sürüm açılır; "Bu tarayıcıda kaydedilmemiş bir sürüm var" kutusundan
   * yazdıklarını geri getirip birleştirebilirsin.
   */
  function yedekleVeYenile() {
    yaz({
      alanlar: formDegerleri(formRef.current),
      icerik: editorRef.current?.getHTML() ?? "",
      zaman: Date.now(),
      taban: blog?.updated_at ?? null,
    });
    setCikisSerbest(true);
  }

  function degisiklik() {
    setDegisti(true);
    setSurum((s) => s + 1);
    setDeger(formDegerleri(formRef.current));
  }

  function yedegiGeriYukle() {
    if (!yedek || !formRef.current) return;
    for (const ad of ALANLAR) {
      const el = formRef.current.elements.namedItem(ad);
      const v = yedek.alanlar[ad];
      if (v !== undefined && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
        el.value = v;
      }
    }
    editorRef.current?.commands.setContent(yedek.icerik);
    setYedekKapandi(true);
    degisiklik();
  }

  const mevcutKapak = blog?.image && !kapakSil ? getImageUrl(blog.image) : null;
  const kapak = onizleme ?? mevcutKapak;
  // Yeni kapak seçildi ve açıklaması boş: alanı öne çıkar (zorunlu değil).
  const altOnerisi = !readOnly && Boolean(onizleme) && !deger.image_alt.trim();
  const yayinda = Boolean(blog?.is_published);
  const yayinUrl = yayinda && SITE_URL && blog ? `${SITE_URL}${BLOG_YOLU[blog.locale] ?? "/blog"}/${blog.slug}` : null;
  const yol = `${BLOG_YOLU[deger.locale] ?? "/blog"}/${deger.slug || adresOnizle(deger.title) || "yazi-adresi"}`;
  const etkinBaslik = deger.meta_title.trim() || deger.title.trim();
  const etkinAciklama = deger.meta_description.trim() || deger.excerpt.trim();

  return (
    <form {...formProps} onChange={readOnly ? undefined : degisiklik} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {blog ? <input type="hidden" name="id" value={blog.id} /> : null}
      {/* Aynı anda düzenleme koruması: editörün açtığı sürüm (backend 409 için). */}
      {blog?.updated_at ? <input type="hidden" name="acilan_surum" value={blog.updated_at} /> : null}

      <div className="min-w-0 space-y-5">
        {yedek ? (
          <Notice tone="info" title="Bu tarayıcıda kaydedilmemiş bir sürüm var">
            <p>
              {new Date(yedek.zaman).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" })}{" "}
              tarihli yazdıkların kaydedilmeden kalmış.
              {sunucuDahaYeni
                ? " Yazı bu yedekten sonra başkası tarafından (ya da başka sekmede) kaydedilmiş; geri yüklersen o değişikliklerin üzerine yazarsın. Önce Sürümler'den son hâline bakabilirsin."
                : ""}
              {yedek.gorselsiz ? " Gömülü görseller yedeğe sığmadı, onları yeniden eklemen gerekecek." : ""}
            </p>
            <span className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={yedegiGeriYukle}>
                <History /> Geri yükle
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  sil();
                  setYedekKapandi(true);
                }}
              >
                Yok say
              </Button>
            </span>
          </Notice>
        ) : null}
        {state.conflict ? (
          <Notice tone="warn" title="Bu yazı sen açtıktan sonra değiştirildi">
            <p>
              {state.conflict.byMe ? "Sen (başka bir sekmede ya da cihazda)" : (state.conflict.by ?? "Başka biri")}{" "}
              {relative(state.conflict.at)} kaydetti{state.conflict.what ? `: ${state.conflict.what}` : ""}. Onun
              değişikliklerinin üzerine yazmamak için kayıt yapılmadı.
            </p>
            <span className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={yedekleVeYenile}>
                <RefreshCw /> Yenile, yazdıklarım yedekte kalsın
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-bad hover:bg-bad-wash"
                disabled={pending || yuklenenGorsel > 0}
                onClick={() => {
                  if (window.confirm("Araya giren değişiklikler silinecek, yazının senin hâlin kaydedilecek. Emin misin?")) {
                    yenidenGonder({ zorla: "1" });
                  }
                }}
              >
                Yine de kaydet (üzerine yaz)
              </Button>
            </span>
            <p className="mt-2 text-micro">
              Yeniledikten sonra çıkan kutudan &quot;Geri yükle&quot; ile yazdıklarını getirip iki hâli birleştirebilirsin; eski
              hâller Sürümler&apos;de duruyor.
            </p>
          </Notice>
        ) : state.error ? (
          <Notice>{state.error}</Notice>
        ) : null}

        <Field label="Başlık" error={state.fields?.title}>
          <input
            name="title"
            defaultValue={ilk.title}
            required
            maxLength={500}
            readOnly={readOnly}
            className={cn(INPUT_CLASS, "font-display text-lead font-semibold")}
            placeholder="Yazının başlığı"
          />
        </Field>

        <div>
          <span id="icerik-etiketi" className="mb-1.5 flex items-center justify-between text-caption font-medium text-ink">
            İçerik
            {state.fields?.content ? <span className="text-bad">{state.fields.content}</span> : null}
          </span>
          <Editor
            name="content"
            initialHtml={ilkIcerik}
            invalid={Boolean(state.fields?.content)}
            editable={!readOnly}
            labelledBy="icerik-etiketi"
            onChange={degisiklik}
            onReady={(e) => {
              editorRef.current = e;
            }}
            onUploadingChange={setYuklenenGorsel}
          />
        </div>

        <Field
          label="Özet"
          hint={
            <span className="flex flex-wrap justify-between gap-2">
              <span>Liste kartlarında ve paylaşım önizlemelerinde görünür. 1-2 cümle.</span>
              <Sayac uzunluk={deger.excerpt.trim().length} ideal={[70, 160]} />
            </span>
          }
        >
          <textarea name="excerpt" defaultValue={ilk.excerpt} rows={3} maxLength={1000} readOnly={readOnly} className={TEXTAREA_CLASS} />
        </Field>

        <Card className="p-5">
          <h2 className="font-display text-body font-semibold text-ink">Arama motoru</h2>
          <p className="mt-0.5 text-caption text-ink-soft">Boş bırakılırsa başlık ve özet kullanılır; başlığı değiştirirsen burası da izler.</p>
          <div className="mt-4 space-y-4">
            <Field
              label="Meta başlık"
              hint={
                <span className="flex flex-wrap justify-between gap-2">
                  <span>Google&apos;da görünen başlık. 30-60 karakter idealdir.</span>
                  <Sayac uzunluk={etkinBaslik.length} ideal={[30, 60]} bos="başlık bekleniyor" />
                </span>
              }
            >
              <input
                name="meta_title"
                defaultValue={ilk.meta_title}
                maxLength={255}
                readOnly={readOnly}
                placeholder={deger.title || "Boşsa yazının başlığı"}
                className={INPUT_CLASS}
              />
            </Field>
            <Field
              label="Meta açıklama"
              hint={
                <span className="flex flex-wrap justify-between gap-2">
                  <span>Sonuçta başlığın altındaki iki satır. 120-160 karakter idealdir.</span>
                  <Sayac uzunluk={etkinAciklama.length} ideal={[120, 160]} bos="açıklama yok" />
                </span>
              }
            >
              <textarea
                name="meta_description"
                defaultValue={ilk.meta_description}
                rows={2}
                maxLength={320}
                readOnly={readOnly}
                placeholder={deger.excerpt || "Boşsa özet kullanılır"}
                className={TEXTAREA_CLASS}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-caption font-medium text-ink">Arama sonucunda böyle görünür</p>
              <AramaOnizlemesi baslik={etkinBaslik} aciklama={etkinAciklama} yol={yol} />
            </div>
          </div>
        </Card>
      </div>

      <aside className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-body font-semibold text-ink">Yayın</h2>
            <Pill tone={yayinda ? "ok" : "warn"}>{yayinda ? "Yayında" : blog ? "Taslak" : "Yeni"}</Pill>
          </div>
          <p className="mt-1 text-caption text-ink-soft">
            {yayinda
              ? "Sitede görünüyor. Güncelle, değişiklikleri hemen yayına alır."
              : "Taslak sitede görünmez; yalnızca personel görür."}
          </p>

          {!readOnly ? (
            <div className="mt-4 grid gap-2">
              {yayinda ? (
                <>
                  <Button type="submit" block disabled={pending || yuklenenGorsel > 0}>
                    {pending ? <Loader2 className="animate-spin" /> : <Save />} Güncelle
                  </Button>
                  <Button
                    type="submit"
                    name="yayin"
                    value="0"
                    variant="ghost"
                    block
                    disabled={pending || yuklenenGorsel > 0}
                    onClick={(e) => {
                      if (!window.confirm("Yazı yayından kaldırılsın mı? Sitedeki adresi 404 verir.")) e.preventDefault();
                    }}
                  >
                    <EyeOff /> Taslağa al
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" name="yayin" value="1" block disabled={pending || yuklenenGorsel > 0}>
                    {pending ? <Loader2 className="animate-spin" /> : <Send />} Yayınla
                  </Button>
                  <Button type="submit" variant="secondary" block disabled={pending || yuklenenGorsel > 0}>
                    <Save /> {blog ? "Taslağı kaydet" : "Taslak olarak kaydet"}
                  </Button>
                </>
              )}
              <p role="status" className="mt-1 flex items-center justify-center gap-1.5 text-micro text-ink-faint">
                {pending ? (
                  "Kaydediliyor…"
                ) : degisti ? (
                  <>
                    <span aria-hidden className="size-1.5 rounded-full bg-warn-fill" /> Kaydedilmemiş değişiklikler
                  </>
                ) : (
                  yuklenenGorsel > 0 ? "Görsel yükleniyor…" : "Kısayol: Ctrl+S / ⌘S kaydeder"
                )}
              </p>
            </div>
          ) : null}

          {blog ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Link
                href={`/admin/blog/${blog.id}/onizleme`}
                target="_blank"
                className="flex items-center gap-1.5 text-caption font-medium text-brand hover:underline"
              >
                <Eye className="size-3.5" aria-hidden /> Önizle
              </Link>
              {yayinUrl ? (
                <Link href={yayinUrl} target="_blank" className="flex items-center gap-1.5 text-caption font-medium text-brand hover:underline">
                  Sitede gör <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              ) : null}
            </div>
          ) : null}
          {blog && degisti ? (
            <p className="mt-1 text-center text-micro text-ink-faint">Önizleme son kaydedilen hâli gösterir; önce kaydet.</p>
          ) : null}

          <div className="mt-5 space-y-4 border-t border-line pt-4">
            <Field label="Dil">
              <select name="locale" defaultValue={ilk.locale} disabled={readOnly} className={SELECT_CLASS}>
                {Object.entries(DIL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            {blog ? (
              <Field
                label="Adres (slug)"
                error={state.fields?.slug}
                hint={
                  yayinda
                    ? "Yayındaki yazının adresi başlık değişse de sabit kalır; buradan değiştirirsen eski bağlantı 404 verir."
                    : "Taslakta adres başlığı izler; dilersen elle yaz."
                }
              >
                <input
                  name="slug"
                  defaultValue={ilk.slug}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  minLength={3}
                  maxLength={120}
                  readOnly={readOnly}
                  className={cn(INPUT_CLASS, "font-mono text-caption")}
                />
              </Field>
            ) : (
              <p className="text-micro text-ink-faint">
                Adres başlıktan üretilir: <span className="font-mono text-ink-soft">{yol}</span>
              </p>
            )}
          </div>
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
                <ImageOff className="size-6" aria-hidden />
                <span className="sr-only">Kapak görseli yok</span>
              </div>
            )}
          </div>
          {!readOnly ? (
            <>
              <input
                type="file"
                name="cover"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Kapak görseli seç"
                className="mt-3 block w-full text-caption text-ink-soft file:me-3 file:rounded-lg file:border-0 file:bg-brand-wash file:px-3 file:py-2 file:text-caption file:font-semibold file:text-brand hover:file:bg-brand-wash-strong"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  // Büyük dosya formla gitmesin: seçerken söyle, seçimi geri al.
                  if (f && f.size > KAPAK_SINIRI) {
                    e.target.value = "";
                    setOnizleme(null);
                    setKapakHatasi(`Bu görsel ${(f.size / MB).toFixed(1)} MB; en fazla 10 MB olabilir.`);
                    return;
                  }
                  setKapakHatasi(null);
                  setOnizleme(f ? URL.createObjectURL(f) : null);
                  if (f) setKapakSil(false);
                }}
              />
              {kapakHatasi || state.fields?.cover ? (
                <p role="alert" className="mt-2 text-caption text-bad">
                  {kapakHatasi ?? state.fields?.cover}
                </p>
              ) : null}
            </>
          ) : null}
          {kapak ? (
            <div className="mt-4">
              <Field
                label="Görsel açıklaması (alt metin)"
                hint={
                  <span className="flex flex-wrap justify-between gap-2">
                    <span>Görmeyen okur ve arama motoru için görselde ne olduğunu bir cümleyle yaz. Boşsa başlık kullanılır.</span>
                    <Sayac uzunluk={deger.image_alt.trim().length} ideal={[1, 125]} bos="isteğe bağlı" uzunNotu=" · uzun, ekran okuyucu böler" />
                  </span>
                }
              >
                <input
                  name="image_alt"
                  defaultValue={ilk.image_alt}
                  maxLength={200}
                  readOnly={readOnly}
                  placeholder="Örn. Masada açık bir matematik defteri ve kalem"
                  className={cn(INPUT_CLASS, altOnerisi && "border-brand ring-4 ring-brand/12")}
                />
              </Field>
              {altOnerisi ? (
                <p className="mt-1.5 text-caption font-medium text-brand">
                  Yeni kapak seçtin: ne gösterdiğini kısaca yazman önerilir (zorunlu değil).
                </p>
              ) : null}
            </div>
          ) : null}
          {!readOnly ? (
            <>
              {blog?.image ? (
                <label className="mt-3 flex items-center gap-2 text-caption text-ink-soft">
                  <input
                    type="checkbox"
                    name="remove_cover"
                    value="1"
                    checked={kapakSil}
                    onChange={(e) => setKapakSil(e.target.checked)}
                    className={CHECKBOX_CLASS}
                  />
                  Kapağı kaldır
                </label>
              ) : null}
            </>
          ) : null}
        </Card>

        <Card className="p-5">
          <Field label="Etiketler" hint="Virgülle ayır: tyt, matematik, çalışma planı">
            <input name="tags" defaultValue={ilk.tags} readOnly={readOnly} className={INPUT_CLASS} />
          </Field>
        </Card>
      </aside>
    </form>
  );
}
