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
| `NEXT_PUBLIC_BACKEND_URL` | Blog yazıları çekilemez (liste boş kalır), blog görselleri yüklenmez, görüntülenme sayacı çalışmaz. |

## Port

`next start` `PORT` değişkenini okur, yoksa **3000**'e düşer. Dokploy'da reverse-proxy
hedefini bu portla eşleştir.

## Backend tarafında yapılması gerekenler

Frontend tek başına yetmez; backend'de (`api.kocum.net`) şunlar olmalı:

```bash
CORS_ORIGINS=https://kocum.net,https://admin.kocum.net   # yoksa tarayıcı istekleri engellenir
FRONTEND_URL=https://kocum.net
BACKEND_URL=https://api.kocum.net
NODE_ENV=production                                       # çerezler Secure olur, CSRF aktifleşir
```

`NODE_ENV=production` olmadan CSRF devre dışı kalabilir ve auth çerezi `Secure`
işaretlenmez — canlıda ikisi de olmalı.

## Build sırasında backend erişilemezse

Sorun olmaz — `sitemap.ts`, `llms.txt` ve blog listesi backend'e ulaşamazsa boş döner, build çökmez. Yazılar bir sonraki revalidate'te (saatlik) görünür.
