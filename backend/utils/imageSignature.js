const fs = require('fs');

/**
 * Dosyanın gerçekten resim olup olmadığını İÇERİĞİNDEN anlar.
 *
 * Uzantı ve tarayıcının bildirdiği MIME tipi saldırganın seçtiği değerlerdir;
 * ikisi de "resim" diyen bir PHP dosyası yüklenip herkese açık /uploads
 * altında durabiliyordu. İlk baytlar (magic number) ise dosyanın kendisi.
 */
const IMZALAR = [
  { tip: 'jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    tip: 'png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a,
  },
  { tip: 'gif', test: (b) => b.slice(0, 6).toString('latin1').match(/^GIF8[79]a$/) !== null },
  {
    tip: 'webp',
    test: (b) => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP',
  },
];

/** Buffer'ın resim türünü döndürür; tanınmazsa null. */
function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  for (const imza of IMZALAR) {
    try {
      if (imza.test(buffer)) return imza.tip;
    } catch {
      /* yoksay */
    }
  }
  return null;
}

/** Diskteki dosyanın ilk baytlarını okuyup türünü döndürür. */
function sniffImageFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    return sniffImage(buf);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* yoksay */
      }
    }
  }
}

module.exports = { sniffImage, sniffImageFile };
