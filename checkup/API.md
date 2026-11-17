# Check-up API sözleşmesi

Backend (`checkup/backend`) ile iki istemci (`checkup/frontend` öğrenci, `checkup/admin` panel) arasındaki tek sözleşme. Uç eklemek ya da şekil değiştirmek için önce bu belge güncellenir.

## Genel kurallar

- Taban adres `${BACKEND_URL}/api`. Tarayıcı backend'le hiç konuşmaz. İstekleri Next sunucusu (server component, server action, route handler) atar.
- **Her istekte** `x-servis-anahtari: <SERVIS_ANAHTARI>` başlığı gönderilir. Yoksa ya da yanlışsa `401 SERVIS_ANAHTARI` döner. Tek istisna `GET /api/saglik`.
- `x-istemci-ip`: Next, istemci IP'sini bu başlıkla iletir (Cloudflare kuralı: `x-real-ip` Cloudflare aralığındaysa `cf-connecting-ip`). Backend bu başlığa yalnızca servis anahtarı doğruysa güvenir. Hız sınırları bu IP'ye göre çalışır.
- Giriş gereken uçlarda `Authorization: Bearer <jeton>` gönderilir. Öğrenci jetonu yalnızca `/api/ogrenci/*`, yönetici jetonu yalnızca `/api/admin/*` uçlarında geçer.
- Gövde JSON'dur, alan adları camelCase ve Türkçedir. Tarihler ISO 8601 metin, para tamsayı kuruştur (`ucretKurus: 29900` = 299,00 TL).
- Sayfalı listelerde `?sayfa=1&boyut=50` kullanılır (boyut en fazla 200). Yanıt `{ kayitlar, toplam, sayfa, boyut }` olur.

### Hata biçimi

```json
{ "hata": { "kod": "DOGRULAMA", "mesaj": "Türkçe, kullanıcıya gösterilebilir cümle", "alanlar": { "eposta": "Geçerli bir e-posta yazın." }, "ek": {} } }
```

| Kod | HTTP | Ne zaman |
|---|---|---|
| `SERVIS_ANAHTARI` | 401 | Servis anahtarı yok ya da yanlış |
| `OTURUM_YOK` | 401 | Jeton yok, süresi dolmuş ya da yanlış türde |
| `YETKI_YOK` | 403 | Rol yetmiyor (EDITOR, YONETICI ucuna geldi) |
| `BULUNAMADI` | 404 | Kayıt yok ya da bu öğrenciye ait değil |
| `DOGRULAMA` | 400 | Gövde ya da kural hatası; `alanlar` doldurulur |
| `CAKISMA` | 409 | Benzersizlik (aynı e-posta, aynı ad) |
| `KULLANIMDA` | 409 | Silinemez: soru, öğrenci sonucu ya da alt kayıt var. Mesaj "pasif yapın" der |
| `HAZIR_DEGIL` | 409 | Check-up ayarı hazır değil ya da rapor henüz yok |
| `ACIK_CHECKUP_VAR` | 409 | Öğrencinin bitmemiş check-up'ı var; `ek.checkupId` |
| `SURE_DOLDU` | 409 | Süre bitti; check-up kapatıldı |
| `KAPANDI` | 409 | Check-up zaten bitti |
| `COK_FAZLA_ISTEK` | 429 | Hız sınırı |
| `SUNUCU` | 500 | Beklenmeyen hata (ayrıntı günlüğe yazılır, yanıta yazılmaz) |

### Alan hataları ve boşaltma

- **`alanlar` anahtarları** gövdedeki yolun noktalı yazımıdır: `metin`, `cozum`, `altKazanimId`, `dogruSik`, `siklar.2.metin`, `recete.0.soruSayisi`.
- **PATCH'te alan silme:** Bir alanı boşaltmak için o alana `null` gönderilir. Bu `aciklama`, `gorselId`, `zorluk`, `kod` ve şık `aciklama` alanları için geçerlidir. Gövdede hiç yer almayan alan değişmez.

### Nesneler

- **Ogrenci:** `{ id, adSoyad, eposta, olusturuldu }`
- **Yonetici:** `{ id, adSoyad, eposta, rol: "YONETICI" | "EDITOR", aktif }`
- **CheckupOzeti:** `{ id, durum: "DEVAM" | "BITTI", sinav: { id, ad }, tur: { id, ad }, soruSayisi, cevaplanan, baslangic, bitisSiniri, bitis, dogru, yanlis, bos, net }`. Devam edende sonuç alanları `null` olur.
- **Grup** (rapor satırı): `{ id, ad, soru, dogru, yanlis, bos, net, basari }`. `basari = round(dogru / soru * 100)`. Net, check-up'ın yanlış götürme oranıyla hesaplanır.

## Sağlık

`GET /api/saglik` → `{ durum: "ok" }`

## Görseller

`GET /api/medya/:id` (servis anahtarı ister, oturum istemez) → görsel baytları. `Content-Type` kayıtlı mime, `Cache-Control: public, max-age=31536000, immutable`. İki Next uygulaması bunu kendi `/medya/[id]` rotasından aktarır. API, görseli yalnızca `gorselId` olarak verir.

## Öğrenci

### Hesap

| Uç | Gövde | Yanıt |
|---|---|---|
| `POST /api/ogrenci/kayit` | `{ adSoyad, eposta, parola, kvkkOnay: true, kaynak? }` | 201 `{ jeton, bitis, ogrenci }` |
| `POST /api/ogrenci/giris` | `{ eposta, parola }` | `{ jeton, bitis, ogrenci }` |
| `POST /api/ogrenci/cikis` | — | 204 |
| `GET /api/ogrenci/ben` | — | `{ ogrenci }` |
| `PATCH /api/ogrenci/ben` | `{ adSoyad }` | `{ ogrenci }` |
| `PUT /api/ogrenci/ben/parola` | `{ mevcutParola, yeniParola }` | 204. Bu oturum dışındaki oturumlar silinir |
| `DELETE /api/ogrenci/ben` | `{ parola }` | 204. Hesap ve bütün check-up'ları silinir |
| `POST /api/ogrenci/parola-sifirla/istek` | `{ eposta }` | Hesap olsa da olmasa da 204. Bağlantı: `${FRONTEND_URL}/parola-sifirla/<jeton>`, 1 saat geçerli, tek kullanımlık |
| `POST /api/ogrenci/parola-sifirla` | `{ jeton, yeniParola }` | 204. Bütün oturumlar silinir |

**Kurallar:**

- **Yanlış parola `OTURUM_YOK` DEĞİLDİR** (o kod istemcinin oturumunu kapatır):
  - Girişte yanlış e-posta ya da parola → `400 DOGRULAMA`, mesaj "E-posta ya da parola yanlış."
  - Parola değiştirme ve hesap silmede yanlış parola → `400 DOGRULAMA`, sırasıyla `alanlar.mevcutParola` ya da `alanlar.parola`.
  - Admin girişi ve admin parola değiştirme için de aynısı geçerlidir.
- `adSoyad` 2–80 karakter olmalı.
- Parola en az 8 karakter olmalı.
- E-posta küçük harfe çevrilir.
- `kvkkOnay` true değilse kayıt `DOGRULAMA` döner.
- `kaynak` şu listedeyse saklanır, değilse yok sayılır: `ust, hero, bolum, altbilgi, blog, iletisim, whatsapp, instagram, diger`.
- Öğrenci jetonu 30 gün geçerlidir.
- **Hız sınırları:**
  - Kayıt: IP başına saatte 10.
  - Giriş: IP + e-posta başına 15 dakikada 10.
  - Sıfırlama isteği: IP başına saatte 5.

### Sınav kataloğu

`GET /api/ogrenci/sinavlar` → yalnızca aktif sınavlar, `sira`ya göre. Her sınavın içinde yalnızca aktif türler bulunur:

```json
[{ "id": 1, "ad": "ALES", "aciklama": "…", "ucretKurus": 0, "yanlisGoturme": 4,
   "turler": [{ "id": 1, "ad": "Hızlı Check-up", "aciklama": "…", "soruSayisi": 50, "sureDakika": 75, "hazir": true }] }]
```

`hazir: false` olan tür listede görünür ama başlatılamaz ("Hazırlanıyor").

### Check-up

| Uç | Açıklama |
|---|---|
| `POST /api/ogrenci/checkuplar` `{ sinavId, turId }` | 201 `{ id }`. Olası hatalar: `BULUNAMADI` (sınav ya da tür yok veya pasif), `HAZIR_DEGIL`, `ACIK_CHECKUP_VAR` |
| `GET /api/ogrenci/checkuplar` | `CheckupOzeti[]`, en yeni önce |
| `GET /api/ogrenci/checkuplar/:id` | Test ekranı verisi (aşağıda) |
| `PUT /api/ogrenci/checkuplar/:id/cevaplar/:sira` `{ sikId: number \| null }` | `{ kaydedildi: true }`. `null` boş bırakır. Olası hatalar: `SURE_DOLDU`, `KAPANDI`, `DOGRULAMA` (şık o soruya ait değil) |
| `POST /api/ogrenci/checkuplar/:id/bitir` | `{ id, durum: "BITTI" }`. İdempotent |
| `GET /api/ogrenci/checkuplar/:id/rapor` | Rapor (aşağıda). Check-up devam ediyorsa `HAZIR_DEGIL` |

**Süre:**

- `bitisSiniri = baslangic + sureDakika`.
- Cevaplar sınırdan sonra **15 saniye** daha kabul edilir. Sonrasında `SURE_DOLDU` döner ve check-up kapatılır.
- Süresi geçmiş açık check-up, kendisine ya da listeye gelen ilk istekte kendiliğinden bitirilir. Ayrı bir zamanlanmış iş yoktur.

**Test ekranı (`GET /checkuplar/:id`), DEVAM iken:**

```json
{ "id": 7, "durum": "DEVAM", "sinav": { "id": 1, "ad": "ALES" }, "tur": { "id": 1, "ad": "Hızlı Check-up" },
  "soruSayisi": 50, "sureDakika": 75, "yanlisGoturme": 4,
  "baslangic": "…", "bitisSiniri": "…", "simdi": "…sunucu saati…",
  "sorular": [{ "sira": 1, "ders": "Sayısal", "metinHtml": "…", "gorselId": null,
                "siklar": [{ "id": 31, "harf": "A", "metinHtml": "…" }], "secilenSikId": null }] }
```

**Cevap anahtarı sızmaz.** Bu yanıtta doğru şık, çözüm ve şık açıklaması **yoktur**. Backend testleri bunu denetler.

BITTI iken yanıt yalnızca `{ id, durum: "BITTI" }` olur ve istemci rapora yönlendirir.

**Rapor:**

```json
{ "id": 7, "sinav": { "id": 1, "ad": "ALES" }, "tur": { "id": 1, "ad": "Hızlı Check-up" },
  "baslangic": "…", "bitis": "…", "sureSaniye": 3120,
  "ozet": { "soruSayisi": 50, "dogru": 30, "yanlis": 12, "bos": 8, "net": 27, "yanlisGoturme": 4, "basari": 60 },
  "dersler":       [Grup],
  "konular":       [Grup + { "dersAd" }],
  "kazanimlar":    [Grup + { "kod", "konuAd" }],
  "altKazanimlar": [Grup + { "kod", "kazanimAd" }],
  "zayiflar":      [{ "seviye": "kazanim" | "altKazanim", "id", "kod", "ad", "ustAd", "soru", "dogru", "basari" }],
  "inceleme":      [{ "sira", "metinHtml", "gorselId", "ders", "konu", "kazanim", "altKazanim",
                      "siklar": [{ "id", "harf", "metinHtml", "dogru", "aciklama", "aciklamaHtml" }],
                      "secilenSikId", "sonuc": "dogru" | "yanlis" | "bos", "cozumHtml" }] }
```

- `net = dogru - yanlis / yanlisGoturme`; `yanlisGoturme = 0` ise `net = dogru`. İki ondalığa yuvarlanır.
- Listeler konu ağacındaki sıraya göre gelir.
- `zayiflar` şöyle seçilir:
  1. Kazanım ve alt kazanımlardan en az 2 sorusu olup başarısı %50'nin altında kalanlar alınır.
  2. Başarıya göre artan, eşitlikte soru sayısına göre azalan sırayla dizilir.
  3. En fazla 5 tanesi gösterilir.
  
  Tek sorudan zayıflık çıkarılmaz.
- `inceleme` hariç rapor, bitişte `Checkup.rapor` alanına yazılır. `inceleme` istekte güncel soru içeriğinden üretilir.

## Admin

**Roller:**

- **Giriş yapmış her yönetici (EDITOR ve YONETICI):**
  - Pano.
  - Bütün okuma uçları.
  - Konu ağacı, sorular, önizleme, görsel, içe aktarma ve check-up ayarları (reçete).
- **Yalnızca YONETICI:**
  - Sınav ve tür ekleme, düzenleme, silme.
  - Öğrenciler ve öğrenci raporları (KVKK).
  - Yöneticiler.

### Hesap

| Uç | Gövde | Yanıt |
|---|---|---|
| `POST /api/admin/giris` | `{ eposta, parola }` | `{ jeton, bitis, yonetici }`. Jeton 12 saat geçerli. Pasif yönetici giremez |
| `POST /api/admin/cikis` | — | 204 |
| `GET /api/admin/ben` | — | `{ yonetici }` |
| `PUT /api/admin/ben/parola` | `{ mevcutParola, yeniParola }` | 204 |

**İlk yönetici:** Backend açılışta hiç yönetici yoksa ve `ILK_YONETICI_EPOSTA` ile `ILK_YONETICI_PAROLA` (isteğe bağlı olarak `ILK_YONETICI_AD`) tanımlıysa bir YONETICI oluşturur. Yönetici zaten varsa bu değişkenlere bakılmaz.

### Yöneticiler (YONETICI)

- `GET /api/admin/yoneticiler` → `Yonetici[]`
- `POST /api/admin/yoneticiler` `{ adSoyad, eposta, parola, rol }` → `Yonetici`
- `PATCH /api/admin/yoneticiler/:id` `{ adSoyad?, rol?, aktif?, parola? }` → `Yonetici`. Son aktif YONETICI pasif yapılamaz ya da EDITOR'e düşürülemez.
- `DELETE /api/admin/yoneticiler/:id`. Kişi kendini silemez, son YONETICI silinemez. Oturumları da silinir.

### Pano

`GET /api/admin/pano`:

```json
{ "sinavlar": [{ "id", "ad", "aktif", "soruSayisi", "aktifSoruSayisi",
                 "turler": [{ "turId", "ad", "secim", "hazir" }] }],
  "ogrenciSayisi", "checkupSayisi", "bitenCheckupSayisi", "son7GunKayit", "son7GunCheckup" }
```

### Sınavlar ve türler

**Sınav nesnesi:**

```json
{ "id", "ad", "aciklama", "ucretKurus", "yanlisGoturme", "aktif", "sira",
  "dersSayisi", "soruSayisi", "aktifSoruSayisi", "checkupSayisi", "silinebilir" }
```

**Sınav uçları:**

- `GET /api/admin/sinavlar` → `Sinav[]`, `sira`ya göre
- `GET /api/admin/sinavlar/:id` → `Sinav`
- `POST /api/admin/sinavlar` (YONETICI) `{ ad, aciklama?, ucretKurus?, yanlisGoturme?, aktif?, sira? }`. Yeni sınav varsayılan olarak **pasif** açılır.
- `PATCH /api/admin/sinavlar/:id` (YONETICI). Aynı alanlar, hepsi isteğe bağlı.
- `DELETE /api/admin/sinavlar/:id` (YONETICI). Yalnızca hiç dersi ve check-up'ı yoksa silinir, yoksa `KULLANIMDA`.

**Tür nesnesi:**

```json
{ "id", "ad", "aciklama", "soruSayisi", "sureDakika", "aktif", "sira", "checkupSayisi", "silinebilir" }
```

**Tür uçları:**

- `GET /api/admin/turler`
- `POST /api/admin/turler` (YONETICI)
- `PATCH /api/admin/turler/:id` (YONETICI)
- `DELETE /api/admin/turler/:id` (YONETICI). Check-up'ı olan tür silinemez.

**Tür kuralları:**

- `soruSayisi` 1–300 arası, `sureDakika` 1–600 arası olmalı.
- Öğrencinin başlattığı check-up, o anki tür ve sınav değerlerinin kopyasını taşır.

### Konu ağacı

`GET /api/admin/sinavlar/:id/agac`:

```json
{ "sinav": { "id", "ad" },
  "dersler": [{ "id", "ad", "sira", "soruSayisi", "silinebilir",
    "konular": [{ "id", "ad", "sira", "soruSayisi", "silinebilir",
      "kazanimlar": [{ "id", "kod", "ad", "sira", "soruSayisi", "silinebilir",
        "altKazanimlar": [{ "id", "kod", "ad", "sira", "soruSayisi", "silinebilir" }] }] }] }] }
```

- `soruSayisi` yalnızca aktif soruları sayar.
- `silinebilir` için düğümün alt düğümü, sorusu (aktif ya da pasif) ve öğrenci sonucu olmamalı.

`:seviye` şunlardan biridir: `dersler`, `konular`, `kazanimlar`, `alt-kazanimlar`. `ustId` sırasıyla sınav, ders, konu ya da kazanım kimliğidir.

| Uç | Gövde | Not |
|---|---|---|
| `POST /api/admin/agac/:seviye` | `{ ustId, ad, kod? }` | Düğüm. Sona eklenir. `kod` yalnızca kazanım ve alt kazanımda olur |
| `POST /api/admin/agac/:seviye/toplu` | `{ ustId, satirlar: string[] }` | `{ eklenen }`. Her satır bir düğüm olur. Kazanım ve alt kazanımda `KOD \| Ad` biçimi kodu ayırır. Boş ve aynı adlı satırlar atlanır |
| `PATCH /api/admin/agac/:seviye/:id` | `{ ad?, kod? }` | Düğüm |
| `POST /api/admin/agac/:seviye/:id/tasi` | `{ yon: "yukari" \| "asagi" }` | Komşusuyla yer değiştirir |
| `DELETE /api/admin/agac/:seviye/:id` | — | `silinebilir` değilse `KULLANIMDA` |

### Sorular

`GET /api/admin/sorular?sinavId=&dersId=&konuId=&kazanimId=&altKazanimId=&aktif=true|false&ara=&sayfa=&boyut=`. Sayfalıdır, `sinavId` zorunludur. Her kayıt şu alanları taşır:

```json
{ "id", "metin": "ilk 160 karakter", "ders", "konu", "kazanim", "altKazanim",
  "zorluk", "aktif", "gorselVar", "kullanimSayisi", "olusturuldu" }
```

`GET /api/admin/sorular/:id`:

```json
{ "id", "sinavId", "dersId", "konuId", "kazanimId", "altKazanimId",
  "metin", "metinHtml", "gorselId", "cozum", "cozumHtml", "zorluk", "aktif",
  "siklar": [{ "sira", "harf", "metin", "metinHtml", "dogru", "aciklama" }],
  "kullanimSayisi", "sabitListeSayisi", "olusturuldu", "guncellendi" }
```

**Ekleme ve düzenleme:**

- `POST /api/admin/sorular` gövdesi: `{ sinavId, dersId, konuId, kazanimId, altKazanimId, metin, gorselId?, cozum, zorluk?, aktif?, siklar: [{ metin, aciklama? }] (tam 5, A–E), dogruSik: "A".."E" }`
- `PATCH /api/admin/sorular/:id`: aynı alanlar, hepsi isteğe bağlı. `siklar` gelirse tam 5 olmalıdır ve şıklar sırasına göre yerinde güncellenir.
- `DELETE /api/admin/sorular/:id`: soru bir check-up'ta ya da sabit listede geçiyorsa `KULLANIMDA` döner ("pasif yapın").

**Doğrulama:**

- Sınav, ders, konu, kazanım ve alt kazanım zorunludur ve birbirine ait olmalıdır. Bu kural veritabanında da zorunludur.
- Metin ve çözüm boş olamaz.
- LaTeX derlenmelidir: hatalı `$...$` olursa `DOGRULAMA` döner ve hangi alan olduğu belirtilir.
- Şık metinleri boş olamaz. Boşluk ve büyük-küçük harf farkı yok sayıldığında da birbirinden ayrı olmalıdır.
- Tam bir doğru şık olmalıdır.
- `zorluk` verilecekse 1–5 arasında olmalıdır.

**Önizleme:** `POST /api/admin/onizleme` `{ metin }` → `{ html }`. LaTeX hatalıysa `DOGRULAMA` döner ve `mesaj` hatayı söyler.

**Yazım biçimi:**

- Düz metin yazılır. Satır sonları HTML'de `<br>`, boş satır yeni `<p>` olur. Çıktıda ham `\n`'e güvenilmez; istemci `white-space: pre-line` KULLANMAZ.
- `gorselId` her yerde metin (uuid) olarak gelir.
- Formüller `$...$` içinde yazılır (satır içi). `$$...$$` ayrı satıra ortalanır.
- `\$` düz dolar işareti olur.
- Bütün metin HTML'e çevrilmeden önce kaçışlanır (escape). KaTeX `trust: false`, `throwOnError: true` ile çalışır.

**Görsel yükleme:** `POST /api/admin/gorseller`, multipart `dosya` alanı. PNG, JPEG ya da WebP kabul edilir, en fazla 10 MB. SVG kabul edilmez. Yanıt `{ id, genislik, yukseklik }`. Görsel EXIF'e göre döndürülür, 1200 piksel genişliğe küçültülür ve WebP'ye çevrilir.

### Excel'den içe aktarma

- `GET /api/admin/ice-aktar/sablon?sinavId=` → `.xlsx` dosyası. İçinde iki sayfa var:
  - **"Sorular":** başlık satırı ve bir örnek satır.
  - **"Konu Ağacı":** o sınavın geçerli ders, konu, kazanım ve alt kazanım satırları.
- `POST /api/admin/ice-aktar/denetle`, multipart `dosya` ve `sinavId` alanlarıyla:

  ```json
  { "toplam", "gecerli", "hatali",
    "satirlar": [{ "satir": 2, "durum": "gecerli" | "hatali", "hatalar": ["…"], "ozet": "soru metninin ilk 80 karakteri" }] }
  ```

- `POST /api/admin/ice-aktar/kaydet`, aynı gövdeyle. Hatalı satır varsa hiçbir şey yazılmaz ve `400 DOGRULAMA` döner (`ek` denetim raporunu taşır). Hata yoksa tek işlemde (transaction) yazılır ve 201 `{ iceAktarmaId, eklenen }` döner.

**Sütunlar** (başlık adı büyük-küçük harf ve Türkçe karakter farkı gözetmeden eşleşir): `Ders | Konu | Kazanım | Alt Kazanım | Soru | A | B | C | D | E | Doğru | Çözüm | Zorluk`.

**Satır kuralları:**

- Ders, konu, kazanım ve alt kazanım **adıyla** eşleşir. Kazanım ve alt kazanım **koduyla** da eşleşebilir.
- Eşleşmeyen ad hatadır. İçe aktarma konu ağacına düğüm **eklemez**: konular admin'de tek tek girilir.
- `Doğru` A–E olmalıdır. `Zorluk` boş ya da 1–5 olabilir.
- Soru ve şık doğrulaması, elle girilen soruyla aynıdır.
- **Tekrar denetimi:** metni aynı olan bir soru sınavda zaten varsa satır hatalı sayılır ("aynı soru zaten var: #id"). Aynı dosyada iki kez geçen soru da hatalıdır.

### Check-up ayarları (reçete ve sabit liste)

`GET /api/admin/sinavlar/:sinavId/ayarlar` → her tür için bir nesne döner, pasif türler de dahil. Ayarı henüz kaydedilmemiş tür, varsayılan değerlerle gelir: `KARMA`, boş reçete, boş liste.

```json
[{ "tur": { "id", "ad", "soruSayisi", "sureDakika", "aktif" },
   "secim": "KARMA" | "SABIT",
   "recete": [{ "id", "konuId", "kazanimId", "ad", "ustAd", "soruSayisi", "havuz" }],
   "sabitSorular": [{ "soruId", "sira", "metin": "ilk 120 karakter", "konu", "aktif" }],
   "hazirlik": { "hazir": true, "sorunlar": ["…"] } }]
```

`PUT /api/admin/sinavlar/:sinavId/ayarlar/:turId` gövdesi `{ secim, recete: [{ konuId?, kazanimId?, soruSayisi }], sabitSoruIdleri: number[] }`. Yanıt yukarıdaki tek nesnedir.

**Kaydetme kuralları:**

- Her satırda `konuId` ile `kazanimId`'den **tam biri** dolu olmalıdır, o sınava ait olmalıdır ve `soruSayisi ≥ 1` olmalıdır.
- Aynı konu ya da kazanım iki kez geçemez. Bir konu ve onun altındaki bir kazanım ayrı satır olarak birlikte bulunabilir.
- Sabit listedeki sorular o sınava ait ve tekil olmalıdır.
- Eksik ayar da **kaydedilir** ama `hazir: false` olur ve öğrenci başlatamaz. Sorunlar Türkçe cümlelerle listelenir.

**Hazırlık:**

- **KARMA:**
  - Reçete toplamı tür soru sayısına eşit olmalıdır.
  - Her kazanım satırı için o kazanımda yeterli aktif soru olmalıdır.
  - Her konu satırı için de yeterli soru olmalıdır: konudaki aktif soru sayısından, aynı konunun reçetedeki kazanım satırlarının istediği sayı çıkarılır ve kalan yetmelidir.
- **SABIT:** Listede tam tür soru sayısı kadar soru olmalı ve hepsi aktif olmalıdır.

**Soru seçimi (başlatırken):**

- **KARMA:**
  1. Önce kazanım satırları, sonra konu satırları doldurulur.
  2. Her satır kendi havuzundan rastgele seçer ve daha önce seçilmiş soruyu almaz.
  3. Öğrencinin aynı sınavda daha önce gördüğü sorular, havuz yetiyorsa seçilmez.
  4. Sorular ders ve konu sırasına göre dizilir. Konu içindeki sıra rastgeledir.
- **SABIT:** Liste sırası korunur.

### Öğrenciler (YONETICI)

- `GET /api/admin/ogrenciler?ara=&sayfa=&boyut=` → sayfalı liste. Her kayıt: `{ id, adSoyad, eposta, olusturuldu, kaynak, checkupSayisi, sonCheckup }`. `sonCheckup`, en son başlatılan check-up'ın `baslangic` değeridir (ISO metin); öğrencinin hiç check-up'ı yoksa `null` olur.
- `GET /api/admin/ogrenciler/:id` → `{ ogrenci: Ogrenci & { kaynak }, checkuplar: CheckupOzeti[] }`
- `GET /api/admin/checkuplar/:id/rapor` → öğrenci raporunun aynısı, ayrıca `ogrenci: { id, adSoyad }`
