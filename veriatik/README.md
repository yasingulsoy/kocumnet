# veriatik.com

VERİATİK Eğitim Hizmetleri ve Yayıncılık A.Ş. web sitesi. Şu an "çok yakında" tanıtım sayfası.

Next 16 (App Router), TypeScript, Tailwind 4. kocum.net'ten ayrı bir marka: kocum.net'in tasarım belirteçleri (`design/`) burada kullanılmaz.

```bash
npm install
npm run dev     # http://localhost:3000 (önizleme ayarında 3400)
npm run build && npm run start
```

- Sayfa: `app/page.tsx`, stiller ve kurumsal renkler: `app/globals.css`.
- Amblem: `components/Amblem.tsx`, favikon `app/icon.svg` (aynı çizimin yazısız hâli).
- Yazı tipleri (Inter, Plus Jakarta Sans) `next/font` ile sitenin kendisinden sunulur.
- Yayın: Dokploy, Nixpacks (`nixpacks.toml`), build path `/veriatik`, port 3000.
- Paket eklerken kilit dosyası npm 10 ile: `npx npm@10.9.4 install <paket>`.
