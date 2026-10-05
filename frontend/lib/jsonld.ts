/**
 * JSON-LD'yi <script> içine güvenle gömmek için.
 *
 * JSON.stringify "</script>" dizisini kaçırmaz: başlığı `</script><script>…`
 * olan bir blog yazısı sayfada betik çalıştırır (depolanmış XSS). Başlık,
 * özet ve yazar adı yönetim panelinden geliyor — editör rolündeki biri bunu
 * yöneticiye karşı kullanabilirdi. `<`, `>` ve `&` altı karakterlik Unicode
 * kaçışıyla (ters bölü, u, dört onaltılık hane) yazılır; JSON olarak birebir
 * aynı anlama gelir, HTML ayrıştırıcısı için zararsızdır.
 *
 * ⚠️ Kaçış dizisi kaynakta BİLEREK yazılmıyor, karakter kodundan üretiliyor.
 * Önceki sürümde kaynakta tek ters bölüyle yazılmıştı: JavaScript onu tek
 * karakterlik "<" olarak okuyor, yani `.replace(/</g, "<")` hiçbir şey
 * yapmıyordu ve koruma aylarca devre dışı kaldı. Düzenleme araçları da ters
 * bölüleri kolayca yutuyor. Karakter koduyla bu hata tekrar edemez.
 */
const TERS_BOLU = String.fromCharCode(92);

function kacis(karakter: string): string {
  return `${TERS_BOLU}u${karakter.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&]/g, kacis);
}
