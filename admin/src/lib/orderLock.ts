export interface OrderLockFields {
  is_deleted?: number;
  status?: string;
  order_status_code?: number;
  orderStatus?: { code?: number };
}

export function isOrderArchived(o: OrderLockFields): boolean {
  return Number(o.is_deleted) === 1;
}

export function isOrderDelivered(o: OrderLockFields): boolean {
  return o.status === "delivered" || Number(o.order_status_code ?? o.orderStatus?.code) === 5;
}

/** İptal edilmiş veya teslim edilmiş siparişler düzenlenemez */
export function isOrderLocked(o: OrderLockFields): boolean {
  return isOrderArchived(o) || isOrderDelivered(o);
}
