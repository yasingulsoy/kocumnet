# Logo v2 — yeni yönler

K-nokta (v1, Yön 2) beğenilmedi; bu klasör altı yeni yön içeriyor. Hiçbiri henüz
uygulamalara bağlı değil — sitede ve panellerde hâlâ K-nokta duruyor.

```
logo/v2/
  sunum.html          Her yön gerçek kullanım yerlerinde (başlık, sekme, telefon, altbilgi)
  karsilastirma.png   Altısı yan yana: 128 / 32 / 16 px, açık ve koyu zemin
  svg/                A-balon · B-yukselis · C-boynuz · D-kn · E-yon · F-onay
  build.mjs           Hepsini yeniden üretir: node logo/v2/build.mjs
```

| Yön | Fikir | Karar |
| --- | --- | --- |
| A · Balon | Konuşma balonu içinde K | Mesajlaşma uygulaması gibi duruyor |
| B · Yükseliş | Üst kol ok ucuyla biten yükselen çizgi | Net ama borsa/finans logolarında çok yaygın |
| C · Boynuz | Üst kol koç boynuzu gibi kıvrılıyor ("koç" = koç) | En akılda kalan; burç çağrışımı riski |
| D · Kn | İlk fikrin, rafine | 16 px'te "n" kayboluyor |
| E · Yön | K'nın kolları ok ucu | Oynat (▶) düğmesine benziyor |
| **F · Onay** | **Alt kol bir onay işareti** | **Önerim:** her boyutta K, ürünle (Check-up) aynı işaret |

## Seçim yapılınca

`build.mjs` içindeki seçilen yönün `govde`'si `design/logo/mark.svg`'ye taşınır;
`frontend/components/LogoMark.tsx`, `app/components/ui/logo.tsx`,
`admin/src/components/brand/Logo.tsx` aynı yollarla güncellenir ve
`node design/logo/build-icons.mjs` ikonları üç projeye yeniden üretir.

## Gemini istemleri

**F · Onay**

```text
Flat vector app-icon logo for "Koçum.Net", a Turkish exam-coaching platform. A bold geometric capital K drawn with thick rounded white strokes on a rounded square. The lower leg of the K turns into a checkmark: from the junction it goes down, then sweeps up to the right, so the letter reads both as "K" and as a check. Background: smooth diagonal gradient from deep navy #17305E through blue #1A5FB4 to cyan #0E90D5. Pure flat, no shadows, no 3D, no texture, no text. Centered with generous padding on a plain white background, readable at 16 px. 2048x2048 PNG, transparent background.
```

**C · Boynuz**

```text
Flat vector app-icon logo for "Koçum.Net". In Turkish, "koç" means both "coach" and "ram". A bold geometric capital K in thick rounded white strokes on a rounded square; the upper arm of the K curls inward like a ram's horn and ends in a tight spiral, while the stem and lower leg stay straight. Elegant and modern, not cartoonish: no animal face, no zodiac symbol. Background: diagonal gradient navy #17305E to blue #1A5FB4 to cyan #0E90D5. Flat, no shadows, no text, centered on white, readable at 16 px. 2048x2048 PNG, transparent background.
```

**Serbest keşif**

```text
Six different flat vector logo mark concepts for "Koçum.Net", an online exam-preparation coaching brand for Turkish students (math check-up tests, weekly study plans, a personal coach that guides you level by level). Each concept is built from a capital letter K and expresses one of: guidance, reaching a target, verification (checkmark), step-by-step levels, or the double meaning of "koç" (coach and ram). Avoid: dots at the end of strokes, graduation caps, books, owls, light bulbs, mascots. Colors strictly navy #17305E, blue #1A5FB4, cyan #0E90D5 and white. Each mark inside a rounded square, flat, no 3D, no text. Present as a 3x2 grid on a white background.
```
