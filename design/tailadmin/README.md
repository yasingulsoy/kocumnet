# design/tailadmin — TailAdmin kiti

Yönetim arayüzlerinin ortak bileşen kiti. Kaynak **TailAdmin Free Next.js 2.4.0**
(MIT, `LICENSE`). İndirilen şablon `vendor/tailadmin-free-nextjs/` altında durur,
depoya girmez; yalnızca kaynak olarak okunur. Her dosya
`Uyarlama: TailAdmin Free (MIT) — <kaynak dosya>` satırıyla başlar ve
TailAdmin'den farkını yazar. Yeni bileşen eklerken de bu satırı koy.

Kullanan: **kocum.net** tanıtım sitesi ve **kocum.net/admin** site yönetimi
(ikisi de `frontend/`, stil dosyaları ayrı), **check-up uygulaması** (`app/`,
öğrenci) ve **check-up paneli** (`admin/`, personel) — bkz. [Geçiş notları](#geçiş-notları).

```
design/tailadmin/
  theme.css     Tailwind teması: kırılmalar, yazı ölçeği, gri/anlam/marka ölçekleri, gölgeler, menü yardımcıları
  cx.ts         sınıf birleştirici (clsx ve tailwind-merge yok)
  lib/          scroll-lock: pencere ve çekmece için iç içe kaydırma kilidi
  ui/           Button, Badge, Alert, Modal, Dialogs, Dropdown, Avatar, Table, Card,
                PageBreadcrumb, MetricCard, EmptyState, Pagination, SegmentedTabs, GridShape
  form/         styles, Field, Label, Input, TextArea, Select, Checkbox, Radio, Switch,
                FileInput, DateInput, MultiSelect
  layout/       DashboardShell (+ SidebarContext, AppSidebar, AppHeader, Backdrop, BottomNav, nav), AuthLayout
  header/       UserDropdown, NotificationDropdown
  profile/      ProfileCard, SettingsCard
  media/        ResponsiveImage, ImageGrid, VideoEmbed
  charts/       ChartCard, BarChart, RadialGauge, MeterList — bağımlılıksız (SVG/CSS)
  pages/        ErrorPage (404 / hata düzeni)
  extras/       kütüphane isteyen eklentiler; proje başına açılır
    dropzone/   Dropzone (react-dropzone)
    datepicker/ DatePicker (flatpickr)
    charts/     ApexCharts grafikleri (lisans onayı gerekir)
  LICENSE       TailAdmin MIT lisansı
```

- **core** = `extras/` dışındaki her şey. React, Next ve lucide-react dışında
  bağımlılığı yok (üçü de her projede var).
- **extras** = bir kütüphane ister. Her proje yalnızca açtığını alır ve yalnızca
  onun paketini kurar.

## Projeye dağıtım

```bash
node design/sync.mjs          # kiti hedef projelere kopyala (tokens.css ve marka dosyalarıyla birlikte)
node design/sync.mjs --check  # kopyalar güncel mi, açık eklentilerin paketleri kurulu mu (CI)
```

Hedefler `sync.mjs` içindeki `KIT_HEDEFLERI`:

| Proje | theme.css → | Bileşenler → | Açık eklentiler |
| --- | --- | --- | --- |
| frontend | `frontend/app/tailadmin.css` | `frontend/components/tailadmin/` | dropzone, charts |
| app | `app/app/tailadmin.css` | `app/components/tailadmin/` | charts |
| admin | `admin/src/app/tailadmin.css` | `admin/src/components/tailadmin/` | dropzone, charts |

- Kopyalar **elle düzenlenmez**; değişiklik burada yapılır, sonra `node design/sync.mjs`.
- Hedef dizin kite aittir: kaynakta olmayan dosya `sync` ile silinir, `--check`
  hata verir. Projeye özgü bileşen oraya konmaz.
- Açık bir eklentinin paketi `package.json`'da yoksa `--check` hata verir ve
  kurulum komutunu yazar.
- Bileşenler `@/components/tailadmin/...` yolundan içe aktarılır; aşağıdaki
  örnekler bu yolu kullanır.

**Yeni proje eklemek**

1. `KIT_HEDEFLERI`'ne ekle: `{ css, dizin, paket, eklentiler: [] }`.
2. `globals.css` sırası: `@import "tailwindcss"; @import "./tokens.css"; @import "./tailadmin.css";`
   (tema tokens.css'ten sonra gelir; marka ölçeği tokens değişkenlerine bağlı).
3. `node design/sync.mjs`, sonra projede `npx next typegen`, `npx tsc --noEmit`,
   `npx eslint .`, `npm run build`.

## Kurallar

### Marka ve yazı

`brand-*` ölçeği tokens.css'e bağlı (`@theme inline`): çapa adımlar tokens
değişkenlerini izler, renk orada değişirse kit de değişir.

| Adım | Değer | Bağ / not |
| --- | --- | --- |
| brand-25 | `#f4f8fd` | ara adım |
| brand-50 | `#eaf1fb` | `var(--brand-wash)` — etkin menü, yumuşak düğme zemini |
| brand-100 | `#d6e4f7` | `var(--brand-wash-strong)` |
| brand-200 … 400 | `#b6d2f8` `#8db7f1` `#5a91da` | OKLCH ara adımlar (süs, çizgi) |
| brand-500 | `#1a5fb4` | `var(--brand)` — düğme, bağlantı; beyazda 6.29:1 |
| brand-600 | `#164f97` | `var(--brand-hover)` |
| brand-700, 800 | `#184484` `#193a71` | ara adımlar |
| brand-900 | `#17305e` | `var(--brand-deep)` |
| brand-950 | `#14213d` | logodaki lacivert (giriş sayfasının marka paneli) |

- Yazı: gövde **Inter** (`font-sans`), başlık **Poppins** (`font-display`).
  TailAdmin'in Outfit'i ve `--font-*: initial` sıfırlaması yok.
- Kırılmalar: Tailwind'in `sm…2xl`'i aynen + `2xsm` (375px), `xsm` (425px),
  `3xl` (2000px); hepsi rem (birimler karışırsa medya sorguları yanlış sıralanır).
- Gri ve anlam renkleri TailAdmin'in: `gray-*` (Tailwind'in varsayılan grisinin
  yerine geçer), `success-*`, `error-*`, `warning-*`, `blue-light-*` (bilgi),
  `orange-*`. Açık zeminde rozet/uyarı metni …-700; gri metin en açık
  `gray-500` (beyazda 4.97:1), `gray-400` yalnızca süs.
- Gölgeler `shadow-theme-xs…xl`, `shadow-focus-ring`; yazı `text-theme-xs/sm/xl`,
  `text-title-sm…2xl`.

### Koyu tema yok

`dark:` varyantı `.dark` sınıfına bağlı ve o sınıf hiçbir yerde eklenmez:
TailAdmin'den kopyalanan `dark:` sınıfları işletim sistemi koyu temadayken bile
etkisiz. Yeni kodda `dark:` yazma. (Neden: KaTeX ve beyaz zeminli soru görselleri.)

### className yalnızca ekler

tailwind-merge yok. `className` kitin sınıflarına **eklenir**; çatışan bir
sınıf (ikinci bir `w-*`, `h-*`, yazı boyutu, kenarlık rengi) verirsen hangisinin
kazanacağı CSS sırasına kalır. Çatışma yerine prop kullan: `size`, `block`,
`compact`, `large`, `fullWidth={false}`, `wrapperClassName`, `align`, `flush`,
`badge`, `tone`. Uygun prop yoksa kite ekle.

### RTL, Tailwind sürümü, sunucu/istemci

- Sol/sağ yerine `start/end`, `ms/me`, `ps/pe`, `text-start`; yön bildiren
  ikonlar `rtl:rotate-180` ya da `rtl:-scale-x-100`. Arapça sayfada bileşenler ayna görünür.
- Check-up paneli Tailwind **4.1**'de: 4.2'de gelen `inset-s-*`, `inset-e-*`,
  `mbs-*` gibi sınıflar kullanılmaz; `start-*`, `end-*`, `mt-*` kullanılır.
  Kitin bütün sınıfları 4.1.17, 4.2.2 ve 4.3.3'te aynı üretiliyor.
- `"use client"` olanlar: `form/*` (Label, Radio, Switch, styles hariç), `ui/Modal`,
  `ui/Dialogs`, `ui/Dropdown`, `layout/*` (AuthLayout ve nav hariç), `header/*`,
  `extras/*`. Gerisi sunucu bileşeninde de çalışır. `buttonClass`, `inputClass`
  gibi sınıf yardımcıları sunucuda da çağrılır. Fonksiyon alan prop'lar
  (`onClose`, `onPageChange`, `onClick`) yalnızca istemci bileşeninden verilir.
- Metinlerin varsayılanı Türkçe ("Kapat", "Menüyü aç", "Önceki"…); başka dil
  için `labels` ya da `…Label` prop'ları.
- Odak halkası tokens.css'in genel `:focus-visible`'ı; kit odak yönetimini
  (pencere, çekmece, açılır menü) kendisi yapar.

## Bileşenler

Prop listelerinde parantez içi varsayılan değerdir. Bileşenler kendi DOM
özelliklerini de geçirir (`<button>`, `<input>`… prop'ları).

### Düğme — `ui/Button`

`Button`: `variant` primary | outline | soft | ghost | danger | danger-outline |
outline-light (koyu bantta ikincil düğme; birincil orada `outline`, yani beyaz)
(primary) · `size` xs 36px | sm 44px | md 48px (sm) · `block` · `loading`
(dönen halka, kilit, `aria-busy`) · `startIcon` · `endIcon`. `type` varsayılanı
`"button"`. `ButtonLink`: aynı görünümde next/link. `buttonClass({ variant, size, block })`:
başka öğeye düğme görünümü.

```tsx
<Button type="submit" loading={pending} startIcon={<Save />}>Kaydet</Button>
<ButtonLink href="/admin/blog/yeni" variant="outline" size="xs" startIcon={<Plus />}>Yeni yazı</ButtonLink>
```

### Rozet — `ui/Badge`

`variant` light | solid (light) · `color` primary | success | error | warning |
info | light | dark (primary) · `size` sm | md (md) · `startIcon` · `endIcon` · `title`.

```tsx
<Badge color="success" size="sm">Yayında</Badge>
```

### Uyarı — `ui/Alert`

`variant` success | error | warning | info · `title` · `children` (ya da
TailAdmin uyumlu `message`) · `action` (altta düğmeler) · `showLink` +
`linkHref` + `linkText` · `onClose` + `closeLabel` (kapatma düğmesi) · `compact`.
Hata `role="alert"`, ötekiler `role="status"`.

```tsx
<Alert variant="error" title="Kaydedilemedi">{hata}</Alert>
<Alert variant="success" compact>Yanıt gönderildi.</Alert>
```

### Pencere — `ui/Modal`

Yerel `<dialog>` + `showModal()`: odak tuzağı, Esc, arka planın etkisizleşmesi
tarayıcıdan. `document.body`'ye taşınır (form içinde açılsa da iç içe form
olmaz); React olayları pencereden dışarı kabarmaz. Kapalıyken içerik çizilmez.

`isOpen` · `onClose` · `title` (erişilebilir ad olur) · `description` ·
`ariaLabel` / `labelledBy` / `describedBy` (başlık yoksa) · `size` sm 448px |
md 600px | lg 768px | xl 1024px (md) · `padded` (true) · `showCloseButton` (true)
· `isFullscreen` · `sheet` (telefonda alttan açılan tam genişlik tabaka, geniş
ekranda ortada kutu; soru paleti gibi başparmakla kullanılan listeler) ·
`dismissable` (true; false ise Esc, arka plan ve kapat düğmesi kapatmaz) ·
`closeLabel` ("Kapat") · `initialFocusRef` (yoksa ilk odaklanabilir öğe; kapat
düğmesi DOM'da en sonda).
`useModal()` → `{ isOpen, openModal, closeModal, toggleModal }`.

```tsx
const { isOpen, openModal, closeModal } = useModal();
<Button onClick={openModal}>Parolayı değiştir</Button>
<Modal isOpen={isOpen} onClose={closeModal} title="Parolayı değiştir" size="sm">
  <PasswordForm onDone={closeModal} />
</Modal>
```

### Onay ve soru — `ui/Dialogs`

`window.confirm` / `window.prompt` yerine. `useConfirm()` → `[pencere, onayla]`;
`onayla({ title, description, confirmLabel ("Onayla"), cancelLabel ("Vazgeç"), tone })`
`Promise<boolean>` döner. `tone` primary | warning | danger; danger'da odak
"Vazgeç"te başlar. `usePrompt()` → `[pencere, sor]`; `sor({ title, description,
label, hint, defaultValue, placeholder, confirmLabel ("Tamam"), cancelLabel,
inputMode, allowEmpty, maxLength })` iptalde `null` döner. Pencere öğesini bileşenin
çıktısına koymayı unutma. Denetimli sürümler: `ConfirmDialog`, `PromptDialog`.

```tsx
const [onayPenceresi, onayla] = useConfirm();
async function sil() {
  if (!(await onayla({ title: "Yazı silinsin mi?", description: "Geri alınamaz.", tone: "danger", confirmLabel: "Sil" }))) return;
  await silAction(id);
}
return <>{onayPenceresi}<Button variant="danger" onClick={sil}>Sil</Button></>;
```

### Açılır menü — `ui/Dropdown`

Denetimli: `isOpen` · `onClose` · `triggerRef` (açan düğme dışarı tıklama
sayılmaz; Esc'te odak ona döner) · `align` start | end (end) · `autoFocus`
(klavyeyle açılınca ilk öğe) · `ariaLabel` · `id`. ↑/↓/Home/End gezer, Tab ile
çıkınca kapanır. `DropdownItem`: `tag` a | button · `href` · `external` ·
`onClick` · `onItemClick` · `icon` · `tone` default | danger · `disabled` ·
`keepOpen` · `type` (submit menüyü kapatmaz: form gönderimi iptal olmasın) ·
`active` (seçili öğe: vurgulu, `aria-current`) · `hrefLang` · `lang` (dil menüsü).
`DropdownDivider`, `useDropdownClose()` (özel öğeden menüyü kapatmak için).

```tsx
const [acik, setAcik] = useState(false);
const dugme = useRef<HTMLButtonElement>(null);
<div className="relative">
  <button ref={dugme} aria-expanded={acik} onClick={() => setAcik((a) => !a)}>İşlemler</button>
  <Dropdown isOpen={acik} onClose={() => setAcik(false)} triggerRef={dugme}>
    <DropdownItem tag="a" href="/admin/hesabim" icon={<UserRound />}>Hesabım</DropdownItem>
    <DropdownDivider />
    <DropdownItem onClick={sil} tone="danger" icon={<Trash2 />}>Sil</DropdownItem>
  </Dropdown>
</div>
```

### Avatar — `ui/Avatar`

`name` (baş harf ve renk buradan) · `src` (yoksa baş harfler) · `alt` · `size`
xsmall 24 | small 32 | medium 40 | large 48 | xlarge 56 | xxlarge 64 | huge 80
(medium) · `status` online | offline | busy | none · `decorative` (ad yanında
yazılıysa ekran okuyucudan gizle) · `unoptimized` (true; projenin kendi büyük
fotoğrafında `false`: Next avatar boyuna küçültür). `AvatarText`: yalnızca baş
harf; `initials(ad)`.

```tsx
<Avatar name="Ayşe Yılmaz" size="small" decorative />
```

### Tablo — `ui/Table`

`Table` (`scroll` true: yatay kaydırma kabı · `wrapperClassName`), `TableHeader`,
`TableBody`, `TableRow` (`hover`, `selected`), `TableCell` (`isHeader` → `<th scope="col">`,
`align` start | center | end, `nowrap`, `scope`). Uzun metinli sütun
`className="w-full max-w-0 min-w-52"` + içerikte `truncate` ile kartı taşırmaz.
Satırın tamamını tıklanır yapmak: `TableRow className="relative"` + bağlantıda
`after:absolute after:inset-0` (satırdaki onay kutusu `relative z-1`).

```tsx
<ComponentCard title="Yazılar" flush>
  <Table>
    <TableHeader><TableRow><TableCell isHeader>Başlık</TableCell><TableCell isHeader>Durum</TableCell></TableRow></TableHeader>
    <TableBody>
      {yazilar.map((y) => (
        <TableRow key={y.id} hover className="relative">
          <TableCell className="w-full max-w-0 min-w-52">
            <Link href={`/admin/blog/${y.id}`} className="block truncate font-medium text-gray-800 after:absolute after:inset-0">{y.title}</Link>
          </TableCell>
          <TableCell><Badge size="sm" color="success">Yayında</Badge></TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</ComponentCard>
```

### Kartlar — `ui/Card`, `ui/MetricCard`, `ui/EmptyState`

`Card`: beyaz, `rounded-2xl`, gri kenarlık (`<div>` prop'ları) · `tone`
default | brand (marka kenarı: vurgulu kart, birincil adım) | dark (logodaki
lacivert zemin, beyaz yazı; içine `GridShape` konacaksa className'e
`relative z-1 overflow-hidden`). Kartın rengini className'le (`border-*`,
`bg-*`) değiştirme: Tailwind aynı özelliği yazan sınıfları kendi sırasıyla
dizer, kartın gri kenarı/beyazı kazanabilir — `tone` kullan. `ComponentCard`:
`title` · `desc` · `badge` (başlığın yanında) · `actions` (sağda) · `icon` ·
`flush` (gövde dolgusuz: tablo, liste) · `titleAs` h2 | h3 (h2) · `tone`
default | danger | brand · `id`. Kartlar `min-w-0`: ızgarada tablo kartı taşırmaz.
`MetricCard`: `label` · `value` · `icon` · `badge` · `hint` · `href` · `tone`
gray | brand | success | warning | error (gray) · `compact` (telefonda küçük
ikon ve sayı: 2x2 dört kart ekranı doldurmasın). `EmptyState`: `icon` · `title`
· `description` · `action`.

```tsx
<MetricCard label="Yeni mesaj" value={12} icon={<Inbox />} tone="brand" href="/admin/mesajlar" hint="Son 7 gün" />
<ComponentCard title="Yayın" badge={<Badge size="sm" color="success">Yayında</Badge>} actions={<Button size="xs">Kaydet</Button>}>…</ComponentCard>
<EmptyState icon={<Inbox />} title="Mesaj yok" description="Yeni mesajlar burada görünür." />
```

### Sayfa başlığı, sayfalama, sekmeler

- `ui/PageBreadcrumb`: `pageTitle` (sayfanın tek `h1`'i) · `badge` (başlığın
  yanında, h1'in dışında: sınav, durum) · `crumbs` ({ href, label }[];
  verilirse iz çizilir, son halka bu sayfa) · `currentLabel` · `description` ·
  `actions` · `navLabel` ("Konum").
- `ui/Pagination`: `currentPage` · `totalPages` · `href(sayfa)` (bağlantı;
  sunucu bileşeninde) ya da `onPageChange(sayfa)` (düğme) · `labels`
  { previous ("Önceki"), next ("Sonraki"), nav ("Sayfalar"), page(n) ("n. sayfa") }.
  Telefonda "s / N".
- `ui/SegmentedTabs`: `items` { key, label, href | onClick, active, count }[] ·
  `label` (grubun erişilebilir adı) · `size` sm 32px | md 40px (sm; telefonda
  parmakla seçilen süzgeçte md).

```tsx
<PageBreadcrumb pageTitle="Yazıyı düzenle" crumbs={[{ href: "/admin/blog", label: "Blog" }]} currentLabel="Düzenle" actions={<ButtonLink href="…" variant="outline">Önizle</ButtonLink>} />
<Pagination currentPage={sayfa} totalPages={toplam} href={(s) => `/admin/blog?sayfa=${s}`} />
<SegmentedTabs label="Durum" items={[{ key: "yeni", label: "Yeni", href: "?durum=new", active: true, count: 4 }]} />
```

### Form — `form/*`

`Field` etiketi, ipucunu ve hatayı alana bağlar: içindeki kit alanı (Input,
TextArea, Select, FileInput, DateInput) id'sini, `aria-describedby`'ını ve
hata varken `aria-invalid`'ini bağlamdan alır; hata varken ipucu yerine hata
görünür. `Field`: `label` · `hint` · `error` · `required` (yıldız) · `optional`
("isteğe bağlı") · `optionalText` (başka dilde: "optional") · `htmlFor` (alana
kendi id'ni verdiysen) · `labelAction` (etiket satırının sonunda, ör. "Parolamı unuttum").

| Bileşen | Prop'lar |
| --- | --- |
| `Input` | `error` · `success` · `compact` 36px · `large` 48px büyük yazı · `fullWidth` (true) · `startIcon` · `endSlot` (göz düğmesi gibi) · `wrapperClassName` |
| `TextArea` | `error` · `fullWidth` (true) |
| `Select` | `options` { value, label, disabled }[] ya da `<option>` çocukları · `placeholder` · `error` · `compact` · `wrapperClassName` (genişlik buraya) |
| `Checkbox` | `label` · `description` · `indeterminate` · `wrapperClassName`; etiketsizse `aria-label` ver |
| `Radio` | `label` · `description` · `card` (seçenek kartı) · `size` sm \| md |
| `Switch` | `label` · `description` · `color` blue \| gray; `role="switch"` |
| `FileInput` | `error` (yerel dosya alanı, kit görünümü) |
| `DateInput` | `type` date \| datetime-local \| month \| time · `error` · `compact` · `wrapperClassName`; yerel tarih alanı, takvim simgesi tıklanınca açılır, değer `yyyy-aa-gg` |
| `MultiSelect` | `label` (görünür) · `options` { value, text }[] · `defaultSelected` ya da `value` + `onChange` · `name` (her seçim gizli alanla formla gider) · `placeholder` · `disabled` · `removeLabel(metin)` |
| `Label` | `required` · `optional` · `optionalText` · `spacing` (true) — Field kullanmıyorsan |

Sınıf yardımcıları (`form/styles`): `inputClass({ compact, large, fullWidth })`,
`textareaClass`, `selectClass`, `labelClass`, `hintClass`, `errorClass`. Kendi
alan bileşenini yazarken `useFieldControl(props)` ile Field bağlamını al.

```tsx
<Field label="E-posta" error={state.fields?.email} required>
  <Input name="email" type="email" autoComplete="email" required />
</Field>
<Field label="Parola" labelAction={<Link href="/admin/sifremi-unuttum">Parolamı unuttum</Link>}>
  <Input name="password" type={goster ? "text" : "password"} endSlot={<GozDugmesi />} />
</Field>
<Select name="status" compact options={[{ value: "", label: "Hepsi" }, { value: "published", label: "Yayında" }]} wrapperClassName="w-40" />
<Checkbox name="notify" label="E-posta bildirimi" description="Yeni mesajda haber ver" defaultChecked />
<Radio name="role" value="editor" label="Editör" description="Yazı ekler, yayınlar" card />
<MultiSelect label="Etiketler" name="tags" options={[{ value: "tyt", text: "TYT" }, { value: "ayt", text: "AYT" }]} />
```

### Yönetim çerçevesi — `layout/DashboardShell`

Kenar çubuğu (masaüstünde 290px, daraltılınca 90px ikon rayı; üstüne gelince
ya da odaklanınca açılır) + üst çubuk + mobil çekmece. Çekmece açılınca odak
kapatma düğmesine gider, Esc kapatır, kapanınca odak menü düğmesine döner;
açıkken üst çubuk ve içerik `inert`, sayfa kaymaz. "İçeriğe geç" bağlantısı
tokens.css'teki `.skip-link`. Yapışkan öğe başlığın altında kalsın:
`sticky top-(--ta-header-h)`.

Prop'lar: `nav` (NavSection[]) · `logo` · `logoCollapsed` · `logoHref` ·
`logoLabel` · `headerStart` · `headerEnd` (bildirim, kullanıcı menüsü) ·
`sidebarFooter` · `bottomNav` (NavItem[]; telefonda — md altı — alt sekme
çubuğu: verilince menü düğmesi telefonda gizlenir, içerik alttan çubuk kadar
boşluk bırakır; tablette çekmece, masaüstünde kenar çubuğu) · `labels` { skip,
openMenu, closeMenu, collapse, expand, nav, drawer } · `mainId` ("icerik") ·
`defaultExpanded` (true). Yazdırmada kenar çubuğu, üst ve alt çubuk görünmez,
içerik tam genişlik. Alt çubuk tek başına da kullanılabilir: `layout/BottomNav`
(`items`, `label`; `.pb-safe` ile iPhone ev çubuğunun üstünde).

Menü (`layout/nav`): `NavSection { title?, items }`, `NavItem { label, href?, icon?,
badge?, exact?, external?, match?, children? }`, `NavSubItem { href, label, badge?,
exact?, external?, match? }`. Etkin bağlantı en uzun eşleşen adres; `exact`
yalnızca tam eşleşmede; `match` öğeyi etkin yapan ek adres önekleri (menüde
kendi öğesi olmayan sayfa için: `{ href: "/gelisim", match: ["/sonuc"] }`).
Rozet dar çubukta noktaya döner. `useSidebar()` durumu ve aç/kapa işlevlerini verir.

```tsx
<DashboardShell
  nav={[
    { title: "Menü", items: [{ href: "/admin", label: "Genel bakış", icon: <LayoutDashboard />, exact: true }] },
    { title: "İçerik", items: [{ label: "Blog", icon: <FileText />, children: [{ href: "/admin/blog", label: "Yazılar" }] }] },
  ]}
  logo={<Wordmark size="sm" />}
  logoCollapsed={<LogoMark />}
  logoHref="/admin"
  logoLabel="Genel bakış"
  headerEnd={<UserDropdown name={staff.name} detail={staff.email} />}
>
  {children}
</DashboardShell>
```

### Giriş düzeni — `layout/AuthLayout`

Solda form, sağda (lg ve üstü) lacivert marka paneli (`brand-950` + ızgara
deseni `ui/GridShape`). `children` · `aside` (panelin içi; yoksa panel çizilmez)
· `top` ("siteye dön", mobil logo) · `bottom` · `className`. Ana öğe `id="icerik"`.

```tsx
<AuthLayout top={<Link href="/">kocum.net'e dön</Link>} aside={<MarkaPaneli />}>
  <LoginForm />
</AuthLayout>
```

### Üst çubuk — `header/UserDropdown`, `header/NotificationDropdown`

`UserDropdown`: `name` · `detail` (e-posta, rol) · `avatarSrc` · `children`
(DropdownItem'lar) · `footer` (çizgiyle ayrılmış; çıkış formu) · `label`
("hesap menüsü"). `NotificationDropdown`: `items` { id, href, title, text, meta,
time, avatarName }[] · `count` (0 ise nokta yanmaz) · `title` ("Bildirimler") ·
`emptyText` · `viewAllHref` · `viewAllLabel` ("Tümünü gör") · `label` ·
`closeLabel`. Telefonda tam genişlik panel.

```tsx
<NotificationDropdown items={okunmamislar} count={unread} title="Yeni mesajlar" viewAllHref="/admin/mesajlar" />
<UserDropdown name={staff.name} detail={staff.email}
  footer={<form action={logoutAction}><Button type="submit" variant="outline" size="xs" block>Çıkış yap</Button></form>}>
  <DropdownItem tag="a" href="/admin/hesabim" icon={<UserRound />}>Hesabım</DropdownItem>
</UserDropdown>
```

### Profil — `profile/ProfileCard`, `profile/SettingsCard`

`ProfileCard`: `name` · `avatarSrc` · `meta` (ReactNode[], aralarında dikey
çizgi) · `badges` · `actions` · `details` { label, value }[]. `SettingsCard`:
`title` · `description` · `tone` default | danger · `id`; içinde `SettingRow`:
`title` · `description` · `action` (sağda düğme/anahtar) · `children`.

```tsx
<ProfileCard name={staff.name} meta={[ROLE_LABEL[staff.role], staff.email]} details={[{ label: "Son giriş", value: "2 saat önce" }]} />
<SettingsCard title="Güvenlik">
  <SettingRow title="Parola" description="En az 12 karakter." action={<PasswordDialogButton />} />
</SettingsCard>
```

### Görsel ve video — `media/*`

`ResponsiveImage`: `src` · `alt` · `width` · `height` · `aspect` video | square |
4/3 | og (verilirse kırparak sığar) · `sizes` ("100vw") · `preload` (LCP
görseli, hero; Next 16) · `priority` (eski adı, kullanımdan kalktı) · `unoptimized`. `ImageGrid`: `items` · `columns` 2 | 3. `VideoEmbed`: `videoId`
(YouTube) · `title` (zorunlu; iframe'in adı) · `aspectRatio` 16:9 | 4:3 | 21:9 |
1:1. Çerezsiz alan adı (youtube-nocookie), geç yükleme.

```tsx
<ResponsiveImage src={kapak} alt={kapakAlt} width={1200} height={630} aspect="og" />
<VideoEmbed videoId={tanitim.youtubeId} title="Check-up nasıl çalışır" />
```

### Grafikler (bağımlılıksız) — `charts/*`

TailAdmin'in ApexCharts kartlarının görünümü, kütüphanesiz. Çizim
`aria-hidden`; ekran okuyucu görünmez veri tablosunu okur.

- `ChartCard`: `title` · `description` · `actions` · `children` · `stats`
  { label, value }[] (gri alt şerit) · `note` · `titleAs`.
- `BarChart`: `categories` · `series` { name, data }[] (en fazla iki seri) ·
  `ariaLabel` · `height` (180) · `valueFormat` · `labelEvery` (sıkışık eksende
  her n'inci etiket). Üstüne gelince değer balonu.
- `RadialGauge`: `value` 0–100 · `label` (ortadaki yazı) · `ariaLabel` · `tone`
  brand | success | warning | error · `size` sm (en fazla 10rem, küçük yazı:
  dar yerde yazı yaya değmesin) | md (md).
- `MeterList`: `items` { key, label, value, valueLabel, meta, href, tone, badge }[]
  (`tone`: satırın çubuk rengi brand | success | warning | error | gray —
  güçlü/orta/zayıf gibi anlamı olan listeler; `badge`: adın yanında rozet) ·
  `max` (yoksa en büyük değer) · `wrap` (uzun ad kesilmez, alt satıra geçer;
  telefonda konu adları için).
- Görünmez veri tablosunu bir `sr-only` KABIN içine koy (`<div className="sr-only"><table>`):
  tabloya doğrudan `sr-only` verilince tablo daralmıyor ve kabı `overflow-hidden`
  değilse telefonda sayfayı yana taşırıyor.

```tsx
<ChartCard title="Haftalık gelen mesajlar" description="Son 12 hafta, spam hariç">
  <BarChart categories={etiketler} series={[{ name: "Mesaj", data: sayilar }]} ariaLabel="Haftalık gelen mesaj sayısı" labelEvery={2} />
</ChartCard>
<ChartCard title="Mesaj durumu" stats={[{ label: "Yanıtlanan", value: 18 }, { label: "Bekleyen", value: 4 }]}>
  <RadialGauge value={82} ariaLabel="Yanıtlanan mesaj oranı" tone="success" />
</ChartCard>
```

### Hata sayfası — `pages/ErrorPage`

`code` ("404"; `null`: büyük rakam yok, ör. genel hata sayfası — ikonu `top`'a
koy) · `title` (`h1`) · `message` · `actions` · `children` (eylemlerin altında:
önerilen sayfalar) · `top` (logo) · `footer` · `embedded` (false). Izgara
deseniyle ortalı düzen; `not-found.tsx` ve `error.tsx` için. Varsayılan tam
ekran (kendi `<main id="icerik">`'i var). `embedded`: sitenin başlığı ile
altbilgisi arasında; kök öğe id'siz `<main>` (düzen "içeriğe geç" hedefini
kendisi verir, id iki kez olmasın), tam ekran değil.

```tsx
<ErrorPage title="Sayfa bulunamadı" message="Adres değişmiş ya da silinmiş olabilir." actions={<ButtonLink href="/admin">Genel bakışa dön</ButtonLink>} />
<ErrorPage embedded code={null} top={<HataIkonu />} title="Bir şeyler ters gitti" actions={<Button onClick={retry}>Tekrar dene</Button>} />
```

### Yardımcılar

`cx(...parçalar)`: boş olmayan dizgeleri boşlukla birleştirir (`false`, `null`,
sayı atlanır); çatışmaları çözmez. `lib/scroll-lock`: `kaydirmayiKilitle()` /
`kaydirmayiBirak()` sayaçlı (pencere çekmecenin üstünde açılsa da doğru çözülür).
`ui/GridShape`: köşelerde sönen ızgara deseni; ebeveyn `relative z-1`.

## Eklentiler

| Eklenti | Bileşenler | Paket | Lisans | frontend |
| --- | --- | --- | --- | --- |
| `dropzone` | `Dropzone` | react-dropzone 20 (+ attr-accept, file-selector) | MIT | **açık** — blog kapak görseli |
| `datepicker` | `DatePicker` | flatpickr 4.6 | MIT | kapalı — site yönetiminde tarih alanı yok |
| `charts` | `ApexChart`, `ApexAreaChart`, `ApexBarChart`, `ApexRadialChart`, `StatisticsChart` | apexcharts 7, react-apexcharts 2 | **MIT değil** (aşağıda) | **açık** — site yönetimi panosu (ürün sahibi onayladı) |

Açmak: `sync.mjs` → `KIT_HEDEFLERI.<proje>.eklentiler`'e adı ekle, paketi kur,
`node design/sync.mjs`. Kurulum her zaman npm 10 ile (kilit dosyası Dokploy/CI
ile uyumlu kalsın):

```bash
cd frontend && npx npm@10.9.4 install react-dropzone      # dropzone
cd <proje>  && npx npm@10.9.4 install flatpickr           # datepicker
cd <proje>  && npx npm@10.9.4 install apexcharts react-apexcharts   # charts — önce lisans onayı
```

### Dropzone — `extras/dropzone/Dropzone`

Sürükle-bırak ya da "Dosya seç". Forma bağlı: `name` verilirse seçilen dosyalar
gizli `<input type="file">`'a yazılır ve form gönderiminde gider; reddedilen
dosya formda kalmaz, pencereden vazgeçince önceki seçim geri gelir. Ret
iletileri Türkçe (`role="alert"`).

`ariaLabel` (zorunlu) · `name` · `accept` (react-dropzone `Accept`) · `maxSize`
(bayt) · `multiple` · `disabled` · `onFilesChange(dosyalar)` · `onReject(ileti)` ·
`onAdd(dosyalar)` · `title` · `description` · `browseLabel` · `activeTitle` ·
`rejectTitle` · `error` · `preview` (küçük önizleme + kaldır) · `compact` · `className`.

`onAdd`: seçimi çağıran tutar (listesini kendi çizen çok dosyalı ekran, ör.
check-up toplu içe aktarma). Her bırakma/seçimde yalnızca yeni kabul edilen
dosyalar gelir; bileşen liste tutmaz, bir kısmı reddedilse de kabul edilenler
gelir. `name` ve `preview` ile birlikte kullanılmaz.

```tsx
<Dropzone
  name="cover"
  ariaLabel="Kapak görseli"
  accept={{ "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] }}
  maxSize={10 * 1024 * 1024}
  preview
  onFilesChange={(dosyalar) => setDegisti(dosyalar.length > 0)}
/>
```

### DatePicker — `extras/datepicker/DatePicker`

Yerel `DateInput` yetmediğinde: aralık, çoklu gün, Türkçe takvim, sınır
tarihleri. Görünen biçim `gg.aa.yyyy`, forma giden değer `yyyy-aa-gg`
(`name` gizli asıl alanda). `Field` ile çalışır. `datepicker.css` flatpickr'ın
temasını kite uydurur.

`id` · `name` · `mode` single | multiple | range | time · `defaultDate` ·
`onChange` · `placeholder` · `minDate` · `maxDate` · `dateFormat` ("Y-m-d") ·
`displayFormat` ("d.m.Y") · `required` · `disabled` · `error`.

```tsx
<Field label="Sınav tarihi" hint="gg.aa.yyyy">
  <DatePicker name="examDate" minDate="today" />
</Field>
```

### ApexCharts — `extras/charts/*`

> ⚠ **Lisans.** ApexCharts (ve react-apexcharts) MIT değil, çift lisanslı.
> Paketin LICENSE dosyasına göre: topluluk lisansı yalnızca yıllık geliri
> 2 milyon USD'nin altındaki kuruluşlara ücretsiz, üstü ücretli lisans ister;
> grafiği "başkalarının kullandığı bir ürüne gömmek" ayrıca OEM lisansı
> isteyebilir (kullanıcının yapılandıramadığı, etkileşimsiz grafikler hariç
> tutuluyor). **Paketi kurmak lisansı kabul etmek sayılıyor.** Ürün sahibi
> Ekim 2026'da onayladı; açık olduğu projeler `sync.mjs` → `KIT_HEDEFLERI`
> (frontend'de site yönetimi panosu). Yeni bir yüzeyde açmadan önce OEM
> maddesini yine düşün (öğrencilerin gördüğü ekranlar). Kütüphane istemeyen
> yerde bağımlılıksız `charts/`.

Grafik `next/dynamic` + `ssr: false` ile yalnızca tarayıcıda yüklenir: grafiği
kullanmayan sayfa kütüphaneyi indirmez. Renkler `GRAFIK_RENKLERI`, ortak ayarlar
`temelAyarlar()`.

- `ApexChart`: react-apexcharts prop'ları + `ariaLabel` · `className`.
- `ApexAreaChart`: `categories` · `series` · `ariaLabel` · `height` (310) · `curve` straight | smooth
  (smooth eğri noktalar arasında taşar; sayımda 0'ın altına iner, straight kullan).
- `ApexBarChart`: `categories` · `series` · `ariaLabel` · `height` (180) · `horizontal` · `valueFormat`.
  Yatayda uzun kategori adı eksende kısalır; ipucu adın tamamını gösterir.
- Bütün değerler tam sayıysa (sayım) değer ekseni tam sayı: `tamSayiOlcegi(series)`
  (alan ve sütun grafiği kendiliğinden kullanır). ApexCharts küçük sayılarda
  0.2, 0.4… adımları çiziyordu.
- `ApexRadialChart`: `value` 0–100 · `ariaLabel` · `height` (330).
- `StatisticsChart`: `title` · `description` · `views` { key, label, categories, series }[] (sekmeli) · `ariaLabel` · `tabsLabel` ("Dönem") · `actions`.

```tsx
<ApexAreaChart categories={aylar} series={[{ name: "Test", data: sayilar }]} ariaLabel="Aylık çözülen test" curve="smooth" />
```

### Uyarlanmayanlar

- **Takvim (FullCalendar, MIT)**: yapılmadı; şu an gerçek bir kullanım yeri yok.
  Gerekirse (ör. koçluk randevuları) `extras/calendar/` olarak eklenir:
  `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`,
  `@fullcalendar/interaction`, `@fullcalendar/core/locales/tr`.
- Koyu tema düğmesi ve ThemeContext (koyu tema yok), dünya haritası
  (jvectormap), kaydırıcı (swiper), simplebar, kayıt formu (personel davetle
  eklenir), telefon alanı (PhoneInput): kullanım yeri yok.

## Geçiş notları

Kit hedefi eklenmeden önce projede `gray-*`, `orange-*` ve `brand-<sayı>`
kullanılmadığı doğrulandı (app/ ve admin/ bugün kullanmıyor): tema bu ölçekleri
TailAdmin'inkiyle değiştirir, kullanan bir sınıf varsa rengi değişir.

### frontend — site yönetimi (yapıldı)

Çerçeve DashboardShell (rol bazlı menü, okunmamış mesaj rozeti, bildirim ve
kullanıcı menüsü), giriş/parola sayfaları AuthLayout, pano MetricCard +
ApexCharts eklentisi (haftalık mesaj alan grafiği, yanıtlanma oranı yarım daire,
en çok okunanlar yatay sütun; backend'in mevcut mesaj ve yazı uçlarından),
listeler Table + Badge + Pagination, formlar Field + kit alanları, onaylar `useConfirm`
(window.confirm ve window.prompt kalmadı), uyarılar Alert, blog kapağı Dropzone,
hesap sayfası ProfileCard + SettingsCard, `/admin` 404'ü ErrorPage. Eski
`components/admin/ui.tsx` yalnızca yardımcılar (tarih, `qs`, `Forbidden`) için kaldı.
Stil dosyası `app/admin/admin.css` (yalnızca admin kök düzeni içe aktarır).

### frontend — tanıtım sitesi (yapıldı)

Bütün sayfalar kitin dilinde; pano düzeni yok, pazarlama bölümleri kitin
parçalarından kuruldu. `components/ui.tsx` yalnızca kitte olmayanı tutar
(Container, Section, SectionHead, rozet görünümlü Eyebrow, ExternalButton,
IconBox, `LINK_KART` / `UZANAN_BAGLANTI`: tamamı tıklanan kart). Düğmeler
Button/ButtonLink; kartlar Card (+ `shadow-theme-xs`), ComponentCard (iletişim
formu), MetricCard (ürün kategorilerinin soru sayısı); rozetler Badge; formlar
Field + Input/TextArea + Alert (hata ve teşekkür, e-posta yedeği korundu);
dil menüsü Dropdown (`active`, `hrefLang`), çekmecedeki dil seçimi
SegmentedTabs, çekmece menu-item sınıfları + scroll-lock; ekip Avatar; görseller
ResponsiveImage; boş blog EmptyState; sayfalama Pagination; 404 ve hata
ErrorPage (`embedded`, global 404 tam ekran); başlık ve kapanış kartlarında
GridShape. Marka korunur: Fosfor logosu, Poppins + Inter, `brand-*` mavisi,
`.marker`; koyu yüzeyler `brand-950`.

Stil dosyası ayrı: `app/globals.css` yalnızca siteyi tarar (`@source not` ile
yönetim dizinleri dışarıda) ve kitten **yalnızca sitenin kullandığı
bileşenleri** (liste dosyada). Sitede yeni bir kit bileşeni kullanılırsa o
listeye eklenir; eklenmezse sınıfları üretilmez. Sonuç: sitenin CSS'i 126,8 KB →
79,9 KB (gzip 20,3 → 14,8), yönetimin sınıfları sitenin hiçbir sayfasına inmez.
Başlık sunucu bileşeni; yalnızca menü/çekmece (`HeaderNav`) ve dil menüsü
(`LanguageMenu`) istemcide.

### app — check-up uygulaması (yapıldı)

Çerçeve DashboardShell (masaüstünde kenar çubuğu + kullanıcı menüsü, tablette
çekmece, telefonda `bottomNav` ile beş sekmeli alt çubuk; sonuç ekranı
"Gelişim"i, seviyeli check-up "Testler"i `match` ile yakar). Giriş/kayıt/parola
AuthLayout, 404 ve kök hata ErrorPage (panel içindeki hata çerçevede kalan
kart). Sayfalar PageBreadcrumb + Card/ComponentCard + MetricCard + Table +
Badge + Alert + SegmentedTabs; profil ProfileCard + SettingsCard, parola ve
hesap silme Modal'da; sınav ekranının soru paleti telefonda `Modal sheet`.
Grafikler: pano ve gelişimde ApexCharts eklentisi (`extras/charts/ApexChart`
üstüne uygulamanın kendi sarmalayıcısı: 0-100 ekseni, yüzde, nokta balonunda
test adı, telefonda yana kaymadan sığar), konu haritaları MeterList (`tone` +
seviye rozeti), tek oran RadialGauge. Sonuç ekranında ApexCharts YOK: liste
telefonda daha okunur ve PDF'e basılır. Kitte olmayan ve uygulamada kalanlar:
`components/ui` (Progress, Skeleton, tarih/sayı biçimi, logo). Uygulamanın
`cn()`'i tailwind-merge'e projenin ve kitin özel boyut/renk/gölge adlarını
öğretiyor (`lib/cn.ts`); kitin kendisi `cx` kullanır.

### admin — check-up paneli (yapıldı)

Çerçeve DashboardShell (rol bazlı menü: "Toplu içe aktar" yalnızca içerik
rollerine, "Öğrenciler" yalnızca yönetici ve müdüre; başlıkta soru arama,
kullanıcı menüsünde site yönetimi bağlantısı ve çıkış; telefonda çekmece).
Giriş AuthLayout, kök 404 ErrorPage (check-up içindeki 404 ve hata çerçevede
kalan kart). Sayfalar PageBreadcrumb + Card/ComponentCard + MetricCard + Table +
Badge + Alert + SegmentedTabs + Pagination; formlar Field + kit alanları; öğrenci
ProfileCard, konu haritası MeterList. Grafikler ApexCharts eklentisiyle
(`components/checkup/Grafikler.tsx`, tam sayı ekseni): pano günlük/haftalık test
ve kayıt + paket hazırlığı ApexRadialChart, madde analizinde zorluk ve ayırt
edicilik dağılımı, öğrenci ayrıntısında sınav başına puan trendi; alıştırma
oturumları hiçbirinde yok. Soru görseli ve toplu içe aktarma Dropzone (içe
aktarmada `onAdd`: listeyi ekran tutar; "Klasör seç" ayrı düğme; 10 MB ön
denetimi duruyor). Onaylar çerçevedeki tek `useConfirm` penceresinden
(`components/checkup/Onay.tsx`, `useOnay()`); window.confirm ve window.prompt
kalmadı (CopyIdButton panoya yazamazsa `usePrompt`). `components/checkup/ui.tsx`
yalnızca yardımcılar (renk eşlemeleri, Meter, ProgressLine, SortHeader, `qs`);
`.data-table` silindi.

- Tailwind **4.1.17**: panel koduna 4.2 sınıfı yazma.
- Tablo hücresinin rengi ya da boyutu içteki `span`'a verilir: kitte
  tailwind-merge yok, TableCell'in kendi gri metniyle çakışınca kazananı CSS
  sırası seçer (ör. `text-error-600` kaybeder).

## Doğrulama

Kit değişince: `node design/sync.mjs --check`, sonra hedef projede
`npx next typegen && npx tsc --noEmit && npx eslint . && npm run build`. Kit
henüz hedefi olmayan bir projenin araç zinciriyle denenecekse dosyaları geçici
bir klasöre kopyalayıp o projenin `tsconfig`/`eslint.config` ve `node_modules`'ı
ile derle; projeye dosya yazma.
