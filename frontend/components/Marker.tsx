/**
 * Başlıkta fosforlu kalem vurgusu (tokens.css `.marker`) — logodaki "net" gibi.
 *
 * Kural (design/README): başlık başına TEK ifade, yalnızca vurgu; sarı asla
 * metin rengi olmaz (`.marker` yazıyı lacivert yapar).
 *
 * Varsayılan: son kelime. `kisaysaTumu` ile iki kelimeye kadar olan başlık
 * bütünüyle çizilir — "About Us"ta yalnızca "Us"u vurgulamak anlamsız.
 * Kelime sırası mantıksal; Arapçada da son kelime doğru yerde vurgulanır.
 */
export function fosforla(baslik: string, { kisaysaTumu = false }: { kisaysaTumu?: boolean } = {}) {
  const metin = baslik.trim();
  const i = metin.lastIndexOf(" ");
  if (i < 0 || (kisaysaTumu && metin.split(/\s+/).length <= 2)) {
    return <span className="marker">{metin}</span>;
  }
  return (
    <>
      {metin.slice(0, i + 1)}
      <span className="marker">{metin.slice(i + 1)}</span>
    </>
  );
}
