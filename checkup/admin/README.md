# Check-up paneli (`checkup/admin`)

Check-up programının yönetim paneli: sınavlar, check-up türleri, konu ağacı, sorular, Excel içe aktarma, check-up ayarları (reçete / sabit liste), öğrenciler ve yöneticiler. Yapı ve kararlar `../MIMARI.md`, backend sözleşmesi `../API.md`.

## Çalıştırma

```bash
npx npm@10.9.4 ci          # kilit dosyası npm 10 ile (Dokploy/CI npm 10)
cp .env.example .env.local # BACKEND_URL, SERVIS_ANAHTARI
npm run dev                # http://localhost:3300
```

Doğrulama: `npm run typecheck`, `npm run lint`, `npm run build` (backend'e erişmeden geçer; bütün sayfalar dinamik).

## Düzen

- **BFF:** Tarayıcı yalnızca bu uygulamayla konuşur. Backend çağrıları `lib/backend.ts` üzerinden (`x-servis-anahtari`, `x-istemci-ip`, `Authorization: Bearer`).
- **Oturum:** `yonetici_oturum` httpOnly çerezi (12 saat). `proxy.ts` çerez yoksa girişe yollar; asıl doğrulama düzende ve her sayfada `GET /api/admin/ben` (istek başına bir kez). Backend `OTURUM_YOK` derse çerez silinir, girişe gidilir (`/oturum-bitti`).
- **Roller:** Menü ve sayfalar role göre (EDITOR'e Öğrenciler ve Yöneticiler görünmez). Asıl yetki backend'de.
- **Formlar:** Durum istemcide (`useState`), server action elle çağrılır (`await kaydet(veri)`). Form `action`'ı kullanılmaz: React 19 formu sıfırlıyor, seçimler kayboluyordu.
- **Dosyalar:** Görsel ve Excel yüklemesi route handler'lardan geçer (`app/api/**`); server action gövde sınırı 1 MB. Görseller `/medya/[id]`'den aktarılır.
- **Önizleme:** Formül önizlemesini backend üretir (`POST /api/admin/onizleme`, 400 ms gecikmeyle). Panel yalnızca `katex.min.css` yükler.
- **Görünüm:** TailAdmin kiti (`components/tailadmin`), belirteçler `app/tokens.css`. Bu kopyalar `node design/sync.mjs` ile üretilir, **elle düzenlenmez**. Koyu tema yok.

## Yayın

Dokploy + Nixpacks (`nixpacks.toml`, Node 22.20). Ortam: `BACKEND_URL` (iç ağ adresi), `SERVIS_ANAHTARI`.
