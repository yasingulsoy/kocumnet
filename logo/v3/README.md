# Logo v3 — bambaşka yönler

v1 (K-nokta) ve v2 (kare kutuda beyaz K varyasyonları) beğenilmedi. Bu klasörde
kutu-içinde-harf kalıbından tamamen çıkan altı yön var; her birinin kendi fikri,
rengi ve yazı tipi.

```
logo/v3/
  sunum.html   Altı yön: büyük hâli, site başlığı, 16 px sekme, telefon ana ekranı
  build.mjs    Sayfayı yeniden üretir: node logo/v3/build.mjs
```

Hiçbiri henüz uygulamalara bağlı değil. Yön seçilince yazı çizgiye (outline)
çevrilir, üretim SVG'si `design/logo/`'ya taşınır, ikonlar üç projeye üretilir
ve gerekiyorsa renk paleti `design/tokens.css`'e işlenir.

| # | Yön | Fikir | Renk / yazı |
| --- | --- | --- | --- |
| 1 | **Optik** (önerim) | Optik formda doldurulan baloncuklar bir K çiziyor | Mürekkep, optik pembesi · Manrope |
| 2 | Koç | "Koçum!" — kıvrık boynuzlu geometrik koç amblemi | Turuncu, gece · Outfit |
| 3 | Fosfor | "net" fosforlu kalemle çizilmiş (.net = sınav neti) | Fosforlu sarı, lacivert · Baloo 2 |
| 4 | Mühür | Köklü kurum mührü, serif K | Orman yeşili, altın · DM Serif Display |
| 5 | Aferin | Öğretmenin el yazısı, kırmızı kalemle altı çizili ✓ | Dolma kalem mavisi, kırmızı · el yazısı |
| 6 | Blok | Kalın büyük harf kare blok, ".NET" skor tabelası gibi | Siyah, asit yeşili · Archivo Black |

## Gemini istemleri

**1 · Optik**

```text
Logo for "koçum.net", a Turkish exam-coaching brand. The symbol is a small grid of bubbles from a multiple-choice optical answer sheet (4 columns A-D, 5 rows): most bubbles are empty outlines in coral pink #EF5B5B, and the filled-in ink-black bubbles together form a capital letter K. Next to it, the lowercase wordmark "koçum.net" in a bold modern geometric sans-serif, dark ink #1C1F2B, with the dot in coral. Flat vector, off-white paper background #FFF7F2, no gradients, no 3D, no shadows, no extra icons. Spell exactly "koçum.net" with the Turkish ç.
```

**2 · Koç**

```text
Flat vector emblem logo for "Koçum.net". In Turkish "koç" means both "coach" and "ram". A friendly but determined geometric ram head seen from the front, with two big curled spiral horns, inside a solid orange circle #FF6B3D; the ram is drawn in dark navy-black #1F1D33 with simple dot eyes and no realistic detail. Next to it the wordmark "Koçum" in a heavy rounded geometric sans-serif and ".net" in orange. Modern sports-team feel, not childish, no zodiac symbol, no other text. Cream background.
```

**5 · Aferin**

```text
Hand-lettered logo for "koçum.net": the word "koçum" written in confident, friendly fountain-pen handwriting in deep blue ink #2340A0, underlined with a single red pen stroke #E5383B and followed by a small red teacher's checkmark, like a teacher writing "well done" on a student's paper. ".net" set small in a clean sans-serif. Off-white paper background, flat vector, no notebook lines, no other illustrations. Spell exactly "koçum" with the Turkish ç.
```

**Serbest keşif**

```text
Create 6 completely different logo concepts for "Koçum.Net", a Turkish exam-preparation coaching brand for students (motto: "Sınava kadar aklında", meaning "it stays with you until exam day"). Do NOT put a white letter inside a rounded-square app tile. Explore varied styles: an emblem or mascot, a wordmark with one clever detail, a hand-lettered mark, a bold typographic badge, an abstract symbol, a vintage seal. Ideas to draw from: "koç" means both coach and ram; "net" is the Turkish exam score; optical answer-sheet bubbles; a teacher's red checkmark; highlighter pens. Give each concept its own color palette and typeface. Present as a 3x2 grid of flat vector logos on a white background.
```
