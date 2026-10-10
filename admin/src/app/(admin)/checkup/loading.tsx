/**
 * Check-up sayfaları veriyi sunucuda hazırlarken gösterilen iskelet. Biçim
 * TailAdmin kartlarınınki: başlık şeridi, sayı kartları, tablo kartı.
 * Hareket azaltma tercihinde nabız durur (tokens.css).
 */
export default function CheckupLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-soft-pulse space-y-6">
      <span className="sr-only">Yükleniyor…</span>
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-gray-200" />
        <div className="h-7 w-64 max-w-full rounded-lg bg-gray-200" />
        <div className="h-4 w-80 max-w-full rounded-full bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
            <div className="size-12 rounded-xl bg-gray-100" />
            <div className="mt-5 h-3 w-24 rounded-full bg-gray-100" />
            <div className="mt-3 h-7 w-16 rounded-lg bg-gray-200" />
          </div>
        ))}
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
