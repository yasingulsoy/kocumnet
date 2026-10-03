# Örnek içe aktarma dosyası

Bu dosya `scripts/import-questions.mts` için örnek ve aynı zamanda test
verisidir. Biçim: SORU-SABLONU.md (v3). Üçüncü soru BİLEREK hatalı — betiğin
reddetme raporunu göstermek için.

### Soru 01
* **ID:** ORNEK-TK-01
* **Konu Kodu:** temel-kavramlar
* **Zorluk:** 2
* **Seviye:** 1
* **Kazanım Kodu:** ORNEK-TK-A
* **Kazanım Adı:** Pozitif tam sayı kısıtı altında en büyük/en küçük değer analizi yapar.
* **İdeal Süre:** 60
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

### Soru 02
* **ID:** ORNEK-TK-02
* **Konu Kodu:** temel-kavramlar
* **Zorluk:** 1
* **Seviye:** 1
* **Kazanım Kodu:** ORNEK-TK-A
* **İdeal Süre:** 45
* **Hedef Sınav:** DGS, ALES
* **Soru Metni:**
$x$ ve $y$ pozitif tam sayılar ve $x + y = 9$ olduğuna göre, $x \cdot y$ çarpımının alabileceği en büyük değer kaçtır?
* **Seçenekler:**
  * [ ] A) 18 (ISLEM_HATASI: 9·2 alınmış)
  * [x] B) 20
  * [ ] C) 14 (KAVRAM_YANILGISI: en uzak değerler seçilmiş)
  * [ ] D) 8 (EKSIK_OKUMA: toplam 9 yerine 6 alınmış)
* **Doğru Şık:** B
* **Çözüm Açıklaması:**
Toplamı sabit iki sayının çarpımı, sayılar birbirine en yakınken en büyüktür: $4 \cdot 5 = 20$.

---

### Soru 03
* **ID:** ORNEK-HATALI-03
* **Konu Kodu:** olmayan-konu
* **Zorluk:** 7
* **Seviye:** 2
* **Kazanım Kodu:** ORNEK-TK-A
* **İdeal Süre:** hızlı
* **Soru Metni:**
Bu soru bilerek hatalı: konu kodu yok, zorluk 1-5 dışında, süre sayı değil,
seviye 2'ye kazanım yazılmış ve yanlış şıkların birinde hata kodu yok.
* **Seçenekler:**
  * [x] A) 1
  * [x] B) 2 (ISLEM_HATASI: iki doğru işaretli)
  * [ ] C) 3
  * [ ] D) 4 (DIGER)
  * [ ] E) 5 (UYDURMA_KOD: listede olmayan kod)
* **Doğru Şık:** C
* **Çözüm Açıklaması:**
Yok.
