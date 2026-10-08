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
`admin_access_token` çerezini kullanır; üretimde backend'de `AUTH_COOKIE_DOMAIN=.kocum.net` şart.

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

| Proje | Komutlar |
| --- | --- |
| Hepsi | `npx tsc --noEmit` · `npx eslint .` · `npm run build` |
| app | `npm run smoke` · `npm run test:markup` · `npm run test:leak` · `npm run test:levels` |
| admin | `npm run checkup:check` (şema kopyası eşit mi) |
| backend | `npm run smoke` (çalışan sunucuya istek atar) |
| kök | `node design/sync.mjs --check` (tasarım ve marka kopyaları eşit mi) |

GitHub Actions her push'ta bunları çalıştırır: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
`test:leak` öğrenciye giden veride cevap anahtarı olmadığını denetler; bozulursa
yayına çıkmayın.

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
