# Koçum.Net

![Koçum.Net](design/brand/svg/logo-otomatik.svg)

İki ayrı ürün aynı depoda: **kocum.net tanıtım sitesi** ve **Check-up programı**. Her klasör kendi başına derlenir ve yayına alınır (Dokploy her klasörü ayrı derler; kökte workspace yok).

| Klasör | Ne | Yerel port |
| --- | --- | --- |
| [`frontend/`](frontend) | Site: tanıtım sayfaları (TR kökte, `/en`, `/ar` RTL) + site yönetimi `/admin` | 3000 |
| [`backend/`](backend) | Site API'si: blog, iletişim mesajları, personel hesapları, posta | 5000 |
| [`checkup/backend`](checkup/backend) | Check-up API'si: tek veritabanı, bütün iş mantığı | 4000 |
| [`checkup/frontend`](checkup/frontend) | Check-up öğrenci uygulaması: kayıt, sınav seçimi, test, rapor | 3200 |
| [`checkup/admin`](checkup/admin) | Check-up paneli: sınavlar, türler, konu ağacı, sorular, reçete, öğrenciler | 3300 |
| [`design/`](design) | Ortak tasarım belirteçleri, marka kiti "Fosfor", TailAdmin kiti | |

Check-up'ın yapısı ve kararları [`checkup/MIMARI.md`](checkup/MIMARI.md), backend ile iki uygulama arasındaki sözleşme [`checkup/API.md`](checkup/API.md).

## Veritabanları

Aynı PostgreSQL sunucusunda ayrı veritabanları:

- **`kocumnet`**: site backend'inin. Blog, iletişim mesajları, personel hesapları.
- **Check-up veritabanı**: yalnızca `checkup/backend` bağlanır. Şema ve migration'lar `checkup/backend/prisma` altında. Frontend ve admin veritabanına hiç bağlanmaz, backend API'sini kullanır.

Site ile Check-up hesapları ayrıdır. Site personeli `backend/`'de, Check-up yöneticileri ve öğrencileri Check-up veritabanında durur.

## Yerelde çalıştırma

Her projede `.env.example`'ı kopyalayıp doldurun; değişkenlerin açıklamaları o dosyalarda. Her adım ayrı bir terminalde, depo kökünden başlar.

```bash
# Site
cd backend && npm install && npm run db:ensure && npm run seed:admin && npm run dev   # :5000
cd frontend && npm install && npm run dev                                              # :3000

# Check-up
cd checkup/backend && npm install && npm run db:deploy && npm run db:tohum:ornek && npm run dev   # :4000
cd checkup/frontend && npm install && npm run dev                                                  # :3200
cd checkup/admin && npm install && npm run dev                                                     # :3300
```

Geliştirmede posta göndermeden sıfırlama ve davet akışlarını denemek için `SMTP_URL=log://console`: postalar sunucu günlüğüne yazılır.

### Paket eklerken: kilit dosyası npm 10 ile

CI (Node 22) ve Dokploy (Nixpacks) **npm 10** kullanıyor. npm 11, isteğe bağlı paketlerin bazı bağımlılıklarını kilit dosyasına yazmıyor (`@floating-ui/dom`, `@emnapi/*` gibi). Yerelde her şey çalışır ama yayında `npm ci` şu hatayla düşer: `Missing: <paket> from lock file`. Paket eklerken ya da çıkarırken npm 10 kullanın:

```bash
npx npm@10.9.4 install <paket>
```

Kilit npm 11 ile değiştiyse aynı komutu paket adı vermeden `--package-lock-only` ile çalıştırmak düzeltir.

## Doğrulama

GitHub Actions her push'ta ve PR'da aşağıdakileri çalıştırır ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)); yerelde de aynı komutlar.

| Proje | Komutlar |
| --- | --- |
| kök | `node design/sync.mjs --check` (tasarım ve marka kopyaları eşit mi) |
| frontend | `npx next typegen` · `npx tsc --noEmit` · `npx eslint .` · `npm run build` · `npm run i18n:check` · `npm run test:ip` |
| backend | sözdizimi, posta şablonu, `test:ip`; geçici veritabanıyla `smoke` ve `test:contact` |
| checkup/backend | `npx prisma migrate deploy` · `npm run db:denetle` (şema ile migration'lar eşit mi) · `npm run typecheck` · `npm test` · `npm run build` |
| checkup/frontend, checkup/admin | `npx next typegen` · `npx tsc --noEmit` · `npx eslint .` · `npm run build` |

Check-up backend testleri `TEST_DATABASE_BASE_URL` sunucusunda geçici bir veritabanı açar ve iş bitince siler. Testlerden biri öğrenciye giden test verisinde cevap anahtarı olmadığını denetler: bozulursa yayına çıkmayın. Dokploy'da dağıtım elle yapılıyor; dağıtmadan önce main'deki son CI koşusunun yeşil olduğuna bakın.

## Tasarım ve marka

Renk, yazı tipi, ölçek ve köşe değerleri tek kaynaktan gelir: [`design/tokens.css`](design/tokens.css). Logo, ikonlar ve paylaşım görselleri [`design/brand`](design/brand) altında; rehber `design/brand/index.html`. Kopyalar elle düzenlenmez:

```bash
node design/sync.mjs
```

## Belgeler

- [`checkup/MIMARI.md`](checkup/MIMARI.md): Check-up'ın parçaları, kullanıcı kararları, teknik düzen
- [`checkup/API.md`](checkup/API.md): Check-up API sözleşmesi
- `*/DEPLOY.md`, `*/README.md`: projelerin yayına alma ve çalıştırma notları
- [`docs/arsiv/`](docs/arsiv): eski günlük raporlar (tarihsel; yazıldıkları günü anlatır, güncel değil)
