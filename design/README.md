# design/ — ortak tasarım sistemi

Üç yüzey tek dil konuşur: **kocum.net** (tanıtım + `/admin` site yönetimi),
**checkup.kocum.net** (öğrenci uygulaması) ve **admin.kocum.net** (check-up paneli).

```
design/
  tokens.css          TEK KAYNAK: renk, yazı tipi, ölçek, köşe, gölge, taban kuralları
  sync.mjs            tokens.css'i üç projeye kopyalar; --check eşitliği doğrular
  logo/
    mark.svg          Marka işareti (K + yükselen nokta) — tüm yüzeylerde aynı
    mark-mono-*.svg   Tek renk sürümler (baskı, damga)
    favicon-16.svg    16px için ayrı çizim (gradyansız, kalın çizgi)
    build-icons.mjs   icon.svg, apple-icon.png, PWA ikonlarını üç projeye üretir
  fonts/              OFL lisanslı TTF'ler (Open Graph görseli için; web fontları next/font'tan gelir)
```

## Günlük kullanım

```bash
node design/sync.mjs          # tokens.css değişince: kopyala
node design/sync.mjs --check  # build öncesi: kopyalar güncel mi?
node design/logo/build-icons.mjs   # işaret değişince ikonları yeniden üret
```

Kopya dosyalar (`frontend/app/tokens.css`, `app/app/tokens.css`,
`admin/src/app/tokens.css`) **elle düzenlenmez**.

## Kararlar

| Konu | Karar | Neden |
| --- | --- | --- |
| Renk | Lacivert `#17305e` · mavi `#1a5fb4` · camgöbeği `#0e90d5`; nötrler mavi tonlu | Üç yüzey tek parça görünsün; saf gri "başka ürün" hissi veriyor |
| Yazı | **Poppins** başlık (logodaki yazıyla aynı) + **Inter** gövde | Inter: tablo rakamları hizalı, 13px'te okunur, Türkçe tam. Fraunces (serif) ve Geist kaldırıldı |
| Logo | Yön 2: K'nın üst kolu yükselen çizgi + nokta | Koç yön gösterir ve yükseltir; 16px'te K olarak okunur |
| Koyu tema | Yok | Soru görselleri beyaz zeminli, KaTeX açık zemine ayarlı |
| Yoğunluk | Aynı belirteç adı, yüzeye göre değer | Uygulama/panel `:root { --text-h1: 1.75rem }` ile başlıkları küçültür; ölçek bu yüzden `@theme inline` değil |
| Köşe | Tailwind varsayılanından bir kademe yumuşak | `rounded-2xl` kart (20px), `rounded-xl` düğme/giriş (14px) |

Bileşenlerde ham hex yazılmaz. İstisnalar: SVG `fill`, üçüncü taraf marka
renkleri (Instagram vb.), `themeColor` meta, e-posta şablonları (satır içi CSS
zorunlu — `backend/utils/mailer.js`, `app/lib/mailer.ts`).

## Yeni bir yüzey eklenirse

1. `sync.mjs` içindeki `HEDEFLER` listesine kopya yolunu ekle.
2. Kök layout'ta `next/font` ile `--font-inter` ve `--font-poppins` değişkenlerini tanımla
   (`subsets: ["latin", "latin-ext"]` — Türkçe harfler için şart).
3. `globals.css`: `@import "tailwindcss"; @import "./tokens.css";` sonra yüzeye özgü kurallar.
4. `build-icons.mjs` içindeki `projeler` listesine ekle.
