"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { Eye, EyeOff, ExternalLink, History, ImageOff, RefreshCw, Save, Send } from "lucide-react";
import { getImageUrl, PUBLIC_BACKEND_URL } from "@/lib/api";
import { saveBlogAction } from "@/lib/admin/actions";
import type { AdminBlog } from "@/lib/admin/types";
import { cx } from "@/components/tailadmin/cx";
import { Dropzone } from "@/components/tailadmin/extras/dropzone/Dropzone";
import { Checkbox } from "@/components/tailadmin/form/Checkbox";
import { Field } from "@/components/tailadmin/form/Field";
import { Input } from "@/components/tailadmin/form/Input";
import { Select } from "@/components/tailadmin/form/Select";
import { TextArea } from "@/components/tailadmin/form/TextArea";
import { Alert } from "@/components/tailadmin/ui/Alert";
import { Badge } from "@/components/tailadmin/ui/Badge";
import { Button } from "@/components/tailadmin/ui/Button";
import { ComponentCard } from "@/components/tailadmin/ui/Card";
import { useConfirm } from "@/components/tailadmin/ui/Dialogs";
import { Editor } from "./Editor";
import { relative } from "./ui";
import { useDraftBackup } from "./useDraftBackup";
import { useFormAction } from "./useFormAction";
import { useUnsavedGuard } from "./useUnsavedGuard";

const DIL: Record<string, string> = { tr: "Türkçe", en: "English", ar: "العربية" };
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const BLOG_YOLU: Record<string, string> = { tr: "/blog", en: "/en/blog", ar: "/ar/blog" };
/** Yedeklenen ve geri yüklenen form alanları. */
const ALANLAR = ["title", "excerpt", "meta_title", "meta_description", "tags", "slug", "locale", "image_alt"] as const;
const MB = 1024 * 1024;
/** Sunucu action gövde sınırı 12 MB (next.config.ts); pay bırakıyoruz. */
const GOVDE_SINIRI = 11.5 * MB;
const KAPAK_SINIRI = 10 * MB;
const KAPAK_TURLERI = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] };

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
  if (uzunluk === 0) return <span className="text-gray-500">{bos ?? "boş"}</span>;
  const [alt, ust] = ideal;
  const ton = uzunluk > ust ? "text-warning-700" : uzunluk >= alt ? "text-success-700" : "text-gray-500";
  const not = uzunluk > ust ? uzunNotu : uzunluk < alt ? " · biraz kısa" : " · iyi";
  return (
    <span className={cx("tabular", ton)}>
      {uzunluk} / {ust}
      {not}
    </span>
  );
}

/** İpucu satırı: solda açıklama, sağda sayaç. */
function SayacliIpucu({ metin, children }: { metin: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-wrap justify-between gap-2">
      <span>{metin}</span>
      {children}
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
    <div className="rounded-xl border border-gray-200 bg-white p-4" aria-label="Arama sonucu önizlemesi">
      <p className="truncate text-theme-xs text-gray-600">
        kocum.net
        {yol
          .split("/")
          .filter(Boolean)
          .map((p) => ` › ${p}`)
          .join("")}
      </p>
      <p className="mt-1 line-clamp-1 text-lg text-brand-500">{tamBaslik}</p>
      <p className={cx("mt-1 line-clamp-2 text-theme-sm leading-relaxed", aciklama ? "text-gray-600" : "text-gray-500 italic")}>
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
  const [degisti, setDegisti] = useState(false);
  const [surum, setSurum] = useState(0);
  const [yedekKapandi, setYedekKapandi] = useState(false);
  const [onayPenceresi, onayla] = useConfirm();

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

  const cikisUyarisi = useUnsavedGuard(degisti && !pending && !readOnly && !cikisSerbest);

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

  // Seçilen kapağın önizleme adresi: yenisi gelince ya da form kapanınca bırakılır.
  useEffect(() => {
    if (!onizleme) return;
    return () => URL.revokeObjectURL(onizleme);
  }, [onizleme]);

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

  /** "Taslağa al": önce sor; evet derse aynı düğmeyle gönder (name/value niyeti gitsin). */
  function taslagaAl(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const dugme = e.currentTarget;
    void onayla({
      title: "Yazı yayından kaldırılsın mı?",
      description: "Sitedeki adresi 404 verir. İstediğinde yeniden yayınlayabilirsin.",
      confirmLabel: "Taslağa al",
      tone: "warning",
    }).then((evet) => {
      if (evet) formRef.current?.requestSubmit(dugme);
    });
  }

  function uzerineYaz() {
    void onayla({
      title: "Araya giren değişikliklerin üzerine yazılsın mı?",
      description: "Araya giren değişiklikler silinecek, yazının senin hâlin kaydedilecek. Eski hâller Sürümler'de kalır.",
      confirmLabel: "Yine de kaydet",
      tone: "danger",
    }).then((evet) => {
      if (evet) yenidenGonder({ zorla: "1" });
    });
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
  const kilitli = pending || yuklenenGorsel > 0;

  return (
    <form {...formProps} onChange={readOnly ? undefined : degisiklik} className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      {cikisUyarisi}
      {onayPenceresi}
      {blog ? <input type="hidden" name="id" value={blog.id} /> : null}
      {/* Aynı anda düzenleme koruması: editörün açtığı sürüm (backend 409 için). */}
      {blog?.updated_at ? <input type="hidden" name="acilan_surum" value={blog.updated_at} /> : null}

      <div className="min-w-0 space-y-6">
        {yedek ? (
          <Alert
            variant="info"
            title="Bu tarayıcıda kaydedilmemiş bir sürüm var"
            action={
              <>
                <Button size="xs" onClick={yedegiGeriYukle} startIcon={<History />}>
                  Geri yükle
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    sil();
                    setYedekKapandi(true);
                  }}
                >
                  Yok say
                </Button>
              </>
            }
          >
            {new Date(yedek.zaman).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" })} tarihli
            yazdıkların kaydedilmeden kalmış.
            {sunucuDahaYeni
              ? " Yazı bu yedekten sonra başkası tarafından (ya da başka sekmede) kaydedilmiş; geri yüklersen o değişikliklerin üzerine yazarsın. Önce Sürümler'den son hâline bakabilirsin."
              : ""}
            {yedek.gorselsiz ? " Gömülü görseller yedeğe sığmadı, onları yeniden eklemen gerekecek." : ""}
          </Alert>
        ) : null}
        {state.conflict ? (
          <Alert
            variant="warning"
            title="Bu yazı sen açtıktan sonra değiştirildi"
            action={
              <>
                <Button size="xs" onClick={yedekleVeYenile} startIcon={<RefreshCw />}>
                  Yenile, yazdıklarım yedekte kalsın
                </Button>
                <Button size="xs" variant="danger-outline" disabled={kilitli} onClick={uzerineYaz}>
                  Yine de kaydet (üzerine yaz)
                </Button>
              </>
            }
          >
            <p>
              {state.conflict.byMe ? "Sen (başka bir sekmede ya da cihazda)" : (state.conflict.by ?? "Başka biri")}{" "}
              {relative(state.conflict.at)} kaydetti{state.conflict.what ? `: ${state.conflict.what}` : ""}. Onun değişikliklerinin
              üzerine yazmamak için kayıt yapılmadı.
            </p>
            <p className="mt-2 text-theme-xs">
              Yeniledikten sonra çıkan kutudan &quot;Geri yükle&quot; ile yazdıklarını getirip iki hâli birleştirebilirsin; eski hâller
              Sürümler&apos;de duruyor.
            </p>
          </Alert>
        ) : state.error ? (
          <Alert variant="error">{state.error}</Alert>
        ) : null}

        <Field label="Başlık" error={state.fields?.title} required>
          <Input
            name="title"
            defaultValue={ilk.title}
            required
            maxLength={500}
            readOnly={readOnly}
            large
            className="font-display font-semibold"
            placeholder="Yazının başlığı"
          />
        </Field>

        <div>
          <span id="icerik-etiketi" className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium text-gray-700">
            İçerik
            {state.fields?.content ? <span className="text-theme-xs text-error-600">{state.fields.content}</span> : null}
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
            <SayacliIpucu metin="Liste kartlarında ve paylaşım önizlemelerinde görünür. 1-2 cümle.">
              <Sayac uzunluk={deger.excerpt.trim().length} ideal={[70, 160]} />
            </SayacliIpucu>
          }
        >
          <TextArea name="excerpt" defaultValue={ilk.excerpt} rows={3} maxLength={1000} readOnly={readOnly} />
        </Field>

        <ComponentCard title="Arama motoru" desc="Boş bırakılırsa başlık ve özet kullanılır; başlığı değiştirirsen burası da izler.">
          <Field
            label="Meta başlık"
            optional
            hint={
              <SayacliIpucu metin="Google'da görünen başlık. 30-60 karakter idealdir.">
                <Sayac uzunluk={etkinBaslik.length} ideal={[30, 60]} bos="başlık bekleniyor" />
              </SayacliIpucu>
            }
          >
            <Input name="meta_title" defaultValue={ilk.meta_title} maxLength={255} readOnly={readOnly} placeholder={deger.title || "Boşsa yazının başlığı"} />
          </Field>
          <Field
            label="Meta açıklama"
            optional
            hint={
              <SayacliIpucu metin="Sonuçta başlığın altındaki iki satır. 120-160 karakter idealdir.">
                <Sayac uzunluk={etkinAciklama.length} ideal={[120, 160]} bos="açıklama yok" />
              </SayacliIpucu>
            }
          >
            <TextArea
              name="meta_description"
              defaultValue={ilk.meta_description}
              rows={2}
              maxLength={320}
              readOnly={readOnly}
              placeholder={deger.excerpt || "Boşsa özet kullanılır"}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Arama sonucunda böyle görünür</p>
            <AramaOnizlemesi baslik={etkinBaslik} aciklama={etkinAciklama} yol={yol} />
          </div>
        </ComponentCard>
      </div>

      <aside className="space-y-6">
        <ComponentCard
          title="Yayın"
          badge={
            <Badge size="sm" color={yayinda ? "success" : "warning"}>
              {yayinda ? "Yayında" : blog ? "Taslak" : "Yeni"}
            </Badge>
          }
          desc={yayinda ? "Sitede görünüyor. Güncelle, değişiklikleri hemen yayına alır." : "Taslak sitede görünmez; yalnızca personel görür."}
        >
          {!readOnly ? (
            <div className="grid gap-2">
              {yayinda ? (
                <>
                  <Button type="submit" block loading={pending} disabled={kilitli} startIcon={<Save />}>
                    Güncelle
                  </Button>
                  <Button type="submit" name="yayin" value="0" variant="ghost" block disabled={kilitli} startIcon={<EyeOff />} onClick={taslagaAl}>
                    Taslağa al
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" name="yayin" value="1" block loading={pending} disabled={kilitli} startIcon={<Send />}>
                    Yayınla
                  </Button>
                  <Button type="submit" variant="outline" block disabled={kilitli} startIcon={<Save />}>
                    {blog ? "Taslağı kaydet" : "Taslak olarak kaydet"}
                  </Button>
                </>
              )}
              <p role="status" className="mt-1 flex items-center justify-center gap-1.5 text-theme-xs text-gray-500">
                {pending ? (
                  "Kaydediliyor…"
                ) : degisti ? (
                  <>
                    <span aria-hidden className="size-1.5 rounded-full bg-warning-500" /> Kaydedilmemiş değişiklikler
                  </>
                ) : yuklenenGorsel > 0 ? (
                  "Görsel yükleniyor…"
                ) : (
                  "Kısayol: Ctrl+S / ⌘S kaydeder"
                )}
              </p>
            </div>
          ) : null}

          {blog ? (
            <div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <Link
                  href={`/admin/blog/${blog.id}/onizleme`}
                  target="_blank"
                  className="flex items-center gap-1.5 text-theme-sm font-medium text-brand-500 hover:text-brand-600"
                >
                  <Eye className="size-3.5" aria-hidden /> Önizle
                </Link>
                {yayinUrl ? (
                  <Link href={yayinUrl} target="_blank" className="flex items-center gap-1.5 text-theme-sm font-medium text-brand-500 hover:text-brand-600">
                    Sitede gör <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                ) : null}
              </div>
              {degisti ? <p className="mt-1 text-center text-theme-xs text-gray-500">Önizleme son kaydedilen hâli gösterir; önce kaydet.</p> : null}
            </div>
          ) : null}

          <div className="space-y-5 border-t border-gray-100 pt-5">
            <Field label="Dil">
              <Select name="locale" defaultValue={ilk.locale} disabled={readOnly}>
                {Object.entries(DIL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
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
                <Input
                  name="slug"
                  defaultValue={ilk.slug}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  minLength={3}
                  maxLength={120}
                  readOnly={readOnly}
                  className="font-mono"
                />
              </Field>
            ) : (
              <p className="text-theme-xs text-gray-500">
                Adres başlıktan üretilir: <span className="font-mono text-gray-700">{yol}</span>
              </p>
            )}
          </div>
        </ComponentCard>

        <ComponentCard title="Kapak görseli" desc="1200×630 önerilir. JPEG, PNG veya WebP; 10 MB'a kadar.">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {kapak ? (
              // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob) ve backend kapağı; next/image gerekmiyor
              <img src={kapak} alt="" className="aspect-[1.9/1] w-full object-cover" />
            ) : (
              <div className="flex aspect-[1.9/1] items-center justify-center text-gray-400">
                <ImageOff className="size-6" aria-hidden />
                <span className="sr-only">Kapak görseli yok</span>
              </div>
            )}
          </div>
          {!readOnly ? (
            <Dropzone
              name="cover"
              accept={KAPAK_TURLERI}
              maxSize={KAPAK_SINIRI}
              compact
              ariaLabel="Kapak görseli seç ya da sürükle bırak"
              title={kapak ? "Yeni kapağı buraya sürükle" : "Kapağı buraya sürükle"}
              description="ya da bilgisayarından seç"
              browseLabel="Görsel seç"
              error={state.fields?.cover}
              onFilesChange={(dosyalar) => {
                const f = dosyalar[0];
                setOnizleme(f ? URL.createObjectURL(f) : null);
                if (f) setKapakSil(false);
                degisiklik();
              }}
            />
          ) : null}
          {kapak ? (
            <div>
              <Field
                label="Görsel açıklaması (alt metin)"
                optional
                hint={
                  <SayacliIpucu metin="Görmeyen okur ve arama motoru için görselde ne olduğunu bir cümleyle yaz. Boşsa başlık kullanılır.">
                    <Sayac uzunluk={deger.image_alt.trim().length} ideal={[1, 125]} bos="isteğe bağlı" uzunNotu=" · uzun, ekran okuyucu böler" />
                  </SayacliIpucu>
                }
              >
                {/* Öneri vurgusu sarmalayıcıda: alanın kendi kenar rengiyle çakışmasın. */}
                <div className={altOnerisi ? "rounded-lg ring-3 ring-brand-500/25" : undefined}>
                  <Input
                    name="image_alt"
                    defaultValue={ilk.image_alt}
                    maxLength={200}
                    readOnly={readOnly}
                    placeholder="Örn. Masada açık bir matematik defteri ve kalem"
                  />
                </div>
              </Field>
              {altOnerisi ? (
                <p className="mt-1.5 text-theme-sm font-medium text-brand-500">
                  Yeni kapak seçtin: ne gösterdiğini kısaca yazman önerilir (zorunlu değil).
                </p>
              ) : null}
            </div>
          ) : null}
          {!readOnly && blog?.image ? (
            <Checkbox name="remove_cover" value="1" checked={kapakSil} onChange={(e) => setKapakSil(e.target.checked)} label="Kapağı kaldır" />
          ) : null}
        </ComponentCard>

        <ComponentCard title="Etiketler">
          <Field label="Etiketler" hint="Virgülle ayır: tyt, matematik, çalışma planı">
            <Input name="tags" defaultValue={ilk.tags} readOnly={readOnly} />
          </Field>
        </ComponentCard>
      </aside>
    </form>
  );
}
