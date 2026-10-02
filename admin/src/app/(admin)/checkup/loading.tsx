/** Check-up sayfaları veriyi sunucuda hazırlarken gösterilen iskelet. */
export default function CheckupLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Yükleniyor">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-line" />
        <div className="h-7 w-56 rounded-lg bg-line" />
        <div className="h-4 w-80 max-w-full rounded bg-surface-sunk" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl border border-line bg-surface"
          />
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-line bg-surface" />
    </div>
  );
}
