# Check-up öğrenci uygulaması (`checkup/frontend`)

Öğrencinin yüzü: kayıt, sınav ve tür seçimi, test ekranı, rapor, panel, profil.
Yapı ve kararlar `../MIMARI.md`'de, backend sözleşmesi `../API.md`'de.

## Çalıştırma

```bash
cp .env.example .env.local   # BACKEND_URL, SERVIS_ANAHTARI, NEXT_PUBLIC_SITE_URL
npm ci
npm run dev                  # http://localhost:3200 (backend 4000'de açık olmalı)
```

Denetim: `npm run typecheck`, `npm run lint`, `npm run build`.
Kilit dosyası npm 10 ile üretilir: `npx npm@10.9.4 install <paket>`.

## Düzen

- **BFF:** Tarayıcı backend'le hiç konuşmaz. Sayfalar, sunucu eylemleri
  (`lib/eylemler/`) ve `/medya/[id]` rotası backend'e `lib/backend.ts`
  üzerinden gider: `x-servis-anahtari`, `x-istemci-ip` ve oturum varsa
  `Authorization: Bearer`. Önbellek yok.
- **Oturum:** Backend'in jetonu `ogrenci_oturum` httpOnly çerezinde (30 gün).
  `proxy.ts` yalnızca çerez yoksa girişe yollar; asıl denetim sunucuda.
  Backend `OTURUM_YOK` derse çerez silinir, girişe gidilir
  (sayfa çizilirken `/oturum-bitti` rotası siler).
- **Kaynak etiketi:** kocum.net bağlantıları `?k=<etiket>` taşır; izin
  listesindeyse `kaynak` çerezine yazılır (proxy), kayıtta backend'e gider.
- **İçerik:** Soru, şık ve çözüm HTML'i backend'den hazır gelir (kaçışlanmış
  metin + KaTeX). Burada yalnızca `katex.min.css` yüklenir, HTML üretilmez.
- **Tasarım:** `app/tokens.css`, `app/tailadmin.css`, `components/tailadmin/`,
  `lib/brand-paths.ts`, ikonlar: `node design/sync.mjs` kopyaları. Elle
  düzenleme. Koyu tema yok.

## Sayfalar

| Yol | Ne |
|---|---|
| `/` | Tanıtım (girişliyse `/panel`) |
| `/kayit`, `/giris`, `/parolami-unuttum`, `/parola-sifirla/[jeton]` | Hesap |
| `/panel` | Devam eden check-up, yeni başlat, geçmiş |
| `/sinav-sec`, `/sinav-sec/[sinavId]` | Sınav, tür, kural ekranı |
| `/test/[id]` | Sınav ekranı (tam ekran) |
| `/rapor/[id]` | Rapor ve cevap incelemesi (yazdırılabilir) |
| `/profil` | Ad, parola, çıkış, hesabı silme |
| `/gizlilik` | KVKK aydınlatma metni (taslak, yer tutucular işaretli) |
