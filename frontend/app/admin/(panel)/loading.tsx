/**
 * Sayfa geçişlerinde anında geri bildirim. Yönetim sayfaları backend'den
 * okuyor; bu iskelet olmadan bağlantıya basınca hiçbir şey olmuyormuş gibi
 * görünüyordu (özellikle telefonda). Hareket azaltma tercihinde nabız durur.
 * Biçim TailAdmin kartlarınınki: başlık şeridi, kart, satırlar.
 */
export default function PanelYukleniyor() {
  return (
    <div role="status" aria-live="polite" className="animate-soft-pulse">
      <span className="sr-only">Yükleniyor…</span>
      <div className="mb-6 space-y-2">
        <div className="h-3 w-24 rounded-full bg-gray-200" />
        <div className="h-7 w-64 max-w-full rounded-lg bg-gray-200" />
        <div className="h-4 w-80 max-w-full rounded-full bg-gray-100" />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="h-4 w-40 rounded-full bg-gray-200" />
        </div>
        <div className="space-y-4 p-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-full bg-gray-100" />
              <div className="h-4 flex-1 rounded-full bg-gray-100" />
              <div className="h-4 w-16 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
