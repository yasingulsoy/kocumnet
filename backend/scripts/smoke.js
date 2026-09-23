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
  const res = await fetch(BASE + yol, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cerez ? { cookie: cerez.baslik() } : {}),
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
        body: { title: 'Duman testi — silinecek', content: '<p>test</p>', is_published: false },
        cerez,
      });
      const id = olustur.json && olustur.json.data && olustur.json.data.id;
      ok('blog oluşturuluyor', Boolean(id));

      if (id) {
        await iste(`/api/blogs/${id}`, {
          method: 'PUT',
          body: { excerpt: 'özet', author_id: 999999, slug: 'ele-gecirildi', view_count: 4242 },
          cerez,
        });
        const sonra = await iste(`/api/blogs/${id}`, { cerez });
        const b = sonra.json && sonra.json.data;
        ok(
          'toplu atama engelleniyor (author_id / slug / view_count)',
          b && b.author_id !== 999999 && b.slug !== 'ele-gecirildi' && b.view_count === 0
        );
        ok('izinli alan güncelleniyor (excerpt)', b && b.excerpt === 'özet');

        await iste(`/api/blogs/${id}`, { method: 'PUT', body: { image: '../../.env' }, cerez });
        const sonra2 = await iste(`/api/blogs/${id}`, { cerez });
        ok(
          'yol kaçışı denemesi image alanına yazılmıyor',
          sonra2.json && sonra2.json.data && sonra2.json.data.image === null
        );

        const sil = await iste(`/api/blogs/${id}`, { method: 'DELETE', cerez });
        ok('test blogu temizlendi', sil.json && sil.json.success === true);
      }
    }
  }

  console.log(`\n${gecen} geçti, ${kalan} kaldı.\n`);
  process.exit(kalan === 0 ? 0 : 1);
})().catch((e) => {
  console.error('\nDuman testi çalıştırılamadı:', e.message);
  console.error('Sunucu çalışıyor mu? (npm run dev)');
  process.exit(1);
});
