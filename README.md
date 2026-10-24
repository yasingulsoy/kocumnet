# Koçum.Net

![Koçum.Net](design/brand/svg/logo-otomatik.svg)

Sınav koçluğu sitesi, matematik check-up uygulaması ve iki yönetim paneli. Dört proje
aynı depoda durur ama **her biri kendi başına derlenir ve yayına alınır** (Dokploy her
klasörü ayrı derler; kökte workspace yok).

| Klasör | Ne | Üretim adresi | Yerel port |
| --- | --- | --- | --- |
| [`frontend/`](frontend) | Tanıtım sitesi (TR kökte, `/en`, `/ar` RTL) + site yönetimi `/admin` | kocum.net | 3000 |
| [`backend/`](backend) | API: blog, iletişim mesajları, personel hesapları, posta | api.kocum.net | 5000 |
| [`app/`](app) | Matematik Check-up: öğrenci uygulaması | checkup.kocum.net | 3100 |
| [`admin/`](admin) | Check-up yönetim paneli: sorular, kazanımlar, öğrenciler | admin.kocum.net | 3001 |
| [`design/`](design) | Ortak tasarım belirteçleri ve marka kiti "Fosfor" | | |

## Veritabanları

Aynı PostgreSQL sunucusunda iki ayrı veritabanı:

- **`kocumnet`**: backend'in. Blog, iletişim mesajları, personel hesapları.
- **`kocumnet_checkup`**: check-up'ın. Öğrenciler, sorular, oturumlar, sonuçlar.
  Şemanın ve migration'ların sahibi `app/`. `admin/` aynı veritabanına bağlanır ama
  şemanın yalnızca kopyasını kullanır (`npm run checkup:sync`).

Personel tek yerde, backend'de durur. Site yönetimi ve check-up paneli aynı
`admin_access_token` çerezini kullanır; üretimde backend VE frontend'de `AUTH_COOKIE_DOMAIN=.kocum.net` şart
(ikisi de giriş çerezini yazıyor).

## Yerelde çalıştırma

Her projede `.env.example`'ı kopyalayıp doldurun. Değişkenlerin açıklamaları o dosyalarda. Her adım ayrı bir terminalde, depo kökünden başlar.

```bash
# 1. API (önce veritabanı ve ilk yönetici)
cd backend && npm install
npm run db:ensure && npm run seed:admin
npm run dev                      # :5000

# 2. Site + site yönetimi
cd frontend && npm install && npm run dev            # :3000

# 3. Check-up
cd app && npm install
npm run db:migrate && npm run db:seed && npm run db:seed:demo && npm run db:seed:levels
npm run dev -- --port 3100

# 4. Check-up paneli
cd admin && npm install && npm run dev               # :3001
```

Geliştirmede posta göndermeden davet ve sıfırlama akışlarını denemek için
backend ve app'te `SMTP_URL=log://console`: postalar sunucu günlüğüne yazılır.

### Paket eklerken: kilit dosyası npm 10 ile

CI (Node 22) ve Dokploy (Nixpacks, Node 20 ve 22) **npm 10** kullanıyor. npm 11, isteğe
bağlı paketlerin bazı bağımlılıklarını kilit dosyasına yazmıyor (`@floating-ui/dom`,
`@emnapi/*` gibi). Yerelde her şey çalışır ama yayında `npm ci` şu hatayla düşer:
`Missing: <paket> from lock file`. Paket eklerken ya da çıkarırken npm 10 kullanın:

```bash
npx npm@10.9.4 install <paket>
```

Kilit npm 11 ile değiştiyse aynı komutu paket adı vermeden `--package-lock-only` ile
çalıştırmak düzeltir. npm 10'un yazdığı kilidi npm 11 de sorunsuz okur.

## Doğrulama

GitHub Actions her push'ta ve PR'da aşağıdakilerin hepsini çalıştırır
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)); yerelde de aynı komutlar:

| Proje | Komutlar |
| --- | --- |
| frontend | `npx next typegen` · `npx tsc --noEmit` · `npx eslint .` · `npm run build` · `npm run i18n:check` (üç sözlük aynı anahtarlar) · `npm run test:ip` |
| admin | `npm run checkup:check` (şema kopyası eşit mi) · `npx next typegen` · `npx tsc --noEmit` · `npx eslint .` · `npm run build` |
| app | `npx next typegen` · `npx tsc --noEmit` · `npx eslint .` · `npm run build` |
| app, veritabanıyla | `npx prisma migrate deploy` · `npx prisma migrate diff --config prisma7.config.ts --from-config-datasource --to-schema prisma/schema.prisma --exit-code` (şema ile migration'lar eşit mi) · tohumlar (`db:seed`, `db:seed:demo`, `db:seed:levels`) · `npm run smoke` · `test:markup` · `test:ip` · `test:import` · `test:deneme-panel` · `test:leak` · `test:levels` · `test:practice` · `test:veli` · `test:deneme` · `test:ogrenme` · `test:odev` · `test:plan` · `test:tutarlilik` |
| backend | Sözdizimi (`node --check`, her dosya) · posta şablonu · `npm run test:ip`. TypeScript ve derleme adımı yok. |
| backend, veritabanı ve çalışan sunucuyla | `npm run db:ensure` · `npm run seed:admin` · sunucu arka planda · `npm run smoke` · `npm run test:contact` |
| kök | `node design/sync.mjs --check` (tasarım ve marka kopyaları eşit mi) |

Veritabanı isteyen testleri **geçici bir veritabanında** koşun. Check-up testleri
`DATABASE_URL` yerel bir sunucuyu göstermiyorsa ya da `NODE_ENV=production` ise durur
(`app/scripts/_koruma.mts`; bilerek: `-- --zorla`). Backend'in `test:contact`'ı adında
`test` geçmeyen veritabanında çalışmaz; `smoke` görsel temizliğini sınadığı için
`backend/uploads/media` altındaki, o veritabanında geçmeyen görselleri siler.

`test:leak` öğrenciye giden veride cevap anahtarı olmadığını denetler; bozulursa
yayına çıkmayın. `test:veli` girişsiz veli raporunda soru metni, cevap anahtarı ve
e-posta olmadığını denetler; o da bozulursa yayına çıkmayın. Bu kuralı şimdilik hiçbir
şey zorlamıyor: Dokploy'da dağıtım elle yapılıyor, dağıtmadan önce main'deki son CI
koşusunun yeşil olduğuna bakın (main'de koşular birbirini iptal etmez).

## Tasarım ve marka

Renk, yazı tipi, ölçek ve köşe değerleri tek kaynaktan gelir: [`design/tokens.css`](design/tokens.css).
Logo, ikonlar ve paylaşım görselleri [`design/brand`](design/brand) altında; rehber
`design/brand/index.html`. Kopyalar elle düzenlenmez:

```bash
node design/sync.mjs
```

## Belgeler

- [`app/README.md`](app/README.md), [`app/PLAN.md`](app/PLAN.md): check-up'ın koçluk modeli ve kararları
- [`app/SORU-SABLONU.md`](app/SORU-SABLONU.md): soru dosyası biçimi (`npm run import:questions`)
- [`admin/CHECKUP.md`](admin/CHECKUP.md): panelin kimlik doğrulaması ve yetkiler
- `*/DEPLOY.md`: her projenin yayına alma notları
- [`HOCAYA-SORULAR.md`](HOCAYA-SORULAR.md): içerik kararları için açık sorular
- [`docs/arsiv/`](docs/arsiv): eski günlük raporlar (tarihsel; yazıldıkları günü anlatır, güncel değil)
