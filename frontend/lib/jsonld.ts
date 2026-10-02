/**
 * JSON-LD'yi <script> içine güvenle gömmek için.
 *
 * JSON.stringify "</script>" dizisini kaçırmaz: başlığı `</script><script>…`
 * olan bir blog yazısı sayfada betik çalıştırır (depolanmış XSS). Başlık ve
 * özet blog editöründen geliyor — editör rolündeki biri bunu yöneticiye karşı
 * kullanabilirdi. `<`, `>` ve `&` Unicode kaçışlarıyla yazılır; JSON olarak
 * birebir aynı anlama gelir, HTML ayrıştırıcısı için zararsızdır.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\u003c")
    .replace(/>/g, "\u003e")
    .replace(/&/g, "\u0026");
}
