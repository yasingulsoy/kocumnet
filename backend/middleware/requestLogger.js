const { IS_PRODUCTION } = require('../config/env');

/**
 * Basit istek günlüğü. Bağımlılık eklemiyoruz; ihtiyacımız olan şey
 * "hangi istek, ne kadar sürdü, ne döndü" — bir sorun bildirildiğinde
 * bakılacak ilk yer burası.
 *
 * Üretimde yalnızca hatalar ve yavaş istekler yazılır: her isteği yazmak
 * disk doldurur ve içinde kişisel veri taşıyan adresler birikir.
 */
function requestLogger(req, res, next) {
  const baslangic = process.hrtime.bigint();

  res.on('finish', () => {
    const yol = (req.originalUrl || req.url || '').split('?')[0];
    if (yol === '/api/health') return;

    const ms = Number(process.hrtime.bigint() - baslangic) / 1e6;
    const satir = `${req.method} ${yol} ${res.statusCode} ${ms.toFixed(0)}ms`;

    if (res.statusCode >= 500) console.error('✗', satir);
    else if (res.statusCode >= 400) console.warn('•', satir);
    else if (!IS_PRODUCTION || ms > 1000) console.log('·', satir);
  });

  next();
}

module.exports = { requestLogger };
