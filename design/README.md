# design/ — ortak tasarım sistemi

Üç yüzey tek dil konuşur: **kocum.net** (tanıtım + `/admin` site yönetimi),
**checkup.kocum.net** (öğrenci uygulaması) ve **admin.kocum.net** (check-up paneli).

```
design/
  tokens.css          TEK KAYNAK: renk, yazı tipi, ölçek, köşe, gölge, taban kuralları
  sync.mjs            tokens.css'i ve marka dosyalarını üç projeye kopyalar; --check eşitliği doğrular
  brand/              Marka kiti "Fosfor": logo, ikon, favicon, e-posta ve sosyal görseller
    build.mjs         Üretici (npm run marka) — ayrıntı: brand/README.md
    index.html        Marka rehberi ve indirme sayfası (tarayıcıda aç)
  fonts/              OFL lisanslı TTF'ler: logo (Baloo 2) ve görsel üretimi (Inter, Poppins)
  package.json        Üretici bağımlılıkları: opentype.js, sharp
```

## Günlük kullanım

```bash
node design/sync.mjs          # tokens.css ya da marka kiti değişince: kopyala
node design/sync.mjs --check  # build öncesi: kopyalar güncel mi?
cd design && npm install && npm run marka   # logo/ikon değişince kiti yeniden üret, sonra sync
```

Kopyalar **elle düzenlenmez**: `*/tokens.css`, `*/lib/brand-paths.ts`,
`icon.svg`, `favicon.ico`, `apple-icon.png`, `public/icons/*`, `public/brand/*`
ve `app/app/opengraph-image.png`. Tam liste `sync.mjs` içindeki `ISLER`.

## Kararlar

| Konu | Karar | Neden |
| --- | --- | --- |
| Logo | **Fosfor**: "koçum.net", "net" fosforlu kalemle çizili. Kare ikon: sarı zeminde lacivert "k" | Sınavda önemli olan net; çalışan öğrenci önemli olanın üstünü çizer. Yazı çizgiye çevrili, fonta bağlı değil |
| Marka rengi | Lacivert `#14213d` + fosforlu sarı `#ffd43b` | Sarı yalnızca vurgu (`--highlight`): kalem, `::selection`, `.marker`. Metin rengi olmaz (beyazda 1,4:1) |
| Arayüz rengi | Lacivert `#17305e` · mavi `#1a5fb4` · camgöbeği `#0e90d5`; nötrler mavi tonlu | Düğme ve bağlantılar mavi kalır; sarı düğme okunmaz. Üç yüzey tek parça görünür |
| Yazı | **Poppins** başlık + **Inter** gövde; **Baloo 2** yalnızca logoda | Inter: tablo rakamları hizalı, 13px'te okunur, Türkçe tam. Fraunces ve Geist kaldırıldı |
| Koyu tema | Yok | Soru görselleri beyaz zeminli, KaTeX açık zemine ayarlı. Logonun koyu sürümü altbilgi ve koyu zeminler için var |
| Yoğunluk | Aynı belirteç adı, yüzeye göre değer | Uygulama/panel `:root { --text-h1: 1.75rem }` ile başlıkları küçültür; ölçek bu yüzden `@theme inline` değil |
| Köşe | Tailwind varsayılanından bir kademe yumuşak | `rounded-2xl` kart (20px), `rounded-xl` düğme/giriş (14px) |

Bileşenlerde ham hex yazılmaz. İstisnalar: logo SVG'lerinin `fill`'i
(`BRAND_COLORS`), üçüncü taraf marka renkleri (Instagram vb.), `themeColor`
meta, e-posta şablonları (satır içi CSS zorunlu: `backend/utils/mailer.js`,
`app/lib/mailer.ts`).

## Yeni bir yüzey eklenirse

1. `sync.mjs` içindeki `PROJE` haritasına projenin `app`, `lib` ve `public`
   yollarını ekle. Belirteçler, logo yol verisi ve ikonlar kendiliğinden gider.
2. Kök layout'ta `next/font` ile `--font-inter` ve `--font-poppins` değişkenlerini tanımla
   (`subsets: ["latin", "latin-ext"]` — Türkçe harfler için şart).
3. `globals.css`: `@import "tailwindcss"; @import "./tokens.css";` sonra yüzeye özgü kurallar.
4. Logo bileşenini `lib/brand-paths.ts`'ten çiz; örnek `app/components/ui/logo.tsx`.
