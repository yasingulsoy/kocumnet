# Yol haritası: Check-up'ı içerikle doldurmak ve yayına almak

Ürünün iskeleti hazır: sınav ekranı, sonuç ve hata teşhisi, haftalık plan, kontrol
testi, seviyeli check-up, gelişim sayfası; panelde soru girişi, madde analizi, riskli
öğrenciler ve koç notu. Eksik olanların çoğu yazılım değil: **içerik, yayına alma ve
iş kararları.** Yazılımda yapılacaklar da çoğunlukla içeriğin girilmesini kolaylaştırmak
ve öğrencinin öğrenme döngüsünü kapatmak için.

---

## 1. Eksikler (önem sırasıyla)

| # | Eksik | Kimde | Neden önemli |
| --- | --- | --- | --- |
| 1 | ✅ **10 Ekim: yayında** (api.kocum.net, veritabanı bağlı). Kalan: `backend/uploads` kalıcı volume'u, `CRON_SECRET`, e-posta (SMTP ve MX) | Sen (Dokploy, DNS) | Volume olmazsa her dağıtımda bütün blog görselleri silinir |
| 2 | ✅ **10 Ekim: yayında** (checkup.kocum.net, admin.kocum.net). Kalan: tohum, ilk yönetici, sitenin yeniden dağıtımı | Sen | Öğrenci ve içerik ekibi giremiyor |
| 3 | Kazanım listesi | Hoca | Seviye 1 bu liste olmadan kurulamıyor |
| 4 | Gerçek sorular | Hoca ve içerik ekibi | Havuz boş: öğrenci hiçbir paketi göremez |
| 5 | Sınav sabitleri ve tarihleri | Hoca | KPSS, DGS, ALES'te yanlış götürme kuralı netleri değiştiriyor |
| 6 | E-posta (Resend) | Sen | Davet, parola sıfırlama ve haftalık posta bunsuz çalışmaz |
| 7 | Paketler ve fiyat | Hoca ve sen | Neyin ücretsiz, neyin ücretli olacağı |
| 8 | Ödeme, mesafeli satış ve cayma hakkı metinleri | Sen ve hukukçu | Ücretli satış; öğrencilerin bir kısmı 18 yaş altı |


### 1.1 Güvenlik ve hukuk (22 Ekim incelemesinden, sende)

| İş | Neden |
| --- | --- |
| **Depo herkese açık ve ilk commit'te `backend/.env` var.** Oradaki veritabanı parolasının ve yönetici parolasının üretimde, personel hesaplarında ya da aynı sunucudaki öteki projelerde kullanılmadığını doğrula; kullanılıyorsa değiştir. | Geçmiş yeniden yazılmaz; çare değeri değiştirmek. JWT anahtarı zayıf olduğu için üretim onu zaten reddediyor. |
| Cloudflare'de HSTS (önce kısa süre) ve www → kocum.net yönlendirmesi (308) | Yalnızca api.kocum.net HSTS veriyor; www ayrı adres olarak açılıyor. |
| Kaynak sunucuya Cloudflare'i atlayarak erişim (187.127.84.141:443) ve Dokploy panelinin düz HTTP'si | Authenticated Origin Pulls ya da güvenlik duvarı; panel HTTPS'li bir alan adının arkasına. |
| Traefik'te `forwardedHeaders.trustedIPs` AYARLAMA | Hız sınırları istemci IP'sini Cloudflare aralığını denetleyerek okuyor; o ayar istemci başlıklarını sahtelenebilir yapar. |
| Gizlilik metinlerindeki `HUKUK:` işaretleri: veri sorumlusunun unvanı ve adresi, hukuki sebepler, yurt dışı aktarım dayanağı, veli onayının kaydı | Kodda ve metinde bilinen olgular yazıldı; bunlar hukukçuya kalıyor (check-up `/gizlilik`, kocum.net `/gizlilik`). |
| Saklama süreleri: iletişim mesajları (varsayılan 730 gün, `CONTACT_RETENTION_DAYS`), çözülmüş hata bildirimleri ve koça sorular | Mesajlar anonimleşiyor; bildirim ve koça soru için süre henüz kararlaştırılmadı. |

---

## 2. Sorular nasıl sağlanacak

### 2.1 Üç kaynak

**A. Hocanın elindeki sorular.** En hızlı yol. Word ya da InDesign dosyası varsa toplu
dönüştürürüz; yalnızca PDF varsa elle girilir. Sorular içe aktarma ile "Taslak" olarak
girer, hoca panelde onaylar.

**B. Yeni yazılan sorular.** İki yol var:
- Panelde tek tek: formül yazımı ve canlı önizleme, görsel yükleme, şık denetimi hazır.
- Word şablonunda toplu: ekip alıştığı araçta yazar, haftada bir dosya olarak yüklenir.
  Ekip için önerim bu.

**C. Parametrik şablonlar.** Özellikle Seviye 1 için önerim. Hoca bir soru kalıbı yazar:
sayı aralıkları, doğru cevabın formülü, her yanlış şıkkın hangi hatadan çıktığı.
Sistem bu kalıptan onlarca farklı soru üretir ve her birini denetler.
- Telafi turunda öğrenciye aynı soru asla gelmemeli; bu yolla havuz tükenmez.
- Her yanlış şık bir hata tipine bağlı doğduğu için teşhis kendiliğinden çalışır.
- Demo soruları zaten bu yöntemle üretiliyor; altyapı kanıtlanmış durumda.
- Seviye 2 ve 3 (çok adımlı, sınav standardı) elle yazılmalı.

**Telif.** ÖSYM ve MEB'in çıkmış soruları izinsiz birebir kullanılamaz. "Sınav tarzında"
özgün soru yazılmalı. Çıkmış soru kullanılacaksa kaynağı yazılır ve izin konusu netleşir
(HOCAYA-SORULAR 8.3).

### 2.2 Her soruda olması gerekenler

| Alan | Neden |
| --- | --- |
| Konu ve kazanım kodu | Konu haritası ve Seviye 1 bunlarla kuruluyor |
| Seviye (1, 2, 3) ve zorluk (1-5) | Seviyeli akış ve paket dengesi |
| Hedef süre | "Yavaş" uyarısı |
| Doğru şık ve **her yanlış şıkkın hata tipi** | Teşhis buradan çıkıyor: "işlem hatası", "kavram yanılgısı" gibi |
| Adım adım çözüm | Sonuç ekranında öğrenci görüyor |
| Kaynak | Telif ve tekrar takibi |
| Görsel (varsa) ve alt metni | Şekilli sorular; alt metin zorunlu |

### 2.3 Akış: yazım, kontrol, yayın, ölçüm

1. **Taslak:** soru girilir. Sistem otomatik denetler: aynı değerli şık, boş şık, kazanım
   ile konu uyumu, sınav kapsamı, formül yazımı.
2. **İnceleme:** ikinci bir göz okur.
3. **Yayında:** öğrencilere çıkmaya başlar.
4. **Ölçüm:** 20 cevaptan sonra madde analizi sorunlu soruları işaretler: ters ayırt
   eden, çok kolay ya da zor, kimsenin seçmediği çeldirici.
5. **Düzelt ya da arşivle.**

### 2.4 Pilot için hedef sayılar

Tek sınavla başlamak en doğrusu. Önerim TYT ya da ALES/DGS.
- **Klasik paketler:** konu başına en az 3 soru. Örnek: TYT Çekirdek'in 8 konusunda
  10'ar soru, toplam 80.
- **Seviyeli check-up:** her kazanıma 2 soru (Seviye 1, yaklaşık 100), Seviye 2 için 25,
  Seviye 3 için 25. Toplam yaklaşık 150 soru.

### 2.5 Bunun için yazılımda yapılacaklar

| İş | Boyut | Fayda |
| --- | --- | --- |
| ✅ **Panelden toplu içe aktarma** (10 Ekim): dosya yükle, hata raporunu gör, onayla | Küçük-orta | Şu an yalnızca komut satırından; içerik ekibi geliştiriciye bağımlı kalmaz |
| Word (.docx) dosyasından içe aktarma | Orta | Hoca Word'de yazıyorsa dönüştürme adımı kalkar |
| Parametrik soru şablonu (panelde tanım, örnek üretme, onay) | Orta-büyük | Seviye 1 havuzu hızla dolar, telafi tükenmez |
| ✅ **İnceleme notları** (10 Ekim; 21 Ekim'den beri öğrencinin hata bildirimleri de) | Küçük | Hoca ile ekip panel içinde yazışır |

---

## 3. Sorular nasıl sunulacak

**Bugün olanlar:** süreli sınav ekranı ("sonra bak" işareti, soru paleti, bitirme özeti);
sonuçta net, konu haritası, hata tipi teşhisi ve çözümler; haftalık plan; 5 soruluk
kontrol testi; seviyeli check-up; gelişim grafiği.

**Önerilen eklemeler (öğrenme döngüsünü kapatmak için):**

1. ✅ **Çalışma modu** (10 Ekim). Süresiz; her sorudan sonra hemen doğru/yanlış, çözüm ve yanlış
   şıkkın neden yanlış olduğu. Sınav modu ölçmek için kalır, çalışma modu öğretmek için.
2. ✅ **Yanlış defteri ve aralıklı tekrar** (10 Ekim). Her yanlış ya da boş soru deftere girer.
   1, 3 ve 7 gün sonra aynı kazanımdan benzer bir soru sorulur; doğru yapılınca defterden
   çıkar. Pedagojik değeri en yüksek ekleme bu.
3. ✅ **"Benzerini çöz"** (10 Ekim). Sonuç ekranında her yanlışın yanında, aynı kazanımdan yeni soru.
4. ✅ **Çözüm sunumu** (21 Ekim): adım adım açılan çözüm, isteğe bağlı video, alıştırmada
   kademeli ipucu, yanlış yapılan kazanımın özet kartı.
5. ✅ **Veliye rapor bağlantısı** (10 Ekim): salt okunur, süreli bağlantı; WhatsApp'tan paylaşılır.
6. ✅ **Okuma kolaylığı** (10 Ekim): yazı boyutu ayarı, görselde yakınlaştırma.

**21 Ekim'de eklenenler (sınav ve koçluk):**

- **Deneme sınavı:** gerçek sınavın soru sayısı, süresi ve yanlış götürme kuralıyla; sorular
  sabit, sonuçta çözenler arasındaki yer (en az 10 kişiden sonra). Panelde dağılıma göre doldurma.
- **Kâğıtta çöz:** yazdırılabilir kitapçık ve cevap kâğıdı; cevaplar optik forma işlenir.
- **Karalama alanı:** sorunun üstüne parmakla ya da kalemle yazma (sınav ve alıştırma).
- **Süre ve strateji:** takılınan sorular, çözüm sırası, turlama, son dakikalar.
- **Hata bildirimi ve koça soru:** öğrenci bir soruda hata bildirir ya da koça yazar; panelde
  ayrı listeler.
- **Grup ve ödev:** koç grup kurar, paket ya da konu alıştırması ödevi verir; tamamlanma
  sistemden okunur, "Bugün" kartında ve ödevler sayfasında görünür; grup ısı haritası.
- **Seri ve günlük hedef:** ana sayfada seri kartı, profilde günlük soru hedefi.

---

## 4. Kullanıcı kolaylığı

**Öğrenci:**
- ✅ **Tek "bugün" kartı** (10 Ekim; 21 Ekim'den beri koçun ödevi de).
- **Kısa oturumlar:** telefonda 10-15 dakikalık işler.
- **Parolasız giriş:** e-postaya gelen bağlantıyla giriş (e-posta altyapısı gerekir).
- **Hatırlatma:** haftalık posta, seri ve günlük hedef hazır (21 Ekim); tarayıcı bildirimi eklenebilir.

**Koç ve içerik ekibi:**
- Yapıldı: panelden içe aktarma ve inceleme notları (10 Ekim); grup ve ödev, öğrenci soruları,
  hata bildirimleri, deneme oluşturucu (21 Ekim).
- Hazır: paket düzenleyici, riskli öğrenciler, koç notu ve madde analizi. Tohum betiği
  panelde düzenlenen paketleri artık ezmiyor; yalnızca `--guncelle` ile yazıyor.

---

## 5. Önerilen sıra

| Ne zaman | İş | Sonuç |
| --- | --- | --- |
| 1. hafta | Backend, panel ve check-up'ı yayına almak; e-posta; hocayla ilk toplantı (§6) | Sitedeki form çalışır, ekip panele girer |
| 2.-3. hafta | Panelden toplu içe aktarma, gerekirse Word desteği, inceleme notları; ekip pilot havuzunu doldurur | Pilot sınavın soruları hazır |
| 3.-4. hafta | Çalışma modu, yanlış defteri, "benzerini çöz" | Öğrenme döngüsü kapanır |
| 5. hafta | Pilot: 20-30 öğrenci, ücretsiz; madde analiziyle düzeltme; veli bağlantısı | Gerçek veriyle ayar |
| Sonrası | Ödeme, hukuki metinler, fiyat; ikinci sınav | Ücretli açılış |

---

## 6. Hocayla ilk toplantının gündemi (30-45 dakika)

1. Pilot hangi sınavla başlasın?
2. Eldeki sorular hangi biçimde: Word, InDesign, PDF? Kaç tane, hangi konular?
3. Kazanım listesini kim, ne zamana kadar çıkaracak?
4. Yeni soruları kim yazacak, kim inceleyecek?
5. Çözüm ve hata tipi yazımında ortak bir standart.
6. Seviye 1 için parametrik şablon fikri.

Ayrıntılı sorular [HOCAYA-SORULAR.md](HOCAYA-SORULAR.md) dosyasında.
