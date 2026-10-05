"use client";

import { useRef, useState, type ReactNode } from "react";
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
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Blog editörü (Tiptap / ProseMirror).
 *
 * Çıktı düz HTML: backend sanitize-html'den geçirir (p, h2-h4, listeler,
 * alıntı, kod, bağlantı, görsel, tablo). Burada izin verilen araçlar o
 * listeyle sınırlı tutuldu — editörün ürettiği hiçbir şey sunucuda silinmesin.
 *
 * Görseller: dosya seçilir, tarayıcıda en fazla 1600px'e küçültülüp WebP'ye
 * çevrilir ve base64 olarak gömülür; backend kayıtta dosyaya yazar ve
 * /uploads/blogs/{id}/… adresine çevirir. Küçültme olmadan 4 MB'lık bir
 * telefon fotoğrafı 5,5 MB JSON demekti.
 */

const EN_GENIS = 1600;

async function kucult(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const oran = Math.min(1, EN_GENIS / bitmap.width);
  const w = Math.round(bitmap.width * oran);
  const h = Math.round(bitmap.height * oran);
  const tuval = document.createElement("canvas");
  tuval.width = w;
  tuval.height = h;
  tuval.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return tuval.toDataURL("image/webp", 0.86);
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
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface-hover hover:text-ink disabled:opacity-40 [&_svg]:size-4",
        active && "bg-brand-wash text-brand"
      )}
    >
      {children}
    </button>
  );
}

const Ayrac = () => <span aria-hidden className="mx-1 h-5 w-px bg-line" />;

function Toolbar({ editor }: { editor: TiptapEditor }) {
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

  function baglanti() {
    const mevcut = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Bağlantı adresi (https://…)", mevcut ?? "https://");
    if (url === null) return;
    const temiz = url.trim();
    if (!temiz || temiz === "https://") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: temiz }).run();
  }

  async function gorsel(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    const alt = window.prompt("Görsel açıklaması (erişilebilirlik için kısa bir cümle)", "") ?? "";
    let src: string;
    try {
      src = await kucult(f);
    } catch {
      // Ör. HEIC bazı tarayıcılarda açılmıyor; sessizce hiçbir şey olmamasın.
      window.alert("Bu görsel açılamadı. JPEG, PNG ya da WebP olarak kaydedip yeniden dene.");
      return;
    }
    editor.chain().focus().setImage({ src, alt }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-surface-sunk px-2 py-1.5">
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
      <Arac label={s.link ? "Bağlantıyı düzenle" : "Bağlantı ekle"} active={s.link} onClick={baglanti}>
        {s.link ? <Link2Off /> : <Link2 />}
      </Arac>
      <Arac label="Görsel ekle" onClick={() => dosya.current?.click()}>
        <ImagePlus />
      </Arac>
      <input ref={dosya} type="file" accept="image/*" className="hidden" onChange={gorsel} />
      <span className="flex-1" />
      <Arac label="Geri al" disabled={!s.undo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 />
      </Arac>
      <Arac label="Yinele" disabled={!s.redo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 />
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
    <div className="tabular flex justify-end border-t border-line bg-surface-sunk px-3 py-1.5 text-micro text-ink-faint" aria-live="off">
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
}) {
  const [html, setHtml] = useState(initialHtml);

  const editor = useEditor({
    // SSR'da çizim yok: sunucu HTML'i ile istemci arasındaki uyumsuzluğu önler.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ allowBase64: true, inline: false }),
      Placeholder.configure({ placeholder: "Yazmaya başla… Başlıklar için H2/H3, görsel için araç çubuğunu kullan." }),
    ],
    content: initialHtml,
    editable,
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm max-w-none min-h-[380px] px-4 py-3 text-ink focus:outline-none sm:prose-base " +
          "prose-headings:font-display prose-headings:text-ink prose-a:text-brand prose-img:rounded-xl",
        role: "textbox",
        "aria-multiline": "true",
        ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
      },
    },
    onCreate: ({ editor: e }) => onReady?.(e),
    onUpdate: ({ editor: e }) => {
      setHtml(e.getHTML());
      onChange?.();
    },
  });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-surface shadow-card transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/12",
        invalid ? "border-bad" : "border-line-strong"
      )}
    >
      {!editable ? null : editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-line bg-surface-sunk" />}
      <EditorContent editor={editor} />
      {editor ? <Sayac editor={editor} /> : null}
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
