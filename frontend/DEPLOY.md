# Frontend Deployment (Dokploy / Nixpacks)

## Node sürümü

Next.js 16 **Node >= 20.9** ister. Nixpacks bu ayar olmadan Node 18'e düşer ve build şu hatayla ölür:

```
You are using Node.js 18.20.5. For Next.js, Node.js version ">=20.9.0" is required.
```

Bu yüzden repoda `nixpacks.toml` (Node 20'ye sabitler) ve `package.json` içinde `engines.node` var. **Silme.**

## Build Environment Variables (ZORUNLU)

Bu iki değişken **build sırasında** tanımlı olmalı. `NEXT_PUBLIC_*` değişkenleri derleme
anında bundle'a gömülür — runtime'da set etmek İŞE YARAMAZ.

Dokploy'da: **Uygulama → Environment → Build Environment Variables**

```bash
NEXT_PUBLIC_SITE_URL=https://kocum.net
NEXT_PUBLIC_BACKEND_URL=https://api.kocum.net
```

| Değişken | Set edilmezse ne olur |
|----------|------------------------|
| `NEXT_PUBLIC_SITE_URL` | Tüm canonical, hreflang, Open Graph, `sitemap.xml`, `llms.txt` ve JSON-LD adresleri **`http://localhost:3000`** olarak gömülür. Google localhost'u indeksler. |
| `NEXT_PUBLIC_BACKEND_URL` | Blog yazıları çekilemez (liste boş kalır), blog görselleri yüklenmez, görüntülenme sayacı ve iletişim formu çalışmaz. |

İsteğe bağlı (yine **build** değişkeni):

```bash
NEXT_PUBLIC_CHECKUP_URL=https://checkup.kocum.net
```

Matematik Check-up uygulamasının adresi. **Boşsa sitede check-up'a giden hiçbir
bağlantı çıkmaz** (uygulama yayına alınmadan 404'e giden düğme durmasın diye).
Tanımlanınca tek seferde şunlar görünür: ana sayfa hero düğmesi ("Check-up'a başla")
ve check-up bölümü, başlıktaki marka şeridinde bağlantı (masaüstü), mobil menüde
düğme, altbilgide hızlı bağlantı. `http(s)://` ile başlamayan değer yok sayılır.

## Site yönetimi: `kocum.net/admin`

Blog, iletişim mesajları ve personel yönetimi bu projede, `/admin` altında. Tarayıcı
backend'le hiç konuşmaz: sayfalar ve server action'lar backend'e **sunucudan** gider
(`lib/admin/backend.ts`), personel oturumu backend'in `admin_access_token` JWT'si olarak
bu alan adına çerezlenir.

| Değişken | Nerede | Neden |
|----------|--------|-------|
| `BACKEND_URL` | runtime | Sunucudan backend'e adres (yoksa `NEXT_PUBLIC_BACKEND_URL`). |
| `AUTH_COOKIE_DOMAIN=.kocum.net` | runtime | Oturum çerezi `admin.kocum.net`'e de gitsin: iki panel arasında tek giriş. Backend'deki değerle aynı olmalı. |
| `BFF_SHARED_SECRET` | runtime | **Önerilir.** Backend'deki değerle AYNI (en az 32 karakter). Tarayıcının gerçek IP'si imzalı (HMAC) gider; backend giriş denemesi sınırlarını kişi başına uygular. Boşsa bütün personel bu sunucunun tek IP'siyle sayılır (bir kişinin yanlış denemeleri herkesi etkileyebilir). İki sunucunun saati 5 dakikadan fazla kaymamalı. |
| `NEXT_PUBLIC_CHECKUP_ADMIN_URL` | build | Kenar çubuğundaki "Check-up paneli" bağlantısı (varsayılan `https://admin.kocum.net`). |

Davet ve parola sıfırlama e-postaları `FRONTEND_URL/admin/sifre-belirle/…` ve
`/admin/sifre-sifirla/…` adreslerine gider; backend'de `FRONTEND_URL` doğru olmalı ve
`SMTP_URL` dolu olmalı (yoksa davet gönderilemez, panel geçici parola ister).

`/admin` arama motoruna kapalı (robots noindex) ve `X-Frame-Options: DENY`.
Server action gövde sınırı 12 MB (kapak görseli + gömülü görseller); backend 10 MB.

## Port

`next start` `PORT` değişkenini okur, yoksa **3000**'e düşer. Dokploy'da reverse-proxy
hedefini bu portla eşleştir.

## Backend tarafında yapılması gerekenler

Frontend tek başına yetmez; backend'de (`api.kocum.net`) şunlar olmalı:

```bash
CORS_ORIGINS=https://kocum.net,https://admin.kocum.net   # iletişim formu + check-up paneli girişi
AUTH_COOKIE_DOMAIN=.kocum.net                              # tek giriş (kocum.net/admin ve admin.kocum.net)
SMTP_URL=smtps://resend:re_...@smtp.resend.com:465         # davet, parola sıfırlama, iletişim bildirimi
FRONTEND_URL=https://kocum.net
BACKEND_URL=https://api.kocum.net
NODE_ENV=production                                       # çerezler Secure olur, CSRF aktifleşir
BFF_SHARED_SECRET=<frontend'dekiyle aynı, ≥32 karakter>   # site yönetiminde gerçek istemci IP'si (hız sınırları)
```

`NODE_ENV=production` olmadan CSRF devre dışı kalabilir ve auth çerezi `Secure`
işaretlenmez — canlıda ikisi de olmalı.

## Build sırasında backend erişilemezse

Sorun olmaz — `sitemap.ts`, `llms.txt` ve blog listesi backend'e ulaşamazsa boş döner, build çökmez. Yazılar bir sonraki revalidate'te (saatlik) görünür.
