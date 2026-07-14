export type SortDir = "asc" | "desc";

export function compareSortValues(a: unknown, b: unknown, dir: SortDir): number {
  const m = dir === "asc" ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1 * m;
  if (b == null) return -1 * m;
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1 * m;
    if (Number.isNaN(b)) return -1 * m;
    return (a - b) * m;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return (Number(a) - Number(b)) * m;
  }
  const sa = String(a);
  const sb = String(b);
  return sa.localeCompare(sb, "tr", { numeric: true, sensitivity: "base" }) * m;
}

export function sortRowData<T, K extends string>(
  rows: T[],
  sort: { key: K; dir: SortDir } | null,
  getters: Record<K, (row: T) => unknown>
): T[] {
  if (!sort || rows.length === 0) return rows;
  const get = getters[sort.key];
  if (!get) return rows;
  return [...rows].sort((a, b) => compareSortValues(get(a), get(b), sort.dir));
}

export function toggleSortState<K extends string>(
  prev: { key: K; dir: SortDir } | null,
  key: K
): { key: K; dir: SortDir } {
  if (!prev || prev.key !== key) return { key, dir: "asc" };
  return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
}
