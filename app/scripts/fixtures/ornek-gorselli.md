# Örnek soru dosyası (3 soru, biri şekilli)

Bu dosya panelde **Check-up → Sorular → Toplu içe aktar** ekranından indirilir.
Şekilli soru için **örnek şekli** (ornek-sekil.png) de indir ve bu dosyayla aynı
klasöre koy. Sonra ikisini birlikte seç (ya da klasörü seç) ve **Denetle**'ye bas:
üç soru da geçerli çıkar. Bu soruları havuza kaydetme; yalnızca biçimi gösteriyor.

Yazım kurallarının tamamı şablonda (Şablonu indir). Kısaca:

- Her soru `### Soru 01` gibi bir başlıkla başlar.
- Alanlar `* **Alan:** değer` biçimindedir; değer alttaki satırlarda da olabilir.
- Formül `$…$` içine yazılır. Ondalık sayı virgülle yazılır: `$3,5$`.
- Her yanlış şıkta parantez içinde hata tipi: kodu (`ISLEM_HATASI`) ya da adı
  (`İşlem hatası`), iki noktadan sonra kısa açıklama.
- Doğru şık `[x]` ile işaretlenir ve `Doğru Şık` satırına da yazılır.

### Soru 01
* **ID:** ORNEK-01
* **Konu Kodu:** lgs-ucgenler
* **Zorluk:** 2
* **Seviye:** 1
* **Kazanım Kodu:** ORNEK-UCGEN-A
* **Kazanım Adı:** Dik üçgende Pisagor bağıntısıyla kenar uzunluğu hesaplar.
* **İdeal Süre:** 60
* **Kaynak:** özgün
* **İpucu:** Dik açının karşısındaki kenar hangisi?
* **Soru Metni:**
![ABC dik üçgeni: B açısı dik, AB = 6 cm, BC = 8 cm, AC soruluyor](ornek-sekil.png)

Şekildeki $ABC$ üçgeninde $m(\widehat{B}) = 90^{\circ}$, $|AB| = 6$ cm ve $|BC| = 8$ cm olduğuna göre, $|AC|$ kaç cm'dir?
* **Seçenekler:**
  * [ ] A) 14 (Kavram yanılgısı: kenar uzunlukları toplanmış)
  * [x] B) 10
  * [ ] C) $2\sqrt{7}$ (Ters işlem: kareler toplanacağına çıkarılmış)
  * [ ] D) 100 (İşlem hatası: karekök alınmamış)
* **Doğru Şık:** B
* **Çözüm Açıklaması:**
Pisagor bağıntısı: $|AC|^2 = |AB|^2 + |BC|^2$.

---

$|AC|^2 = 36 + 64 = 100$, buradan $|AC| = 10$ cm.

---

### Soru 02
* **ID:** ORNEK-02
* **Konu Kodu:** yuzde-kar-zarar
* **Zorluk:** 3
* **Seviye:** 2
* **İdeal Süre:** 90
* **Kaynak:** özgün
* **Soru Metni:**
Bir mağaza, tanesini $40$ TL'ye aldığı gömlekleri $\%25$ kârla satıyor. Sezon sonunda satış fiyatı üzerinden $\%20$ indirim yapıyor.

İndirimli satışta gömlek başına kâr ya da zarar ne kadardır?
* **Seçenekler:**
  * [ ] A) $2$ TL kâr (TERS_ISLEM: indirim alış fiyatı üzerinden hesaplanmış)
  * [x] B) Kâr da zarar da yok
  * [ ] C) $2,5$ TL kâr (KAVRAM_YANILGISI: yüzdeler çıkarılıp satış fiyatına uygulanmış)
  * [ ] D) $10$ TL zarar (EKSIK_OKUMA: alış fiyatı atlanmış, fiyat düşüşü zarar sanılmış)
  * [ ] E) $8$ TL zarar (ISLEM_HATASI: indirim tutarı zarar sayılmış)
* **Doğru Şık:** B
* **Çözüm Açıklaması:**
Satış fiyatı: $40 \cdot 1,25 = 50$ TL.

---

İndirimli fiyat: $50 \cdot 0,8 = 40$ TL. Alış fiyatına eşit: kâr da zarar da yok.

---

### Soru 03
* **ID:** ORNEK-03
* **Konu Kodu:** bolunebilme
* **Zorluk:** 4
* **Seviye:** 3
* **İdeal Süre:** 120
* **Kaynak:** özgün
* **Hedef Sınav:** TYT
* **Video:** https://youtu.be/aqz-KE-bpKQ?t=30
* **İpucu:** $36 = 4 \cdot 9$: sayı hem $4$'e hem $9$'a bölünmeli.
* **İpucu:** $4$ ile bölünebilme için son iki basamağa, $9$ ile bölünebilme için rakamlar toplamına bak.
* **Soru Metni:**
Dört basamaklı $\overline{3a5b}$ sayısı $36$ ile tam bölünebildiğine göre,

- $b$ çift sayıdır.
- $a + b = 10$'dur.
- $a > b$'dir.

ifadelerinden hangileri kesinlikle doğrudur?
* **Seçenekler:**
  * [ ] A) Yalnız I (EKSIK_OKUMA: 9 ile bölünebilme şartı kullanılmamış)
  * [ ] B) Yalnız II (KAVRAM_YANILGISI: 4 ile bölünebilme kuralı bilinmiyor)
  * [x] C) I ve II
  * [ ] D) II ve III (ISLEM_HATASI: b'nin alabileceği değerler yanlış bulunmuş)
  * [ ] E) I, II ve III (EKSIK_OKUMA: yalnızca 3852 denenmiş, 3456 gözden kaçmış)
* **Doğru Şık:** C
* **Çözüm Açıklaması:**
$4$ ile bölünebilme: $\overline{5b}$ sayısı $4$'ün katı, buradan $b = 2$ ya da $b = 6$. I kesin.

---

$9$ ile bölünebilme: $3 + a + 5 + b$ toplamı $9$'un katı. $b = 2$ için $a = 8$, $b = 6$ için $a = 4$. İkisinde de $a + b = 10$: II kesin.

---

$a = 4$, $b = 6$ için $a > b$ değil: III kesin değil. Cevap I ve II.

---
