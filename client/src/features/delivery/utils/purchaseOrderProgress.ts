export interface ProgressOrderItem {
  rfqItemId?: string;
  quantity: unknown;
  unit?: string;
  dispatchedQuantity?: unknown;
  receivedQuantity?: unknown;
}

export interface ProgressDeliveryItem {
  rfqItemId?: string;
  dispatchedQuantity?: unknown;
  deliveredQuantity?: unknown;
}

export interface ProgressDelivery {
  status?: string;
  items?: ProgressDeliveryItem[];
}

export interface PurchaseOrderItemProgress {
  ordered: number;
  dispatched: number;
  received: number;
  pending: number;
  progress: number;
}

const safeQuantity = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const getPurchaseOrderItemProgress = (
  item: ProgressOrderItem,
  deliveries: ProgressDelivery[]
): PurchaseOrderItemProgress => {
  const ordered = safeQuantity(item.quantity);
  const itemId = item.rfqItemId;
  let deliveryDispatchedQuantity = 0;
  let deliveryReceivedQuantity = 0;

  if (itemId) {
    for (const delivery of deliveries) {
      if (delivery.status === "cancelled") continue;
      for (const deliveryItem of delivery.items || []) {
        if (deliveryItem.rfqItemId !== itemId) continue;
        deliveryDispatchedQuantity += safeQuantity(
          deliveryItem.dispatchedQuantity
        );
        deliveryReceivedQuantity += safeQuantity(
          deliveryItem.deliveredQuantity
        );
      }
    }
  }

  const dispatched = Math.min(
    ordered,
    Math.max(
      safeQuantity(item.dispatchedQuantity),
      deliveryDispatchedQuantity
    )
  );
  const received = Math.min(
    ordered,
    Math.max(
      safeQuantity(item.receivedQuantity),
      deliveryReceivedQuantity
    )
  );
  const progress =
    ordered > 0
      ? Math.min(100, Math.max(0, (received / ordered) * 100))
      : 0;

  return {
    ordered,
    dispatched,
    received,
    pending: Math.max(0, ordered - dispatched),
    progress: Number.isFinite(progress) ? progress : 0,
  };
};

export const getPurchaseOrderProgress = (
  items: ProgressOrderItem[],
  deliveries: ProgressDelivery[]
) => {
  const itemProgress = items.map((item) =>
    getPurchaseOrderItemProgress(item, deliveries)
  );
  const unitTotals = new Map<
    string,
    { ordered: number; dispatched: number; received: number; pending: number }
  >();

  items.forEach((item, index) => {
    const unit = item.unit?.trim() || "units";
    const total = unitTotals.get(unit) || {
      ordered: 0,
      dispatched: 0,
      received: 0,
      pending: 0,
    };
    total.ordered += itemProgress[index].ordered;
    total.dispatched += itemProgress[index].dispatched;
    total.received += itemProgress[index].received;
    total.pending += itemProgress[index].pending;
    unitTotals.set(unit, total);
  });

  const measurableItems = itemProgress.filter((item) => item.ordered > 0);
  const progress = measurableItems.length
    ? measurableItems.reduce((sum, item) => sum + item.progress, 0) /
      measurableItems.length
    : 0;

  const formatByUnit = (
    key: "ordered" | "dispatched" | "received" | "pending"
  ) => {
    const entries = [...unitTotals.entries()];
    const hasQuantity = entries.some(([, totals]) => totals[key] > 0);

    return entries
      .filter(([, totals]) => !hasQuantity || totals[key] > 0)
      .map(
        ([unit, totals]) =>
          `${new Intl.NumberFormat("en-IN", {
            maximumFractionDigits: 2,
          }).format(totals[key])} ${unit}`
      )
      .join(" · ") || "0";
  };

  return {
    items: itemProgress,
    progress: Number.isFinite(progress)
      ? Math.min(100, Math.max(0, progress))
      : 0,
    formatOrdered: formatByUnit("ordered"),
    formatDispatched: formatByUnit("dispatched"),
    formatReceived: formatByUnit("received"),
    formatPending: formatByUnit("pending"),
  };
};
