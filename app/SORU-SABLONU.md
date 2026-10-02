# Check-up soru giriş şablonu (v2)

Bu dosya **içerik hazırlayıcı için** yazılmıştır. Buradaki biçime uyan bir
markdown dosyası, içe aktarma betiğiyle doğrudan veritabanına girer.

Altı sınavın hepsi aynı şablonu kullanır: LGS · TYT · AYT · KPSS · DGS · ALES.

---

## 1. Değişmeyen kurallar

| Kural | Neden |
| --- | --- |
| **Konu başına en az 3 soru** | Puanlama 2 soruda seviye verir ama "düşük güven" diye işaretler; haftalık plana ancak 3 soruda ölçülen konu girer. 2 soruyla öğrenci "zayıfsın" yazısını görür, ne çalışacağını göremez. |
| **Her soru tek bir konuya ait** | Konu haritası buna dayanıyor. Karma soru yazılacaksa ağırlık merkezi hangi konuysa o. |
| **Şık sayısı: A–E.** LGS'de A–D | LGS 4 şıklıdır; 5 şık yazmak sınav gerçeğini bozar. |
| **Her yanlış şıkta hata kodu zorunlu** | "Yanlışlarının ortak yanı" ekranı bu kodlarla çalışır. Kod yoksa o soru teşhise katkı vermez. |
| **Doğru cevap iki yerde yazılır** | `[x]` işareti ve `Doğru Şık` satırı. İkisi çelişirse içe aktarma **durur**. Cevap anahtarı hatası sessizce geçmesin diye bilerek çift yazılıyor. |

---

## 2. Alan listesi

### Zorunlu

| Alan | Değer | Örnek |
| --- | --- | --- |
| `ID` | Benzersiz, kalıcı. Sonradan değiştirilmez. | `MAT-01-TK-01` |
| `Konu Kodu` | **Bölüm 6'daki listeden.** Serbest metin değil. | `temel-kavramlar` |
| `Zorluk` | 1–5 (1 çok kolay, 5 çok zor) | `2` |
| `Seviye` | `TEMEL` veya `OSYM` | `TEMEL` |
| `İdeal Süre` | Saniye, sadece sayı | `60` |
| `Soru Metni` | Bölüm 4'teki yazım biçimi | |
| `Seçenekler` | A–E (LGS: A–D), doğru olan `[x]` | |
| `Doğru Şık` | Tek harf | `B` |
| `Çözüm Açıklaması` | Kısa, adım adım | |

### İsteğe bağlı

| Alan | Değer | Ne işe yarar |
| --- | --- | --- |
| `Hedef Sınav` | Sınav kodları, virgülle. **Boş bırakılırsa konunun geçtiği her sınavda sorulabilir** — normal durum budur. | Sadece kısıtlama gerekiyorsa yaz: TYT'deki "Problemler" konusunda AYT ağırlığında bir soru yazdıysan `Hedef Sınav: AYT` diyerek LGS testine düşmesini engellersin. |
| `Çift` | Aynı konuda eşleştirilecek soruların ortak kodu | `MAT-01-TK` — TEMEL + OSYM çiftini aynı teste sokar (bkz. Bölüm 3) |
| `Kazanım` | Tek cümle | Sonuç ekranında "hangi kazanım eksik" yazısı |
| `Kaynak` | `özgün` · `uyarlama` · `2023 ALES / 14` | Telif takibi + kalibrasyon |
| `Görsel` | Dosya adı | Bölüm 5 |

### Yazılmayacaklar

- **`Hedef Sınav: ORTAK`** — sistemde "ORTAK" diye bir değer yok. Ortak soru zaten
  varsayılan: alanı boş bırak.
- **Doğru şıkkın yanına `(Doğru Çözüm: ...)` notu** — `Çözüm Açıklaması` ile aynı
  şeyi iki kez yazıyor, ikisi zamanla çelişiyor. Doğru şık temiz kalsın.
- **`Seviye: 1 (Temel)`** gibi parantezli açıklama — sadece `TEMEL` yaz.

---

## 3. TEMEL + OSYM çifti

Çift tasarımı sistemin teşhisini keskinleştiriyor, bu yüzden destekleniyor:

| TEMEL | OSYM | Teşhis | Öğrenciye |
| :---: | :---: | --- | --- |
| ✔ | ✔ | `TAM_HAKIMIYET` | Bu konu oturmuş, zamanını başka yere ayır. |
| ✔ | ✘ | `UYGULAMA_EKSIGI` | Kuralı biliyorsun, sınav kurgusunda takılıyorsun. Soru çözmelisin. |
| ✘ | ✔ | `DIKKAT_HATASI` | Mantığı kavramışsın, temel işlemde dikkatsizlik var. |
| ✘ | ✘ | `KAZANIM_KAYIP` | Konu eksik. Sıfırdan anlatım. |

**Çalışması için `Çift` kodu şart.** Soru seçici havuzdan bağımsız seçim yapar;
çift kodu olmadan aynı konudan iki TEMEL sorusu gelebilir ve matris anlamsızlaşır.

Bir konuda **3 soru** öneriyorum: `TEMEL` + `OSYM` çifti (çift kodu aynı) + bir
`OSYM` daha. Böylece hem matris çalışır hem konu haftalık plana girebilir.

---

## 4. Soru metni yazım biçimi

Düz metin yaz, formülü `$...$` içine al.

```
Bir otomobil $60$ km/sa hızla $3$ saat yol alıyor. Kaç km yol gitmiştir?
```

**Tek başına duran formül** (ortalanmış blok) için `$$...$$` — kendi satırında olmalı:

```
$a$ ve $b$ birbirinden farklı pozitif tam sayılardır.

$$2a + 3b = 42$$

olduğuna göre, $a$'nın alabileceği en büyük değer kaçtır?
```

**Öncüller** (I, II, III) için satır başına `- ` koy:

```
$x$ bir tam sayı olmak üzere:

- $x^2 + x$ çifttir
- $2x + 1$ tektir
- $x^3$ ile $x$ aynı işaretlidir

yargılarından hangileri kesinlikle doğrudur?
```

Metinde gerçek dolar işareti gerekiyorsa `\$` yaz.

---

## 5. Görsel (geometri şekli, grafik)

Şekil gereken soruda:

```
* **Görsel:** sekil-01.png
* **Soru Metni:**
![ABC üçgeninde AB = 5 cm](sekil-01.png)
Yukarıdaki verilere göre $x$ kaçtır?
```

- Dosyaları markdown ile **aynı klasördeki `gorseller/`** dizinine koy. İçe
  aktarma görseli veritabanına yükler ve dosya adını iç kimlikle değiştirir;
  sen dosya adı yazmaya devam et.
- PNG veya JPG, kısa kenar en az 600 piksel.
- Köşeli parantez içindeki metin **alternatif metin**: görseli göremeyen bir
  öğrenciye ne anlatırdın, onu yaz. Boş bırakılan görsel içe aktarmada reddedilir.

---

## 6. Konu kodları

İçe aktarma konuyu **koda göre** bulur. Kod listede yoksa o soru reddedilir —
yeni konu gerekiyorsa önce bana söyle, ağaca ekleyeyim.

### ALES ve DGS'de kullanılan 17 konu

| Kod | Konu |
| --- | --- |
| `temel-kavramlar` | Temel Kavramlar |
| `bolunebilme` | Bölme ve Bölünebilme |
| `uslu-sayilar` | Üslü Sayılar |
| `koklu-sayilar` | Köklü Sayılar |
| `oran-oranti` | Oran - Orantı |
| `kumeler` | Kümeler |
| `veri-istatistik` | Veri - İstatistik |
| `permutasyon-kombinasyon-olasilik` | Permütasyon - Kombinasyon - Olasılık |
| `sayi-kesir-problemleri` | Sayı - Kesir Problemleri |
| `yuzde-kar-zarar` | Yüzde - Kâr - Zarar Problemleri |
| `hareket-hiz-problemleri` | Hareket - Hız Problemleri |
| `isci-havuz-problemleri` | İşçi - Havuz Problemleri |
| `karisim-problemleri` | Karışım Problemleri |
| `faiz-problemleri` | Faiz Problemleri |
| `sayi-dizileri` | Sayı Dizileri |
| `tablo-grafik-yorumlama` | Tablo - Grafik Yorumlama |
| `sayisal-mantik` | Sayısal Mantık |

Diğer sınavların konu kodları için: `app/prisma/seed.ts` içindeki ağaç, ya da
yönetim panelinde **Check-up → Havuz** ekranı (her konunun kodu orada yazılı).

### Sınav kodları (`Hedef Sınav` alanı için)

`LGS` · `TYT` · `AYT` · `KPSS_LISANS` · `KPSS_ONLISANS` · `DGS` · `ALES`

---

## 7. Hata kodları

Her yanlış şıkta, parantez içinde **önce kod**, sonra açıklama:

```
* [ ] A) 21 (EKSIK_OKUMA: "pozitif tam sayı" şartı atlanmış, b=0 alınmış)
```

| Kod | Ne zaman |
| --- | --- |
| `ISLEM_HATASI` | Yol doğru, dört işlemde kayıp |
| `ISARET_HATASI` | Eksi işareti / parantez açma hatası |
| `TERS_ISLEM` | Toplama yerine çıkarma, tersine oran gibi |
| `KAVRAM_YANILGISI` | Tanımı yanlış biliyor |
| `EKSIK_OKUMA` | Soruda verilen bir koşulu atlamış |
| `BIRIM_HATASI` | dakika/saat, cm/m karışıklığı |
| `YAKLASIK_DEGER` | Erken yuvarlama |
| `FORMUL_KARISTIRMA` | Benzer iki formülü karıştırmış |
| `DIGER` | Yukarıdakilerin hiçbiri (mümkün olduğunca kullanma) |

`DIGER` seçilen şık için öğrenciye tavsiye üretilmez — gerçekten başka
karşılığı yoksa kullan.

---

## 8. Tam örnek

```markdown
### Soru 01
* **ID:** MAT-01-TK-01
* **Konu Kodu:** temel-kavramlar
* **Zorluk:** 2
* **Seviye:** TEMEL
* **Çift:** MAT-01-TK
* **İdeal Süre:** 60
* **Kazanım:** Pozitif tam sayı kısıtı altında en büyük/en küçük değer analizi yapar.
* **Kaynak:** özgün
* **Soru Metni:**
$a$ ve $b$ birbirinden farklı pozitif tam sayılardır.

$$2a + 3b = 42$$

olduğuna göre, $a$'nın alabileceği en büyük değer kaçtır?
* **Seçenekler:**
  * [ ] A) 21 (EKSIK_OKUMA: b=0 alınmış, "pozitif" şartı atlanmış)
  * [x] B) 18
  * [ ] C) 15 (ISLEM_HATASI: 42-6=36 yerine farklı işlem)
  * [ ] D) 19 (KAVRAM_YANILGISI: 2a tek sayı olamaz, teklik-çiftlik gözetilmemiş)
  * [ ] E) 16 (EKSIK_OKUMA: "birbirinden farklı" koşulu atlanmış)
* **Doğru Şık:** B
* **Çözüm Açıklaması:**
$a$ en büyük olsun istiyorsak $b$ en küçük olmalı. $b=1$ için $2a=39$, tam sayı
değil. $b=2$ için $2a=36$ ve $a=18$.

---
```

---

## 9. İçe aktarma neyi reddeder

Betik şu durumlarda **o soruyu almaz ve satır numarasıyla rapor eder**:

1. `Konu Kodu` listede yok
2. Doğru şık yok, ya da birden fazla `[x]` var
3. `[x]` ile `Doğru Şık` satırı çelişiyor
4. Bir yanlış şıkta hata kodu yok ya da kod listede yok
5. Aynı `ID` daha önce girilmiş
6. **Soru metni bire bir aynı** (farklı ID'yle bile) — aynı soru iki kez havuza
   girerse öğrenci aynı soruyu iki testte görür, istatistik bölünür
7. Görsel dosyası bulunamıyor ya da alternatif metni boş
8. `İdeal Süre` sayı değil, `Zorluk` 1–5 dışında

Rapor: `42 soru alındı, 3 soru reddedildi` + her ret için sebep.

---

## 10. Sınav başına hedef

Konular sınavlar arasında paylaşılıyor: ALES için yazdığın "Oran - Orantı"
soruları KPSS ve TYT paketlerinde de kullanılıyor.

| Sınav | Konu | Sağlıklı havuz | ALES/DGS ile ortak konu |
| --- | ---: | ---: | ---: |
| ALES | 14 | 150 | 14 |
| DGS | 14 | 150 | 14 |
| KPSS Lisans | 20 | 210 | 13 |
| TYT | 21 | 225 | 12 |
| AYT | 16 | 201 | 0 |
| LGS | 12 | 150 | 0 |

"Sağlıklı havuz" = paketin istediği soru sayısının 3 katı. Üç kat şart, çünkü
aynı öğrenciye 30 gün içinde aynı soru gösterilmiyor; havuz dar olursa ikinci
testte soru kalmıyor ve sistem "bu paketin havuzu sınırlı" uyarısı veriyor.

**Başlangıç eşiği:** bir paketin yayına çıkması için her konuda, o paketin
istediği kadar soru bulunmalı. ALES+DGS'in 8 paketi için bu **61 soru**
(10 konuda 4'er, 7 konuda 3'er). 61 soruyla paketler açılır ama tekrar koruması
çalışmaz: öğrenci ikinci kez çözdüğünde aynı sorular gelir ve sistem
"bu paketin havuzu sınırlı" uyarısı verir. **183 soruda** sistem tam çalışır.

Havuz yetmeyen paket kendiliğinden yayına çıkmaz, taslak kalır — yarım test
başlatılmaz.
