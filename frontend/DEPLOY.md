# Frontend Deployment (Dokploy / Nixpacks)

## Node sürümü

Next.js 16 **Node >= 20.9** ister. Nixpacks bu ayar olmadan Node 18'e düşer ve build şu hatayla ölür:

```
You are using Node.js 18.20.5. For Next.js, Node.js version ">=20.9.0" is required.
```

Bu yüzden repoda `nixpacks.toml` (Node 20'ye sabitler) ve `package.json` içinde `engines.node` var. **Silme.**

## Build Environment Variables (ZORUNLU)

Aşağıdaki iki değişken **build sırasında** tanımlı olmalı. `NEXT_PUBLIC_*` değişkenleri derleme anında bundle'a gömülür — runtime'da değiştirilemez.

| Değişken | Örnek | Ne olur set edilmezse |
|----------|-------|------------------------|
| `NEXT_PUBLIC_SITE_URL` | `https://kocum.net` | Tüm canonical, hreflang, Open Graph, `sitemap.xml`, `llms.txt` ve JSON-LD adresleri **`http://localhost:3000`** olarak gömülür. Google yanlış adresi indeksler. |
| `NEXT_PUBLIC_BACKEND_URL` | `https://api.kocum.net` | Blog yazıları çekilemez (liste boş kalır), blog görselleri yüklenmez, görüntülenme sayacı çalışmaz. |

Dokploy'da: **Uygulama → Environment → Build Environment Variables** bölümüne ekle (runtime env yeterli DEĞİL).

## Port

`next start` `PORT` environment değişkenini okur, yoksa **3000**'e düşer. Dokploy'da reverse-proxy hedefini dinlediği portla eşleştir.

## Backend CORS

Backend'in `CORS_ORIGINS` listesinde bu sitenin adresi olmalı, yoksa tarayıcıdan yapılan istekler (görüntülenme sayacı gibi) engellenir.

## Build sırasında backend erişilemezse

Sorun olmaz — `sitemap.ts`, `llms.txt` ve blog listesi backend'e ulaşamazsa boş döner, build çökmez. Yazılar bir sonraki revalidate'te (saatlik) görünür.
