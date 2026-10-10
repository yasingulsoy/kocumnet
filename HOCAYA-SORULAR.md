# Özgür Hoca'ya sorular — Check-up içeriği

Merhaba hocam. Sistem büyük ölçüde hazır; aşağıdakiler **sizin cevabınız olmadan
kesinleşemeyen** noktalar. Her maddenin altına kısaca yazmanız yeter — tek satır bile
olur. Belirsizlik olan yerlerde şu an sistemde ne varsayıldığını da yazdım; cevap
gelmezse o varsayımla yayına çıkılır.

Dosyayı doğrudan düzenleyip geri gönderebilirsiniz.

---

## 1. Sınav sabitleri (en acil — netleri etkiliyor)

Yanlışın doğruyu götürme oranı test başlarken kaydediliyor; **sonradan değiştirmek eski
sonuçları düzeltmiyor.** Bu yüzden yayından önce doğrulanmalı.

| Sınav | Matematik soru sayısı | Yanlış götürme | Durum |
| --- | ---: | ---: | --- |
| LGS | 20 | 3 yanlış 1 doğru | güvenli |
| TYT | 40 | 4 yanlış 1 doğru | güvenli |
| AYT | 40 | 4 yanlış 1 doğru | güvenli |
| KPSS Lisans (Genel Yetenek matematik) | 30 | **4 yanlış 1 doğru (varsayıldı)** | ⚠️ doğrulanacak |
| KPSS Ön Lisans | 30 | **4 yanlış 1 doğru (varsayıldı)** | ⚠️ doğrulanacak |
| DGS (sayısal) | 60 | **4 yanlış 1 doğru (varsayıldı)** | ⚠️ doğrulanacak |
| ALES (sayısal) | 50 | **4 yanlış 1 doğru (varsayıldı)** | ⚠️ doğrulanacak |

**Soru 1.1** — KPSS, DGS ve ALES'te yanlış doğruyu götürüyor mu? Güncel kural nedir?

> Cevap:

**Soru 1.2** — Soru sayıları doğru mu? (Özellikle DGS sayısal 60 ve KPSS matematik 30.)

> Cevap:

**Soru 1.3** — 2027 sınav tarihleri belli mi? Girilirse öğrenci panelinde "sınava X gün"
geri sayımı kendiliğinden çıkıyor. Bilinmeyeni boş bırakın; uydurma tarih yazmayın.

| Sınav | Tarih (gg.aa.yyyy) |
| --- | --- |
| LGS | |
| TYT/AYT | |
| KPSS Lisans | |
| DGS | |
| ALES (ilkbahar) | |
| ALES (sonbahar) | |

---

## 2. Seviyeli check-up — kapı eşikleri

Seviyeli akış şemasına göre kuruldu. Sayılar şu an böyle:

| | Soru | Süre | Geçme eşiği |
| --- | ---: | ---: | ---: |
| Seviye 1 (tek kazanım) | 50 | 50 dk | %60 |
| Telafi turu (yalnızca eksik kazanımlar, yeni sorular) | eksik sayısı kadar | soru başına 1 dk, en az 5 dk | birleşik %55 |
| Seviye 2 (çok adımlı) | 25 | 32 dk | %60 |
| Seviye 3 (sınav standardı) | 25 | 35 dk | — (nihai rapor) |
| LGS için | 35 / 20 / 20 | 35 / 26 / 28 dk | aynı eşikler |

**Soru 2.1** — Eşikler (%60 ve telafi sonrası %55) sizin niyetinizle aynı mı?

> Cevap:

**Soru 2.2** — Seviye 2 için şemada "30-35 dk" yazıyordu; 32 seçtik. Seviye 3 için 35.
Onaylıyor musunuz?

> Cevap:

**Soru 2.3** — LGS'ye özel küçültülmüş sayılar (35/20/20) uygun mu? 8. sınıf için 50 soru
50 dakikayı uzun bulduk.

> Cevap:

**Soru 2.4** — Telafi turu matematiksel olarak geçilemeyecekse (eksik kazanımların hepsi
doğru olsa bile %55'e ulaşılamıyorsa) tur hiç açılmıyor, öğrenci doğrudan Seviye 1
karnesi alıyor. Bu doğru mu, yoksa yine de telafi sorulsun mu?

> Cevap:

**Soru 2.5** — Öğrenci seviyeler arasında ara verebiliyor (Seviye 1'i bugün, Seviye 2'yi
yarın). Süre sınırı yalnızca her seviyenin kendi içinde. Böyle kalsın mı, yoksa "aynı
oturumda bitirmeli" mi?

> Cevap:

---

## 3. "Çift" tasarımı (v2 şablonundan)

v2 şablonunda her TEMEL sorunun bir ÖSYM eşi vardı ("Çift" kodu) ve dört durumlu bir
teşhis tablosu kuruluyordu. Seviyeli akış şemasında bu yok; v3 şablonundan kaldırdık.

**Soru 3.1** — Çift tasarımı bilerek mi bırakıldı? Yoksa seviyeli akışla birlikte
yürüsün mü? (İkisi birlikte yürüyecekse şablona `Eş Soru ID` alanı geri
gelir ve sonuç ekranına "temeli var ama sınav sorusunu yapamıyor" teşhisi eklenir.)

> Cevap:

---

## 4. Kazanım listesi — Seviye 1 bunsuz kurulamıyor

Seviye 1 "her kazanımdan bir soru" ilkesiyle çalışıyor: **50 soru = 50 kazanım.** Şu an
sistemde her konuya bir demo kazanım var; gerçek listede bir konunun birkaç kazanımı olur
(ör. "Bölünebilme" → 3'e, 9'a, 11'e bölünebilme ayrı kazanımlar).

| Sınav | Gereken | Konu ağacından çıkan | **Yazılacak** |
| --- | ---: | ---: | ---: |
| TYT | 50 | 32 | 18 |
| AYT | 50 | 16 | 34 |
| KPSS Lisans | 50 | 34 | 16 |
| DGS | 50 | 37 | 13 |
| ALES | 50 | 37 | 13 |
| LGS | 35 | 12 | 23 |

**Soru 4.1** — Hangi sınavdan başlıyoruz? Önerimiz ALES/DGS: o 13 kazanım KPSS ve TYT'nin
de büyük kısmını dolduruyor (konular ortak).

> Cevap:

**Soru 4.2** — Kazanım listesini şu biçimde gönderebilir misiniz? Kod kalıcı olacak;
sorularda bu kod geçecek. Panelden de tek tek girilebiliyor ama toplu liste daha hızlı.

```
Konu Kodu          | Kazanım Kodu | Kazanım (tek cümle, ölçülebilir fiil)
temel-kavramlar    | TK-01        | Pozitif tam sayı kısıtı altında en büyük/en küçük değer bulur.
temel-kavramlar    | TK-02        | Ardışık sayıların toplamını formülle hesaplar.
bolunebilme        | BL-01        | 3 ve 9 ile bölünebilme kuralını uygular.
```

> Liste (ya da ayrı dosya):

**Soru 4.3** — Konu ağacında eksik/yanlış konu var mı? Konu kodları `SORU-SABLONU.md`
Bölüm 6'da ve panelde (Check-up → Havuz). Yeni konu gerekiyorsa adını yazın, ağaca ekleyelim.

> Cevap:

---

## 5. Soru sayıları ve pilot

Bir sınavın seviyeli check-up'ının açılması için en az: Seviye 1'de **her kazanıma 2 soru**
(100 soru), Seviye 2'de 25, Seviye 3'te 25 → **150 soru.** Klasik paketler (konu bazlı,
15-30 soruluk) bundan ayrı; onlar için konu başına en az 3 soru.

**Soru 5.1** — İlk pilot için hedef ne olsun? Önerimiz: TYT Çekirdek'in 8 konusunda
10'ar soru (80 soru) ile klasik paketleri açmak, seviyeli sistemi ALES/DGS'de kurmak.

> Cevap:

**Soru 5.2** — Elinizdeki hazır sorular hangi biçimde? (Word/InDesign dizgi dosyası mı,
yalnızca PDF mi, yoksa yeni yazılacak mı?) Dizgi dosyası varsa dönüştürmeyi biz yaparız;
PDF'ten elle aktarım gerekir.

> Cevap:

**Soru 5.3** — Bir soru dosyasını (10-20 soru, `SORU-SABLONU.md` biçiminde) deneme olarak
gönderebilir misiniz? İçe aktarma betiği hazır; ilk dosyada biçim sorunlarını birlikte
ayıklarız. Örnek dosya: `app/scripts/fixtures/ornek-import.md`.

> Cevap:

---

## 6. Puanlama ve koçluk kuralları

Şu anki eşikler:

- Konu seviyesi: doğru oranı **≥ %75 güçlü**, **%45-75 orta**, **< %45 zayıf**.
- Bir konu en az **2 soruyla** ölçülür ("düşük güven" işaretiyle), **3 soruyla** güvenilir sayılır.
- Haftalık plana en fazla **2 konu** girer; her konu için: konu tekrarı (60 dk) → 40 soru
  (70 dk) → yanlış analizi (25 dk) → 5 soruluk kontrol testi (sistem doğrular).
- Kontrol testi günde en fazla **8**.
- "Yavaş" uyarısı: hedef sürenin **1,3 katı** üstünde kalan soru.

**Soru 6.1** — Bu eşikler ve plan kalıbı sizce makul mü? Değiştirmek istediğiniz var mı?

> Cevap:

**Soru 6.2** — Hata tipleri (`ISLEM_HATASI`, `ISARET_HATASI`, `TERS_ISLEM`,
`KAVRAM_YANILGISI`, `EKSIK_OKUMA`, `BIRIM_HATASI`, `YAKLASIK_DEGER`, `FORMUL_KARISTIRMA`)
yeterli mi? Eksik gördüğünüz bir hata türü var mı? (Her birinin öğrenciye giden bir
tavsiye metni var; yeni tip eklenirse metni de yazmak gerekir.)

> Cevap:

---

## 7. Paketler ve satış

Katalogda 28 paket var (her sınav için "Tanışma Check-up'ı" 12 soru / 15 dk dahil).
Hepsi şu an **ücretsiz** işaretli; ücretli/ücretsiz ayrımı panelden tek tıkla değişiyor.

**Soru 7.1** — Hangi paketler ücretsiz kalsın (tanışma + ?), hangileri ücretli olsun?

> Cevap:

**Soru 7.2** — Ürün önerileri (sonuç ekranında "bu konuyu çalışmak için") Koçum.Net
yayınlarına bağlanıyor. Yayın listesi güncel mi, eklenecek/çıkarılacak var mı?

> Cevap:

---

## 8. Küçük ama kararlı

**Soru 8.1** — LGS'de şıklar A-D (4 şık). Diğer sınavlarda A-E. Doğru mu?

> Cevap:

**Soru 8.2** — Görsel gerektiren sorular için: şekilleri siz mi çiziyorsunuz (PNG/JPG,
kısa kenar ≥ 600 px), yoksa tarif verip bizden mi istiyorsunuz?

> Cevap:

**Soru 8.3** — Soruların telif durumu: hepsi özgün mü, uyarlama mı? (Çıkmış soru birebir
kullanılacaksa `Kaynak: 2023 TYT / 12` biçiminde yazılmalı; sistemde ayrı işaretleniyor.)

> Cevap:

---

## 9. Soru kalitesi ve kontrol testi (yeni, 4 Ekim)

**Madde analizi.** Panel artık her sorunun gerçek cevaplardan istatistiğini çıkarıyor ve
şüpheli soruları işaretliyor (Check-up → Madde analizi). Eşikler şu an böyle:

| Ölçü | Eşik | Anlamı |
| --- | ---: | --- |
| Bulgu için en az cevap | 20 | Daha azında oranlar yazı-turadan ayırt edilemez |
| Ayırt edicilik için en az cevap | 30 | |
| Çok zor | doğru oranı < %25 | 5 şıkta şans düzeyi %20 |
| Ayırt etmiyor | r < 0,15 | Başarılı ve zayıf öğrenci aynı oranda doğru yapıyor |
| Ters ayırt ediyor | r ≤ −0,05 | Zayıf öğrenciler daha çok doğru yapıyor: anahtar ya da soru hatalı olabilir |
| İyi | r ≥ 0,30 | |
| Çalışmayan çeldirici | seçilme < %5 | Hiç kimseyi çekmeyen şık |
| Çok boş bırakılıyor | boş ≥ %30 | |
| Yavaş | medyan süre > hedefin 1,3 katı | Öğrenciye "yavaş" denen eşikle aynı |
| Zorluk etiketi uymuyor | 2 kademe fark | Etiket ile gözlenen zorluk arasında |

**Soru 9.1** — Bu eşikler sizce makul mü? Özellikle "çalışmayan çeldirici" (%5) ve
"çok zor" (%25) sınırları.

> Cevap:

**Soru 9.2** — Kontrol testi (5 soruluk "konu oturdu mu" testi) bittiğinde öğrenci şu
cümlelerden birini görüyor. Önündeki "Önceki ölçümünde %33 idi (+67 puan)." kısmı
otomatik. Dili size uygun mu, değiştirmek istediğiniz var mı?

| Sonuç | Başlık | Metin |
| --- | --- | --- |
| Güçlü | *Konu*: 5/5 — konu oturmuş. | Çalışman karşılığını verdi; planındaki sıradaki işe geç. |
| Orta | *Konu*: 3/5 — yol alınmış, henüz bitmedi. | Yanlışlarının çözümüne bak, aynı tipten birkaç soru daha çöz; birkaç gün sonra yeniden kontrol et. |
| Zayıf | *Konu*: 1/5 — konu henüz oturmadı. | Bir haftada her konu oturmaz. Çözümleri incele, konu tekrarına dön; birkaç gün sonra yeniden kontrol et. |

> Cevap:

**Soru 9.3** — Panelde "Riskli öğrenciler" listesi var (yalnızca yönetici/müdür görür).
Bir öğrenci şu durumlarda listeye düşüyor:

| Durum | Şu anki eşik |
| --- | --- |
| Pasif | 14 gündür ne giriş ne test |
| Hiç başlamadı | Kayıttan 3 gün sonra hâlâ test yok |
| Planı yapmıyor | Geçen haftanın planında işlerin %40'ından azı bitmiş |
| Düşüşte | Son iki testte en az 10 puan düşüş |

Bu sınırlar koçluk pratiğinize uyuyor mu? Hangisinde öğrenciyi aramak istersiniz?

> Cevap:

---

## 10. Ekip, iş akışı ve öğrenme döngüsü (yeni, 10 Ekim)

**Soru 10.1** — Yeni soruları kim yazacak, kim inceleyecek? Sistem "taslak → inceleme →
yayında" akışıyla çalışıyor; yazan ile onaylayan farklı kişi olunca hatalar daha çok
yakalanıyor. Kazanım listesi (Bölüm 4) için de bir sorumlu ve hedef tarih yazabilir misiniz?

> Cevap:

**Soru 10.2** — Çözüm yazımında ortak standart: her soruya adım adım çözüm ve **her yanlış
şıkkın hangi hatadan çıktığı** (Bölüm 6.2'deki hata tipleri) yazılırsa sonuç ekranındaki
teşhis kendiliğinden çalışıyor. Ekip bu iki alanı her soruya yazabilir mi? Zor gelen bir
kısım varsa söyleyin, şablonu sadeleştirelim.

> Cevap:

**Soru 10.3** — Seviye 1 için parametrik şablon önerimiz: siz bir soru kalıbı yazıyorsunuz
(sayı aralıkları, doğru cevabın formülü, her yanlış şıkkın hangi hatadan çıktığı); sistem
bu kalıptan onlarca farklı soru üretip her birini denetliyor. Telafi turunda öğrenciye aynı
soru hiç gelmiyor. Seviye 1'de bu yolla ilerleyelim mi? Seviye 2 ve 3 yine elle yazılır.

> Cevap:

**Soru 10.4** — Öğrenme döngüsü için iki özellik ekledik; sizin onayınızla kalıcı olacak:

- **Çalışma modu:** süresiz; her sorudan sonra hemen doğru/yanlış, çözüm ve seçilen yanlış
  şıkkın neden yanlış olduğu gösteriliyor. Sonuç ekranında her yanlışın yanında "Benzerini
  çöz" düğmesi var. Ölçmeye karışmıyor: netlere, gelişim grafiğine ve madde analizine girmiyor.
- **Yanlış defteri:** sınavda yanlış ya da boş bırakılan her soru deftere giriyor. Ertesi gün
  aynı kazanımdan benzer bir soru soruluyor; doğruysa 3 gün, sonra 7 gün sonra yeniden
  soruluyor, üçüncü doğruda defterden çıkıyor. Yanlışsa yeniden 1 güne dönüyor.

Pedagojik olarak uygun mu? Tekrar aralıkları (1, 3, 7 gün) ve "üç doğru tekrarla
defterden çıkar" kuralı sizce doğru mu?

> Cevap:

**Soru 10.5** — Günlük sınırlar: öğrenciye günde en fazla 10 tekrar sorusu ve 24 saatte en
fazla 30 alıştırma sorusu veriliyor. Bu sayılar uygun mu?

> Cevap:

**Soru 10.6** — Benzer soru bulunamazsa ne olsun? (a) Kazanımın başka sorusu yoksa aynı
konudan bir soru gelsin mi? (b) Hiç benzer soru yoksa öğrencinin yanlış yaptığı asıl soru
tekrar sorulsun mu, yoksa o madde bekletilsin mi?

> Cevap:

**Soru 10.7** — Çalışma modunda yanlış şıkkın açıklaması, hata tipinin genel tavsiyesinden
geliyor (ör. işlem hatası için "işlemi adım adım kontrol et"). Tek bir yanlış için bu dil
uygun mu, yoksa her şık için kısa, soruya özel açıklama mı yazılmalı?

> Cevap:

**Soru 10.8** — Haftalık plandaki "Yanlışlarını deftere geçir" maddesi: yanlışlar artık
deftere kendiliğinden giriyor. Bu madde kalksın mı, yoksa "defterdeki tekrarlarını yap"
gibi bir maddeye mi dönüşsün?

> Cevap:

**Soru 10.9** — Video çözümleriniz var mı? Varsa soruya bir bağlantı alanı açarız; sonuç
ekranında yazılı çözümün yanında çıkar.

> Cevap:

**Soru 10.10** — Veliye salt okunur, süreli bir rapor bağlantısı (WhatsApp'tan
paylaşılabilir) düşünüyoruz; bugün yalnızca PDF var. Veli neyi görmeli: yalnızca genel
tablo (net, güçlü ve zayıf konular) mı, soru soru ayrıntı da mı?

> Cevap:

---

## 11. Soru dosyası kuralları (yeni, 10 Ekim)

Soru dosyaları artık panelden de yükleniyor: önce denetim raporu çıkıyor, sonra sorular
taslak olarak kaydediliyor. Şu kurallar sizin kararınızı bekliyor:

**Soru 11.1** — Sistemin çizemediği (yazımı hatalı) formüller şu an yalnızca uyarı veriyor;
soru yine kaydediliyor. Bu sorular hiç kaydedilmesin mi?

> Cevap:

**Soru 11.2** — Görsel şu an yalnızca soru metninde kullanılabiliyor; şıklarda ve çözümde
kabul edilmiyor. Şıkları görsel olan sorular (ör. grafik seçenekleri) ya da şekilli çözümler
olacak mı?

> Cevap:

**Soru 11.3** — Şablonda "Çözüm Açıklaması" zorunlu yazıyor ama içe aktarma eksikliği yalnızca
uyarıyla geçiyor. Çözümü olmayan soru kaydedilmesin mi?

> Cevap:

**Soru 11.4** — Kazanım kodu yalnızca Seviye 1 sorularında zorunlu. Seviye 2 ve 3 soruları
birden çok kazanımı birleştirdiği için bu alan orada boş kalabiliyor. Uygun mu?

> Cevap:

**Soru 11.5** — Yüklenen sorular varsayılan olarak taslak; içerik yetkisi olan kişi isterse
"doğrudan yayına al" seçeneğiyle hemen yayınlayabiliyor. Bu seçenek kalsın mı, yoksa her soru
önce incelemeden mi geçsin (Soru 10.1)?

> Cevap:

---

Teşekkürler. Cevaplar geldikçe `app/lib/exams.ts` (sınav sabitleri), `app/lib/levels.ts`
(kapı eşikleri) ve kazanım listesi güncellenecek; soru dosyaları `npm run import:questions`
ile alınacak.
