"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { cx } from "@/components/tailadmin/cx";
import { usePrompt, type PromptOptions } from "@/components/tailadmin/ui/Dialogs";
import { uploadBlogImageAction } from "@/lib/admin/actions";
import { PUBLIC_BACKEND_URL } from "@/lib/api";

/**
 * Blog editörü (Tiptap / ProseMirror).
 *
 * Çıktı düz HTML: backend sanitize-html'den geçirir (p, h2-h4, listeler,
 * alıntı, kod, bağlantı, görsel, tablo). Burada izin verilen araçlar o
 * listeyle sınırlı tutuldu — editörün ürettiği hiçbir şey sunucuda silinmesin.
 *
 * Görseller SEÇİLİR SEÇİLMEZ yüklenir (araç çubuğu, yapıştırma, sürükle-bırak):
 * BFF üzerinden backend'e gider, en fazla 1600 px WebP'ye çevrilir, içeriğe
 * yalnızca adresi girer. Eskiden base64 gömülüyordu; büyük yazıda 12 MB gövde
 * sınırı ve tarayıcı yedeğinin kotası doluyordu. Eski base64 içerikler
 * açılmaya ve kaydedilmeye devam eder (backend kayıtta dosyaya çevirir).
 *
 * Görünüm TailAdmin kitinin form alanlarıyla aynı: gri kenar, odakta marka
 * rengi kenar + halka; araç çubuğu gri şerit. Bağlantı adresi ve görsel
 * açıklaması kitin metin penceresiyle sorulur (eskiden window.prompt).
 */

const IZINLI_TURLER = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EN_BUYUK = 10 * 1024 * 1024;

/** Panodan ya da sürüklenen dosyalardan görseller. */
function gorselDosyalari(dt: DataTransfer | null | undefined): File[] {
  return Array.from(dt?.files ?? []).filter((f) => f.type.startsWith("image/"));
}

function Arac({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cx(
        "flex size-8 cursor-pointer items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
        active ? "bg-brand-50 text-brand-500" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      )}
    >
      {children}
    </button>
  );
}

const Ayrac = () => <span aria-hidden className="mx-1 h-5 w-px bg-gray-200" />;

function Toolbar({
  editor,
  yukleniyor,
  onGorselSec,
  sor,
}: {
  editor: TiptapEditor;
  yukleniyor: number;
  onGorselSec: (dosyalar: File[]) => void;
  sor: (o: PromptOptions) => Promise<string | null>;
}) {
  const dosya = useRef<HTMLInputElement>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      link: e.isActive("link"),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });

  async function baglanti() {
    const mevcut = editor.getAttributes("link").href as string | undefined;
    // Pencere açılınca seçim editörde kalır (ProseMirror odağı kaybetse de seçimi tutar).
    const url = await sor({
      title: mevcut ? "Bağlantıyı düzenle" : "Bağlantı ekle",
      description: "Seçili metin bağlantı olur. Boş bırakıp kaydedersen bağlantı kaldırılır.",
      label: "Bağlantı adresi",
      defaultValue: mevcut ?? "https://",
      placeholder: "https://…",
      inputMode: "url",
      confirmLabel: "Kaydet",
      allowEmpty: true,
    });
    if (url === null) return;
    const temiz = url.trim();
    if (!temiz || temiz === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: temiz }).run();
  }

  function gorsel(e: ChangeEvent<HTMLInputElement>) {
    const secilen = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (secilen.length) onGorselSec(secilen);
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5" role="toolbar" aria-label="Biçimlendirme">
      <Arac label="Kalın" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </Arac>
      <Arac label="İtalik" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </Arac>
      <Arac label="Altı çizili" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline />
      </Arac>
      <Arac label="Üstü çizili" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough />
      </Arac>
      <Ayrac />
      <Arac label="Başlık 2" active={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </Arac>
      <Arac label="Başlık 3" active={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </Arac>
      <Ayrac />
      <Arac label="Madde listesi" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List />
      </Arac>
      <Arac label="Numaralı liste" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered />
      </Arac>
      <Arac label="Alıntı" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote />
      </Arac>
      <Arac label="Kod bloğu" active={s.code} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 />
      </Arac>
      <Arac label="Yatay çizgi" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus />
      </Arac>
      <Ayrac />
      <Arac label={s.link ? "Bağlantıyı düzenle" : "Bağlantı ekle"} active={s.link} onClick={() => void baglanti()}>
        {s.link ? <Link2Off /> : <Link2 />}
      </Arac>
      <Arac label="Görsel ekle (yapıştırabilir ya da sürükleyebilirsin)" onClick={() => dosya.current?.click()}>
        <ImagePlus />
      </Arac>
      <input ref={dosya} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={gorsel} />
      {yukleniyor > 0 ? (
        <span role="status" className="ms-1 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-theme-xs font-medium text-brand-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {yukleniyor > 1 ? `${yukleniyor} görsel yükleniyor…` : "Görsel yükleniyor…"}
        </span>
      ) : null}
      <span className="flex-1" />
      <Arac label="Geri al" disabled={!s.undo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="rtl:-scale-x-100" />
      </Arac>
      <Arac label="Yinele" disabled={!s.redo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="rtl:-scale-x-100" />
      </Arac>
    </div>
  );
}

/** Kelime sayısı ve okuma süresi (sitedeki hesapla aynı: 200 kelime/dk). */
function Sayac({ editor }: { editor: TiptapEditor }) {
  const kelime = useEditorState({
    editor,
    selector: ({ editor: e }) => e.state.doc.textContent.split(/\s+/).filter(Boolean).length,
  });
  return (
    <div className="tabular flex justify-end border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-theme-xs text-gray-500" aria-live="off">
      {kelime.toLocaleString("tr-TR")} kelime · ~{Math.max(1, Math.ceil(kelime / 200))} dk okuma
    </div>
  );
}

export function Editor({
  name,
  initialHtml,
  invalid,
  editable = true,
  onChange,
  onReady,
  labelledBy,
  onUploadingChange,
}: {
  /** Gizli alanın adı — form gönderiminde HTML bu adla gider. */
  name: string;
  initialHtml: string;
  invalid?: boolean;
  /** false: salt okunur (görüntüleyici rolü). */
  editable?: boolean;
  /** İçerik her değiştiğinde (kaydedilmemiş değişiklik izi). */
  onChange?: () => void;
  /** Editör hazır olunca: dışarıdan içerik yüklemek için (yerel yedeği geri yükleme). */
  onReady?: (editor: TiptapEditor) => void;
  /** Ekran okuyucu için alanın etiketi (görünür "İçerik" başlığının id'si). */
  labelledBy?: string;
  /** Süren görsel yükleme sayısı (form, yükleme bitmeden kaydetmesin). */
  onUploadingChange?: (adet: number) => void;
}) {
  const [html, setHtml] = useState(initialHtml);
  const [yukleniyor, setYukleniyor] = useState(0);
  const [gorselHatasi, setGorselHatasi] = useState<string | null>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  const [soruPenceresi, sor] = usePrompt();

  useEffect(() => {
    onUploadingChange?.(yukleniyor);
  }, [yukleniyor, onUploadingChange]);

  /**
   * Görselleri sırayla yükleyip ekler. `konum` verilirse (sürükle-bırak)
   * oraya, yoksa imlecin olduğu yere. Yalnızca ref, setState ve kararlı
   * `sor` kullanır: editör seçeneklerindeki (yapıştır/bırak) ilk kapanış da
   * güncel çalışır.
   */
  const yukleVeEkle = useCallback(
    async (dosyalar: File[], konum?: number) => {
      setGorselHatasi(null);
      for (const dosya of dosyalar) {
        if (!IZINLI_TURLER.has(dosya.type)) {
          setGorselHatasi("Yalnızca JPEG, PNG, WebP ya da GIF eklenebilir (SVG olmaz).");
          continue;
        }
        if (dosya.size > EN_BUYUK) {
          setGorselHatasi(`Görsel 10 MB'ı aşıyor (${(dosya.size / 1024 / 1024).toFixed(1)} MB). Daha küçük bir dosya seç.`);
          continue;
        }
        // "Vazgeç" görseli eklemekten vazgeçmek demek; boş açıklama da kabul.
        const alt = await sor({
          title: "Görsel açıklaması",
          description: dosya.name ? `“${dosya.name}” için.` : undefined,
          label: "Görselde ne var? (erişilebilirlik için kısa bir cümle)",
          hint: "Görmeyen okur ve arama motoru bu metni okur. Boş bırakabilirsin.",
          placeholder: "Örn. Tahtada çözülmüş bir türev sorusu",
          confirmLabel: "Görseli ekle",
          allowEmpty: true,
          maxLength: 200,
        });
        if (alt === null) continue;
        setYukleniyor((n) => n + 1);
        try {
          const fd = new FormData();
          fd.append("image", dosya, dosya.name || "gorsel");
          const r = await uploadBlogImageAction(fd);
          if (!r.ok || !r.url) {
            setGorselHatasi(r.error ?? "Görsel yüklenemedi.");
            continue;
          }
          const ed = editorRef.current;
          if (!ed || ed.isDestroyed) continue;
          const ozellikler = { src: `${PUBLIC_BACKEND_URL}${r.url}`, alt, width: r.width, height: r.height };
          if (konum !== undefined && konum <= ed.state.doc.content.size) {
            ed.chain().focus().insertContentAt(konum, { type: "image", attrs: ozellikler }).run();
          } else {
            ed.chain().focus().setImage(ozellikler).run();
          }
        } catch {
          setGorselHatasi("Görsel yüklenemedi: sunucuya ulaşılamadı. Biraz sonra yeniden dene.");
        } finally {
          setYukleniyor((n) => n - 1);
        }
      }
    },
    [sor]
  );

  const editor = useEditor({
    // SSR'da çizim yok: sunucu HTML'i ile istemci arasındaki uyumsuzluğu önler.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ allowBase64: true, inline: false }),
      Placeholder.configure({
        placeholder: "Yazmaya başla… Başlıklar için H2/H3. Görseli araç çubuğundan ekle, yapıştır ya da sürükle.",
      }),
    ],
    content: initialHtml,
    editable,
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm max-w-none min-h-[380px] px-4 py-3 text-gray-800 focus:outline-none sm:prose-base " +
          "prose-headings:font-display prose-headings:text-gray-800 prose-a:text-brand-500 prose-img:rounded-xl",
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
      },
      // Yalnızca görsel yapıştırılırsa (ekran görüntüsü) yükle. Metinle karışık
      // yapıştırmada (Word, web sayfası) tarayıcının HTML'i kullanılır.
      handlePaste: (_view, event) => {
        const dosyalar = gorselDosyalari(event.clipboardData);
        if (!dosyalar.length || event.clipboardData?.getData("text/html")) return false;
        event.preventDefault();
        void yukleVeEkle(dosyalar);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const dosyalar = gorselDosyalari(event.dataTransfer);
        if (!dosyalar.length) return false;
        event.preventDefault();
        const yer = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void yukleVeEkle(dosyalar, yer?.pos);
        return true;
      },
    },
    onCreate: ({ editor: e }) => {
      editorRef.current = e;
      onReady?.(e);
    },
    onUpdate: ({ editor: e }) => {
      setHtml(e.getHTML());
      onChange?.();
    },
  });

  return (
    <div
      className={cx(
        "overflow-hidden rounded-lg border bg-white shadow-theme-xs transition focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/20",
        invalid ? "border-error-500" : "border-gray-300"
      )}
    >
      {soruPenceresi}
      {!editable ? null : editor ? (
        <Toolbar editor={editor} yukleniyor={yukleniyor} onGorselSec={(d) => void yukleVeEkle(d)} sor={sor} />
      ) : (
        <div className="h-11 border-b border-gray-200 bg-gray-50" />
      )}
      {gorselHatasi ? (
        <p role="alert" className="flex items-start justify-between gap-3 border-b border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700">
          {gorselHatasi}
          <button
            type="button"
            onClick={() => setGorselHatasi(null)}
            aria-label="Uyarıyı kapat"
            className="-me-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-error-100"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </p>
      ) : null}
      <EditorContent editor={editor} />
      {editor ? <Sayac editor={editor} /> : null}
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
