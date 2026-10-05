/**
 * Sayfa geçişlerinde anında geri bildirim. Yönetim sayfaları backend'den
 * okuyor; bu iskelet olmadan bağlantıya basınca hiçbir şey olmuyormuş gibi
 * görünüyordu (özellikle telefonda). Hareket azaltma tercihinde nabız durur.
 */
export default function PanelYukleniyor() {
  return (
    <div role="status" aria-live="polite" className="animate-soft-pulse">
      <span className="sr-only">Yükleniyor…</span>
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 rounded-full bg-surface-sunk" />
        <div className="h-7 w-64 max-w-full rounded-lg bg-line" />
        <div className="h-4 w-80 max-w-full rounded-full bg-surface-sunk" />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 flex-1 rounded-full bg-surface-sunk" />
              <div className="h-4 w-16 rounded-full bg-surface-sunk" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
