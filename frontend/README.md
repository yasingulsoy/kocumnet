# Koçum.Net sitesi (frontend)

kocum.net: tanıtım sitesi ve site yönetimi (`/admin`). Next.js 16 (App Router), React 19,
Tailwind 4. Kök dizindeki [README](../README.md) dört projenin nasıl birlikte çalıştığını
anlatır; yayına alma notları [DEPLOY.md](DEPLOY.md)'de.

> Bu Next sürümü eğitim verilerindeki Next değil: kod yazmadan önce
> `node_modules/next/dist/docs/` altındaki ilgili rehbere bakın ([AGENTS.md](AGENTS.md)).

## Çalıştırma

```bash
cp .env.example .env.local   # değişkenlerin açıklamaları dosyada
npm install                  # paket eklerken npm 10: npx npm@10.9.4 install <paket>
npm run dev                  # http://localhost:3000
```

Blog, iletişim formu ve `/admin` için backend'in (`../backend`, varsayılan :5000) açık
olması gerekir. Backend kapalıyken site yine çizilir, blog listesi boş görünür.

## Yapı

- **Üç dil, adreste:** Türkçe kökte (`/hizmetlerimiz`), İngilizce `/en/...`, Arapça
  `/ar/...` (RTL). Bütün sayfalar `app/[lang]/` altında; Türkçe adresleri `proxy.ts`
  içeride `/tr/<kanonik>`'e yazar. Yerelleştirilmiş yol parçaları tek yerde:
  `lib/routes.ts` (yeni sayfa önce oraya eklenir, yoksa proxy tanımaz).
- **Metinler:** `lib/i18n/locales/{tr,en,ar}.json`; üçünün anahtarları birebir aynı
  olmalı (`npm run i18n:check`). Sözlükler yalnızca sunucuda yüklenir.
- **Site yönetimi `/admin`** (blog, iletişim mesajları, personel, etkinlik kaydı): BFF.
  Tarayıcı backend'le konuşmaz; sayfalar ve server action'lar backend'e sunucudan gider
  (`lib/admin/backend.ts`). Check-up yönetimi bu projede değil, `../admin`'de.
- **Gizlilik sayfası:** `app/[lang]/privacy` (TR `/gizlilik`). Metindeki olgular backend
  koduna dayanıyor; saklama süresi ya da form alanları değişirse metin de değişir.
- **Tasarım:** belirteçler `app/tokens.css` (kök `design/tokens.css`'in kopyası, elle
  düzenlenmez: `node ../design/sync.mjs`), bileşenler TailAdmin kitinden
  `components/tailadmin/`.

## Denetimler

```bash
npx next typegen && npx tsc --noEmit
npx eslint .
npm run build
npm run i18n:check   # tr, en, ar aynı anahtarlar
npm run test:ip      # istemci IP kuralı (Cloudflare + Traefik)
```

CI bunları her push'ta çalıştırır (`../.github/workflows/ci.yml`).
