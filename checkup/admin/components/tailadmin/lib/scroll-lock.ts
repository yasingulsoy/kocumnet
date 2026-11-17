/*
 * Uyarlama: TailAdmin Free (MIT) — Modal ve mobil kenar çubuğundaki
 * `document.body.style.overflow` satırları, tek yerde.
 *
 * Sayaçlı kaydırma kilidi: çekmece açıkken üstüne bir onay penceresi
 * açılınca biri kapanıp kilidi erkenden bırakmasın.
 */
let sayac = 0;
let onceki = "";

export function kaydirmayiKilitle() {
  if (typeof document === "undefined") return;
  if (sayac === 0) {
    onceki = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  sayac += 1;
}

export function kaydirmayiBirak() {
  if (typeof document === "undefined" || sayac === 0) return;
  sayac -= 1;
  if (sayac === 0) document.body.style.overflow = onceki;
}
