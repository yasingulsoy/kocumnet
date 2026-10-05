const crypto = require('crypto');
const { IS_PRODUCTION } = require('../config/env');

/**
 * Basit istek günlüğü + istek kimliği. Bağımlılık eklemiyoruz; ihtiyacımız
 * olan şey "hangi istek, ne kadar sürdü, ne döndü" — bir sorun bildirildiğinde
 * bakılacak ilk yer burası.
 *
 * İstek kimliği: gelen `X-Request-Id` (site yönetiminin BFF'i gönderir)
 * biçimi uygunsa kullanılır, yoksa üretilir; yanıt başlığına ve günlük
 * satırına yazılır. 5xx yanıtlarında gövdede de döner — "kaydederken hata
 * verdi" bildirimi sunucu günlüğündeki satırla eşleşebilsin diye.
 *
 * Üretimde yalnızca hatalar ve yavaş istekler yazılır: her isteği yazmak
 * disk doldurur ve içinde kişisel veri taşıyan adresler birikir.
 */
const GECERLI_KIMLIK = /^[A-Za-z0-9_-]{8,64}$/;

function requestLogger(req, res, next) {
  const baslangic = process.hrtime.bigint();
  const gelen = req.get('x-request-id');
  req.id = gelen && GECERLI_KIMLIK.test(gelen) ? gelen : crypto.randomBytes(6).toString('hex');
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const yol = (req.originalUrl || req.url || '').split('?')[0];
    if (yol === '/api/health') return;

    const ms = Number(process.hrtime.bigint() - baslangic) / 1e6;
    const satir = `${req.method} ${yol} ${res.statusCode} ${ms.toFixed(0)}ms [${req.id}]`;

    if (res.statusCode >= 500) console.error('✗', satir);
    else if (res.statusCode >= 400) console.warn('•', satir);
    else if (!IS_PRODUCTION || ms > 1000) console.log('·', satir);
  });

  next();
}

module.exports = { requestLogger };
