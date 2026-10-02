# Koçum.Net — logo çalışması

Bu klasör bir **öneri dosyası**. Henüz hiçbir yere bağlanmadı: site ve
check-up uygulaması hâlâ kendi eski işaretlerini kullanıyor. Yön seçilince
bağlarım.

```
logo/
  karsilastirma.svg      Üç yön, beş boyutta yan yana — önce buna bak
  onizleme.html          Tarayıcıda aç: kilitlenmeler, üst çubuk, sekme örneği
  svg/                   Üretim dosyaları
    01-kn-duzeltilmis.svg
    02-k-nokta.svg              ← önerim
    02-k-nokta-mono-beyaz.svg   koyu zemin, tek renk
    02-k-nokta-mono-koyu.svg    açık zemin, tek renk
    03-k-sade.svg
    favicon-16.svg              16px için ayrı çizim
```

---

## Gönderdiğin dosyada düzeltilmesi gerekenler

| Sorun | Neden önemli |
| --- | --- |
| Sarı + yeşil | Markanın hiçbir yerinde yok. Palet tamamen mavi ailesi: `#17305e` · `#1a5fb4` · `#0e90d5`. Siteyi ve uygulamayı bu üç ton taşıyor. |
| **"Koçum Net"** yazıyor | Marka **Koçum.Net**. Nokta alan adının parçası; düşünce marka adı değişmiş oluyor. |
| "n" kareden taşıyor | 24px altında lekeye dönüşüyor. `karsilastirma.svg`'de görebilirsin. |
| K ızgaraya oturmuyor | Kollar farklı açılarda, gövdeyle aynı noktada birleşmiyor. |
| JPG | Logo **SVG** olmalı: her boyutta net, dosya küçük, rengi kodla değiştirilebilir. JPG büyütünce bulanıklaşır, şeffaf zemin de olmaz. |

---

## Üç yön

### Yön 1 — senin fikrinin düzeltilmiş hâli
"Kn" konsepti korundu. Renkler markaya çekildi, "n" kare içine alındı, K
ızgaraya oturtuldu. **Zayıf yanı:** iki harf küçük boyutta yan yana
duramıyor; 24px'te "n" okunmaz oluyor.

### Yön 2 — önerim
K'nın üst kolu yükselen bir çizgiye dönüşüp ucunda bir noktayla bitiyor.

Bu nokta tesadüfi değil: check-up uygulamasının işaretinde onay işaretinin
sağ kolu aynı şekilde yükselip aynı noktayla bitiyor
(`app/components/ui/logo.tsx`). İki ürün böylece akraba görünüyor —
ana marka **K**, ürün **✓**, ikisinde de aynı yükselen hareket ve aynı nokta.

Ayrıca anlamı da taşıyor: koç yön gösterir ve yükseltir.

### Yön 3 — en sade
Sadece K. "Net" işarette değil, wordmark'ta yaşıyor. En güvenli seçenek.
Yön 2'deki noktayı fazla bulursan bu kalır.

**Not:** 16px'te Yön 2 ile Yön 3 neredeyse aynı görünüyor. Noktanın değeri
büyük boyutta ve aile bağında; favicon'da fark etmiyor.

---

## Kullanım kuralları (yön seçilince geçerli)

**Boşluk.** İşaretin her yanında en az, karenin köşe yarıçapı kadar
(yüksekliğin ~%28'i) boşluk bırak. Başka öğe o alana girmesin.

**En küçük boyut.** Ekranda 16px, baskıda 8mm. Altına inmesi gerekiyorsa
`favicon-16.svg` kullan — o ayrı çizildi: gradyan yok (16px'te bant
yapıyor), çizgiler kalınlaştırıldı.

**Zemin.** Kareli sürüm her zemine oturur. Tek renk sürümde kare yok:
koyu zeminde beyaz, açık zeminde lacivert.

**Yapma:**
- Gradyanın yönünü ya da renklerini değiştirme
- İşareti eğme, gölge ekleme, konturlama
- Kareyi daire ya da başka şekle çevirme
- Wordmark'ı işaretin altına sıkıştırıp tek görsel hâline getirme —
  yatay ve dikey kilitlenme ayrı ayrı var

**Wordmark.** Poppins SemiBold/Bold. ".Net" camgöbeği (`#0e90d5`),
"Koçum" lacivert (`#17305e`). Koyu zeminde "Koçum" beyaz, ".Net" `#8ecdf5`.

---

## Yön seçilince yapılacaklar

1. `frontend/components/LogoMark.tsx` → yeni işaret (şu an soyut çift yaprak)
2. `app/components/ui/logo.tsx` → aile bağı kurulacaksa nokta hizalanır
3. `frontend/app/icon.svg` + `apple-icon.png` + `public/icons/*` yenilenir
4. `admin/` giriş ekranı ve üst çubuk
5. Sosyal medya profilleri, e-posta imzası, antetli kağıt

Wordmark'ın SVG içindeki metni **canlı yazı** olarak duruyor (Poppins).
Web için doğrusu bu — net çıkıyor ve renk temaya göre değişebiliyor.
Matbaaya gidecek dosyada yazının "outline"a çevrilmesi gerekir; o dosyayı
istersen ayrıca hazırlarım.
