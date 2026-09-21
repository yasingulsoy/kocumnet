# Koçum.Net — Matematik Check-up

Öğrencinin matematik seviyesini kısa bir testle ölçen, zayıf konularını çıkaran ve
buna göre Koçum.Net yayınını öneren uygulama.

**Kararların gerekçeleri [PLAN.md](PLAN.md)'de.** Bir şeyi değiştirmeden önce oraya bak:
çoğu "tuhaf" görünen tercih bilinçli.

## Kurulum

```bash
npm install
npm run db:migrate        # şema
npm run db:seed           # konu ağacı + paketler (idempotent, tekrar çalıştırmak güvenli)
npm run db:seed:demo      # 417 demo sorusu — SADECE geliştirme
npm run dev -- --port 3100
```

`.env` içinde iki değer gerekir:

```
DATABASE_URL="postgresql://.../kocumnet_checkup?schema=public"
SESSION_SECRET="<32 baytlık rastgele hex>"
```

Yönetici hesabı ancak `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` verilirse açılır.
Bilinen varsayılan parolalı hesap yaratmıyoruz.

## Doğrulama

Her değişiklikten sonra ikisi de çalıştırılmalı:

```bash
npm run smoke        # saf mantık: parola, içerik şeması, parmak izi, net, teşhis
npm run test:markup  # yazım biçimi ayrıştırma + düzenleme gidiş-dönüşü
npm run test:leak    # uçtan uca akış + CEVAP ANAHTARI SIZINTI DENETİMİ
```

`test:leak` öğrenciye giden JSON'da `isCorrect`/`errorType` olmadığını doğrular.
Bu denetim olmadan sızıntı sessizdir: arayüz çalışmaya devam eder, testin anlamı kalmaz.

## Yapı

```
lib/
  db.ts                  Prisma bağlantısı (driver adapter + HMR koruması)
  auth.ts                Oturum: token'ın hash'i saklanır, kendisi değil
  password.ts            scrypt (Node çekirdeği — native derleme yok)
  question-content.ts    JSONB blok şeması, stemText, parmak izi, şık doğrulaması
  question-markup.ts     $…$ ve ![alt](id) yazım biçimi ⇄ bloklar (çift yönlü)
  error-types.ts         Çeldirici hata tipleri (server action dosyasında OLMAZ)
  question-selection.ts  Katmanlı soru seçimi (adaptif DEĞİL — PLAN §5)
  diagnosis.ts           Hata deseni + ilerleme karşılaştırması (saf)
  entitlements.ts        Ücretli paket erişim denetimi
  mailer.ts              E-posta (SMTP yoksa SESSİZ BAŞARISIZ OLMAZ)
  legal.ts               Toplanan veri listesi (şemayla hizalı tutulmalı)
  scoring.ts             Net + konu teşhisi (saf fonksiyonlar)
  checkup.ts             Akış: başlat → cevapla → bitir
  actions/               Server action'lar
app/
  giris · kayit          Kimlik
  sifremi-unuttum        Parola sıfırlama talebi
  sifre-sifirla/[token]  Yeni parola (tek kullanımlık jeton)
  gizlilik               KVKK aydınlatma metni (TASLAK — hukukçu okumalı)
  checkup/[sessionId]    Test ekranı (tek soru, klavye destekli)
  sonuc/[sessionId]      Konu haritası + ürün önerisi
  gecmis                 Geçmiş testler + gelişim
  admin                  Havuz panosu, sorular, öğrenciler/erişim hakları
  api/media/[id]         Görsel servisi (baytlar veritabanında)
components/
  MathContent.tsx        LaTeX → HTML, SUNUCUDA (KaTeX JS istemciye gitmez)
  ContentPreview.tsx     Canlı önizleme — KaTeX SADECE admin paketine iner
  ImageUploader.tsx      Şekil yükleme (sharp ile WebP'ye çevirir)
```

## Bilinmesi gerekenler

- **Prisma 7'de `migrate dev` client'ı yeniden ÜRETMEZ** ve çalışan `next dev` eskisini
  bellekte tutar. `dev` ve `db:migrate` script'leri `prisma generate` ile başlıyor;
  şema değiştirdikten sonra **dev sunucusunu yeniden başlatın**.
- **Prisma 7 eski sürümlerden çok farklı** — config `prisma7.config.ts`, `datasource`
  bloğunda `url` yok, driver adapter zorunlu, üretilen client TypeScript kaynağı.
  Detay PLAN §7'de.
- **Üretilen client gitignore'da**, bu yüzden `build` script'i `prisma generate`
  ile başlıyor. Kaldırma, deploy patlar.
- **Betikler `.mts` uzantılı** olmak zorunda (`type: module` yok; tsx `.ts`'yi CJS
  sayıp top-level await'i reddediyor).
- **Bir pakette bir konuya en az 3 soru** — tek soruyla konu seviyesi ölçülemez.
  `seed.ts` bunu zorunlu kılıyor (PLAN §2).
- **`"use server"` dosyalarından yalnızca async fonksiyon ihraç edilir.** Sabit bir
  nesne oradan dışa aktarılırsa istemciye BOŞ ulaşır ve hata sessizdir (açılır liste
  boş görünür). Bu yüzden `error-types.ts` ayrı duruyor.
- **Görseller veritabanında** (`MediaAsset.data`), diskte değil — konteyner geçici,
  volume unutulursa şekiller sessizce kaybolurdu. Detay PLAN §9.5.
- **Server action gövde sınırı 1 MB'dır**; şekil fotoğrafları aşar. `next.config.ts`
  içinde 10 MB'a çekildi, kaldırma.
- **React 19 form eylemi bitince formu sıfırlar.** `<select>` DOM'da varsayılana döner
  ve React geri yazmaz; admin formunda seçimler gizli alanlarla taşınıyor ve görünen
  select'ler efektle durumdan geri yazılıyor (`QuestionForm.tsx`).
