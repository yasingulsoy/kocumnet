/** order_items.is_numune — API boolean veya 1/0 dönebilir */
export function itemIsNumune(item: { is_numune?: unknown }): boolean {
  const v = item.is_numune;
  return v === true || v === 1 || v === "1";
}

export function orderHasNumune(order: { items?: Array<{ is_numune?: unknown }> }): boolean {
  return !!order.items?.some((i) => itemIsNumune(i));
}
