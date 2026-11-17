/** Girişli sayfalar yüklenirken: üst çubuk yerinde kalır, içerik iskeleti görünür. */
export default function Yukleniyor() {
  return (
    <div role="status" aria-live="polite" className="animate-fade space-y-6">
      <span className="sr-only">Yükleniyor…</span>
      <div className="space-y-3">
        <div className="h-8 w-64 max-w-full animate-pulse rounded-lg bg-gray-200" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-gray-200" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-gray-200/70" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-2xl bg-gray-200/70" />
        <div className="h-32 animate-pulse rounded-2xl bg-gray-200/70" />
      </div>
    </div>
  );
}
