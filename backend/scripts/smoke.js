/**
 * API duman testi — güvenlik düzeltmelerinin geri gelmediğini denetler.
 *
 *   npm run dev          (başka bir terminalde sunucu çalışıyor olmalı)
 *   npm run smoke
 *
 * Yazma denemeleri (blog oluştur/sil) yalnızca GELİŞTİRMEDE ve .env'de
 * ADMIN_EMAIL + ADMIN_PASSWORD varsa çalışır. Üretime karşı çalıştırılamaz.
 */
require('../config/env');
const crypto = require('crypto');
const { IS_PRODUCTION } = require('../config/env');

const PORT = process.env.PORT || 5000;
const BASE = (process.env.SMOKE_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');

let gecen = 0;
let kalan = 0;

function ok(ad, kosul, ayrinti = '') {
  if (kosul) {
    gecen++;
    console.log('  ✓', ad);
  } else {
    kalan++;
    console.log('  ✗', ad, ayrinti ? '→ ' + ayrinti : '');
  }
}

/** Çerezleri istekler arasında taşıyan küçük bir kap. */
function cerezKabi() {
  const kavanoz = new Map();
  return {
    baslik() {
      return [...kavanoz].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    deger(ad) {
      return kavanoz.get(ad) || null;
    },
    kaydet(res) {
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const satir of raw) {
        const [pair] = satir.split(';');
        const i = pair.indexOf('=');
        if (i > 0) kavanoz.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
    },
  };
}

async function iste(yol, { method = 'GET', body, cerez, headers = {} } = {}) {
  // Çift gönderim: kaptaki csrf_token çerezi varsa aynı değeri başlığa koy.
  // Eskiden konmuyordu ve test yalnızca CSRF_DISABLED=1 ile geçiyordu — yani
  // asıl korumanın çalıştığı yol hiç denenmiyordu.
  const yazma = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  const csrf = cerez && yazma ? cerez.deger('csrf_token') : null;
  const res = await fetch(BASE + yol, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cerez ? { cookie: cerez.baslik() } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (cerez) cerez.kaydet(res);
  const metin = await res.text();
  let json = null;
  try {
    json = JSON.parse(metin);
  } catch {
    /* JSON değil */
  }
  return { res, json, metin };
}

(async () => {
  console.log(`\nAPI duman testi — ${BASE}\n`);

  // ── Sağlık ve başlıklar ────────────────────────────────────
  console.log('Temel:');
  {
    const { res, json } = await iste('/api/health');
    ok('sağlık yoklaması veritabanına bakıyor', res.status === 200 && json && json.db === 'up');
    ok('X-Content-Type-Options: nosniff', res.headers.get('x-content-type-options') === 'nosniff');
    ok('X-Powered-By gizli', !res.headers.get('x-powered-by'));
    ok('istek kimliği başlığı var (X-Request-Id)', /^[A-Za-z0-9_-]{8,64}$/.test(res.headers.get('x-request-id') || ''));
  }
  {
    const { res, json } = await iste('/api/yok-boyle-bir-uc');
    ok('bilinmeyen uç 404 + code', res.status === 404 && json && json.code === 'NOT_FOUND');
  }
  {
    const res = await fetch(BASE + '/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"bozuk": ',
    });
    const json = await res.json().catch(() => null);
    ok('bozuk JSON 400 + Türkçe hata (kütüphane metni sızmıyor)', res.status === 400 && json && json.code === 'INVALID_JSON');
  }

  // ── CSRF ───────────────────────────────────────────────────
  console.log('\nCSRF:');
  {
    const cerez = cerezKabi();
    const { json, res } = await iste('/api/csrf-token', { cerez });
    const jeton = json && json.csrfToken;
    ok('jeton üretiliyor', typeof jeton === 'string' && /^[a-f0-9]{64}$/.test(jeton));
    const setCookie = (res.headers.getSetCookie ? res.headers.getSetCookie() : []).join(' ');
    ok('jeton HttpOnly çereze yazılıyor', /csrf_token=/.test(setCookie) && /HttpOnly/i.test(setCookie));
  }

  // ── Kimlik doğrulama duvarı ────────────────────────────────
  console.log('\nYetki:');
  {
    const { res } = await iste('/api/blogs', { method: 'POST', body: { title: 'x', content: 'y' } });
    ok('oturumsuz blog oluşturma reddediliyor', res.status === 401 || res.status === 403);
  }
  {
    const { res } = await iste('/api/admin/users');
    ok('oturumsuz kullanıcı listesi reddediliyor', res.status === 401);
  }
  {
    const { res } = await iste('/api/admin/audit');
    ok('oturumsuz denetim kaydı reddediliyor', res.status === 401);
  }
  {
    // Giriş sınırı hesap başına: A hesabının yanlış denemeleri B'nin hakkını yemez.
    const kavanoz = cerezKabi();
    await iste('/api/csrf-token', { cerez: kavanoz });
    const dene = (kim) =>
      iste('/api/admin/auth/login', {
        method: 'POST',
        body: { usernameOrEmail: kim, password: 'yanlis-parola-123' },
        cerez: kavanoz,
      });
    // Her koşuda yeni adresler: önceki koşuların sayacı karışmasın.
    const etiket = Date.now().toString(36);
    const a1 = await dene(`duman-a-${etiket}@kocum.local`);
    const a2 = await dene(`duman-a-${etiket}@kocum.local`);
    const b1 = await dene(`duman-b-${etiket}@kocum.local`);
    const kalan = (r) => Number(r.res.headers.get('ratelimit-remaining'));
    ok(
      'giriş hız sınırı IP + hesap çiftiyle sayılıyor',
      a1.res.status === 401 && kalan(a2) === kalan(a1) - 1 && kalan(b1) === kalan(a1),
      `a1=${kalan(a1)} a2=${kalan(a2)} b1=${kalan(b1)}`
    );
  }

  await bffTestleri();

  // ── Girdi denetimi ─────────────────────────────────────────
  console.log('\nGirdi:');
  {
    const { res } = await iste('/api/blogs/abc');
    ok('geçersiz kimlik 404 veriyor (500 değil)', res.status === 404);
  }
  {
    const { json } = await iste('/api/blogs?search=%25');
    ok(
      'LIKE jokeri kaçırılıyor (%, tüm kayıtları getirmiyor)',
      json && json.pagination && json.pagination.total === 0
    );
  }
  {
    const { json } = await iste('/api/blogs?limit=1');
    const satir = json && json.data && json.data[0];
    ok('liste yanıtı tam içeriği taşımıyor', !satir || !('content' in satir));
  }

  // ── İletişim formu ─────────────────────────────────────────
  console.log('\nİletişim formu:');
  {
    const { res, json } = await iste('/api/contact', {
      method: 'POST',
      body: { name: 'a', email: 'bozuk', message: 'kısa' },
    });
    ok('eksik form 400 ve alan hataları dönüyor', res.status === 400 && json && json.fields && json.fields.email);
  }
  {
    const { res } = await iste('/api/contact', {
      method: 'POST',
      body: {
        name: 'Duman Testi',
        email: 'smoke@example.com',
        message: 'Bal küpü ve doğrulama denetimi için otomatik mesaj.',
        website: 'http://bot',
      },
    });
    ok('bal küpü dolu istek sessizce kabul ediliyor (kaydedilmiyor)', res.status === 201);
  }

  // ── Yazma denemeleri (yalnızca geliştirme + kimlik varsa) ──
  const eposta = process.env.ADMIN_EMAIL;
  const parola = process.env.ADMIN_PASSWORD;

  if (IS_PRODUCTION) {
    console.log('\nYazma denemeleri atlandı (üretim).');
  } else if (!eposta || !parola) {
    console.log('\nYazma denemeleri atlandı (.env içinde ADMIN_EMAIL/ADMIN_PASSWORD yok).');
  } else {
    console.log('\nYazma (oturumlu):');
    const cerez = cerezKabi();
    await iste('/api/csrf-token', { cerez });
    const giris = await iste('/api/admin/auth/login', {
      method: 'POST',
      body: { usernameOrEmail: eposta, password: parola },
      cerez,
    });
    ok('giriş yapılıyor', giris.json && giris.json.success === true, giris.json && giris.json.error);

    if (giris.json && giris.json.success) {
      const olustur = await iste('/api/blogs', {
        method: 'POST',
        body: {
          title: 'Duman testi — silinecek',
          content: '<p>test</p>',
          is_published: false,
          image_alt: 'Masada açık bir matematik defteri <b>kalın</b>',
        },
        cerez,
      });
      const id = olustur.json && olustur.json.data && olustur.json.data.id;
      ok('blog oluşturuluyor', Boolean(id));
      ok(
        'meta başlık/açıklama başlıktan kopyalanmıyor (boş kalıyor)',
        olustur.json && olustur.json.data && olustur.json.data.meta_title === null && olustur.json.data.meta_description === null
      );

      ok(
        'kapak alt metni kaydediliyor (etiketler temizlenmiş)',
        olustur.json && olustur.json.data && olustur.json.data.image_alt === 'Masada açık bir matematik defteri kalın',
        olustur.json && olustur.json.data && String(olustur.json.data.image_alt)
      );

      if (id) {
        const nesne = await iste(`/api/blogs/${id}`, { method: 'PUT', body: { content: { $gt: '' } }, cerez });
        ok('metin olmayan içerik 400 (500 değil)', nesne.res.status === 400);

        await iste(`/api/blogs/${id}`, { method: 'PUT', body: { is_published: true }, cerez });
        const yayinda = await iste(`/api/blogs/${id}`, { cerez });
        const slug = yayinda.json && yayinda.json.data && yayinda.json.data.slug;
        const herkese = await iste(`/api/blogs/slug/${slug}`);
        const liste = await iste('/api/blogs?limit=100');
        const satir = ((liste.json && liste.json.data) || []).find((b) => b.id === id);
        ok(
          'herkese açık ayrıntı ve liste image_alt döndürüyor',
          Boolean(herkese.json && herkese.json.data && herkese.json.data.image_alt && satir && 'image_alt' in satir)
        );
        const gecmis = await iste(`/api/admin/audit?target_type=blog&target_id=${id}`, { cerez });
        const eylemler = ((gecmis.json && gecmis.json.data) || []).map((r) => r.action);
        ok(
          'yazı geçmişi denetimde (oluşturma + yayınlama)',
          eylemler.includes('blog.create') && eylemler.includes('blog.publish'),
          eylemler.join(',')
        );
        await iste(`/api/blogs/${id}`, { method: 'PUT', body: { is_published: false }, cerez });

        // Sürümler: yayın değişikliği sürüm açmaz; içerik değişikliği açar; dönülebilir.
        const s0 = await iste(`/api/blogs/${id}/revisions`, { cerez });
        const ilkSurumler = (s0.json && s0.json.data) || [];
        await iste(`/api/blogs/${id}`, { method: 'PUT', body: { content: '<p>ikinci sürüm</p>' }, cerez });
        const s1 = await iste(`/api/blogs/${id}/revisions`, { cerez });
        ok(
          'içerik değişince sürüm kaydediliyor (yayın değişikliği açmıyor)',
          ilkSurumler.length === 1 && ((s1.json && s1.json.data) || []).length === 2,
          `${ilkSurumler.length} → ${((s1.json && s1.json.data) || []).length}`
        );
        if (ilkSurumler[0]) {
          const geri = await iste(`/api/blogs/${id}/revisions/${ilkSurumler[0].id}/restore`, { method: 'POST', cerez });
          const sonraki = await iste(`/api/blogs/${id}`, { cerez });
          const s2 = await iste(`/api/blogs/${id}/revisions`, { cerez });
          ok(
            'eski sürüme dönülüyor; dönüş de sürüm olarak kaydediliyor',
            Boolean(geri.json && geri.json.success) &&
              sonraki.json.data.content === '<p>test</p>' &&
              ((s2.json && s2.json.data) || []).length === 3
          );
          const tekSurum = await iste(`/api/blogs/${id}/revisions/${ilkSurumler[0].id}`, { cerez });
          ok('tek sürüm içeriğiyle okunuyor', Boolean(tekSurum.json && tekSurum.json.data && tekSurum.json.data.content === '<p>test</p>'));
        }

        await iste(`/api/blogs/${id}`, {
          method: 'PUT',
          body: { excerpt: 'özet', author_id: 999999, slug: 'ele-gecirildi', view_count: 4242 },
          cerez,
        });
        const sonra = await iste(`/api/blogs/${id}`, { cerez });
        const b = sonra.json && sonra.json.data;
        ok(
          'toplu atama engelleniyor (author_id / view_count)',
          b && b.author_id !== 999999 && b.view_count === 0
        );
        ok('izinli alanlar güncelleniyor (excerpt, slug)', b && b.excerpt === 'özet' && b.slug === 'ele-gecirildi');

        await iste(`/api/blogs/${id}`, { method: 'PUT', body: { image: '../../.env' }, cerez });
        const sonra2 = await iste(`/api/blogs/${id}`, { cerez });
        ok(
          'yol kaçışı denemesi image alanına yazılmıyor',
          sonra2.json && sonra2.json.data && sonra2.json.data.image === null
        );

        const sil = await iste(`/api/blogs/${id}`, { method: 'DELETE', cerez });
        ok('test blogu temizlendi', sil.json && sil.json.success === true);
      }

      await mesajTestleri(cerez, giris.json.user);
      await sablonTestleri(cerez);
      await oturumTestleri(eposta, parola);
    }
  }

  console.log(`\n${gecen} geçti, ${kalan} kaldı.\n`);
  process.exit(kalan === 0 ? 0 : 1);
})().catch((e) => {
  console.error('\nDuman testi çalıştırılamadı:', e.message);
  console.error('Sunucu çalışıyor mu? (npm run dev)');
  process.exit(1);
});

/**
 * Mesaj kutusu: yanıtlandı durumu, ekip notu, toplu işlem, sayılar ve
 * denetim kaydı. Kendi oluşturduğu mesajı en sonda siler.
 */
async function mesajTestleri(cerez, ben) {
  console.log('\nMesaj kutusu (oturumlu):');
  const etiket = `duman-${Date.now().toString(36)}`;
  const gonder = await iste('/api/contact', {
    method: 'POST',
    body: { name: 'Duman Testi', email: `${etiket}@example.com`, message: `Otomatik test mesajı ${etiket}, silinecek.` },
  });
  ok('iletişim formu kaydediyor', gonder.res.status === 201);

  const liste = await iste(`/api/admin/contact-messages?status=new,read&search=${etiket}`, { cerez });
  const m = liste.json && liste.json.data && liste.json.data[0];
  ok('bekleyenler süzgeci (new,read) mesajı buluyor', Boolean(m && m.id));
  ok('liste durum sayılarını veriyor', Boolean(liste.json && liste.json.counts && typeof liste.json.counts.answered === 'number'));
  if (!m) return;

  const ozet = await iste('/api/admin/summary', { cerez });
  const d = ozet.json && ozet.json.data;
  ok('genel bakış sayıları geliyor', Boolean(d && d.blogs && d.messages && d.messages.waiting >= 1 && d.staff));

  const yanit = await iste(`/api/admin/contact-messages/${m.id}`, { method: 'PATCH', body: { status: 'answered' }, cerez });
  ok('yanıtlandı olarak işaretleniyor', Boolean(yanit.json && yanit.json.data && yanit.json.data.answered_at));
  const not = await iste(`/api/admin/contact-messages/${m.id}`, { method: 'PATCH', body: { note: 'Telefonla arandı' }, cerez });
  ok('ekip notu kaydediliyor', Boolean(not.json && not.json.data && not.json.data.note === 'Telefonla arandı'));

  const detay = await iste(`/api/admin/contact-messages/${m.id}`, { cerez });
  ok(
    'ayrıntı yanıtlayanı ve bağlamı veriyor',
    Boolean(detay.json && detay.json.data.answerer && detay.json.data.answerer.id === ben.id && Array.isArray(detay.json.related) && 'next_waiting' in detay.json)
  );
  ok('ayrıntı IP özeti sızdırmıyor', Boolean(detay.json && !('ip_hash' in detay.json.data)));

  const toplu = await iste('/api/admin/contact-messages', { method: 'PATCH', body: { ids: [m.id], status: 'archived' }, cerez });
  ok('toplu durum değişikliği', Boolean(toplu.json && toplu.json.updated === 1));
  const bozuk = await iste('/api/admin/contact-messages', { method: 'PATCH', body: { ids: [m.id], status: 'yok' }, cerez });
  ok('toplu işlemde geçersiz durum 400', bozuk.res.status === 400);

  const sil = await iste(`/api/admin/contact-messages/${m.id}`, { method: 'DELETE', cerez });
  ok('test mesajı silindi', Boolean(sil.json && sil.json.success));

  const iz = await iste('/api/admin/audit?area=message&limit=20', { cerez });
  const satirlar = (iz.json && iz.json.data) || [];
  const eylemler = satirlar.filter((r) => r.target_id === m.id || r.action === 'message.bulk').map((r) => r.action);
  ok(
    'mesaj işlemleri denetimde (durum, not, toplu, silme)',
    ['message.status', 'message.note', 'message.bulk', 'message.delete'].every((e) => eylemler.includes(e)),
    eylemler.join(',')
  );
  ok('denetim kaydında gönderenin e-postası yok', satirlar.every((r) => !String(r.summary).includes(etiket)));
}

/** "Diğer cihazlardan çıkış": eski oturum düşer, bu cihaz açık kalır. */
async function oturumTestleri(eposta, parola) {
  console.log('\nOturumlar:');
  const girisYap = async () => {
    const kap = cerezKabi();
    await iste('/api/csrf-token', { cerez: kap });
    await iste('/api/admin/auth/login', { method: 'POST', body: { usernameOrEmail: eposta, password: parola }, cerez: kap });
    return kap;
  };
  // Bekleme yok: jetonlar imza anını milisaniyeyle taşıyor (ims); kapatmadan
  // hemen önce, aynı saniyede açılmış oturum da düşmeli.
  const eskiCihaz = await girisYap();
  const buCihaz = await girisYap();

  const kapat = await iste('/api/admin/auth/logout-all', { method: 'POST', cerez: buCihaz });
  ok('diğer cihazlardan çıkış çalışıyor', Boolean(kapat.json && kapat.json.success));
  const eski = await iste('/api/admin/auth/verify', { cerez: eskiCihaz });
  const yeni = await iste('/api/admin/auth/verify', { cerez: buCihaz });
  ok('eski cihazın oturumu düştü', eski.res.status === 401, String(eski.res.status));
  ok('bu cihazın oturumu açık kaldı (yeni çerez)', yeni.res.status === 200, String(yeni.res.status));

  const kendi = await iste('/api/admin/users/1/revoke-sessions', { method: 'POST', cerez: buCihaz });
  ok('yönetici kendi oturumlarını personel ekranından kapatamaz', kendi.res.status === 400 || kendi.res.status === 404, String(kendi.res.status));
}

/**
 * Site yönetimi BFF'inin imzalı istemci IP'si (middleware/clientIp.js):
 * imzasız ya da yanlış imzalı başlık YOK SAYILIR; doğru imzalı IP hız
 * sınırında kendi kovasıyla sayılır. İmzalı denemeler için sunucu ve bu
 * betik aynı BFF_SHARED_SECRET ile çalışmalı.
 */
async function bffTestleri() {
  console.log('\nBFF istemci IP\'si:');
  const sir = String(process.env.BFF_SHARED_SECRET || '').trim();
  const kavanoz = cerezKabi();
  await iste('/api/csrf-token', { cerez: kavanoz });
  const etiket = Date.now().toString(36);
  const dene = (hesap, ekler) =>
    iste('/api/admin/auth/login', {
      method: 'POST',
      body: { usernameOrEmail: hesap, password: 'yanlis-parola-123' },
      cerez: kavanoz,
      headers: ekler,
    });
  const kalan = (r) => Number(r.res.headers.get('ratelimit-remaining'));

  const x = `duman-bff-x-${etiket}@kocum.local`;
  const s1 = await dene(x, { 'x-bff-client-ip': '203.0.113.10' });
  const s2 = await dene(x, { 'x-bff-client-ip': '203.0.113.11' });
  ok('imzasız istemci IP başlığı yok sayılıyor', kalan(s2) === kalan(s1) - 1, `s1=${kalan(s1)} s2=${kalan(s2)}`);

  if (sir.length < 32) {
    console.log('  · BFF_SHARED_SECRET tanımlı değil: imzalı IP denemeleri atlandı.');
    return;
  }
  const imzali = (ip) => {
    const zaman = String(Date.now());
    const imza = crypto.createHmac('sha256', sir).update(`${ip}|${zaman}`).digest('hex');
    return { 'x-bff-client-ip': ip, 'x-bff-time': zaman, 'x-bff-signature': imza };
  };
  const y = `duman-bff-y-${etiket}@kocum.local`;
  const a1 = await dene(y, imzali('203.0.113.20'));
  const a2 = await dene(y, imzali('203.0.113.20'));
  const b1 = await dene(y, imzali('203.0.113.21'));
  ok(
    'imzalı istemci IP\'si kendi kovasıyla sayılıyor',
    kalan(a2) === kalan(a1) - 1 && kalan(b1) === kalan(a1),
    `a1=${kalan(a1)} a2=${kalan(a2)} b1=${kalan(b1)}`
  );
  const duz = await dene(y, {});
  const yanlis = await dene(y, { ...imzali('203.0.113.22'), 'x-bff-signature': 'f'.repeat(64) });
  ok('yanlış imzalı başlık yok sayılıyor', kalan(yanlis) === kalan(duz) - 1, `duz=${kalan(duz)} yanlis=${kalan(yanlis)}`);
  const eski = { ...imzali('203.0.113.23') };
  eski['x-bff-time'] = String(Date.now() - 10 * 60 * 1000);
  eski['x-bff-signature'] = crypto.createHmac('sha256', sir).update(`203.0.113.23|${eski['x-bff-time']}`).digest('hex');
  const bayat = await dene(y, eski);
  ok('10 dakikalık imza kabul edilmiyor (tekrar oynatma)', kalan(bayat) === kalan(yanlis) - 1, `bayat=${kalan(bayat)}`);
}

/** Hazır yanıt şablonları: doğrulama, ekle/güncelle/sil, örnekler. Kendi kayıtlarını siler. */
async function sablonTestleri(cerez) {
  console.log('\nHazır yanıt şablonları:');
  const once = await iste('/api/admin/reply-templates', { cerez });
  ok('şablon listesi geliyor', once.res.status === 200 && Array.isArray(once.json && once.json.data));
  const bosMu = Boolean(once.json && once.json.data && once.json.data.length === 0);

  const bozuk = await iste('/api/admin/reply-templates', { method: 'POST', body: { title: 'x', locale: 'de', body: '' }, cerez });
  ok('geçersiz şablon 400', bozuk.res.status === 400);

  const ekle = await iste('/api/admin/reply-templates', {
    method: 'POST',
    body: { title: 'Duman şablonu', locale: 'tr', body: 'Merhaba {ad},\n\nDeneme.\n\n{imza}' },
    cerez,
  });
  const id = ekle.json && ekle.json.data && ekle.json.data.id;
  ok('şablon eklendi (satır sonları korunuyor)', Boolean(id && ekle.json.data.body.includes('\n\nDeneme.')));
  if (id) {
    const guncelle = await iste(`/api/admin/reply-templates/${id}`, {
      method: 'PUT',
      body: { title: 'Duman şablonu 2', locale: 'en', body: 'Hello {ad}' },
      cerez,
    });
    ok('şablon güncellendi', Boolean(guncelle.json && guncelle.json.data && guncelle.json.data.locale === 'en'));
    const enListe = await iste('/api/admin/reply-templates?locale=en', { cerez });
    ok('dile göre süzülüyor', Boolean(enListe.json && enListe.json.data.some((s) => s.id === id)));
    const sil = await iste(`/api/admin/reply-templates/${id}`, { method: 'DELETE', cerez });
    ok('şablon silindi', Boolean(sil.json && sil.json.success));
  }

  if (bosMu) {
    const ornek = await iste('/api/admin/reply-templates/samples', { method: 'POST', cerez });
    const eklenenler = (ornek.json && ornek.json.data) || [];
    ok('örnek şablonlar boş listeye ekleniyor (tr/en/ar)', eklenenler.length >= 3 && ['tr', 'en', 'ar'].every((d) => eklenenler.some((s) => s.locale === d)));
    const tekrar = await iste('/api/admin/reply-templates/samples', { method: 'POST', cerez });
    ok('örnekler ikinci kez eklenmiyor', tekrar.res.status === 400);
    for (const s of eklenenler) await iste(`/api/admin/reply-templates/${s.id}`, { method: 'DELETE', cerez });
  } else {
    console.log('  · Şablon tablosu boş değil: örnek ekleme denemesi atlandı.');
  }
}
