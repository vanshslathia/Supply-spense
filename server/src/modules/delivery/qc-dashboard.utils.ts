export interface QcDeliveryReference {
  _id: string | { toString(): string };
}

type QcDocumentReference =
  | string
  | {
      _id?: string | { toString(): string };
      toString(): string;
    };

export interface QcInspectionReference {
  deliveryId: QcDocumentReference;
  status: "draft" | "in_progress" | "completed";
  decision: "pending" | "passed" | "rejected" | "on_hold";
  updatedAt?: Date | string;
  createdAt?: Date | string;
  productDispositions?: {
    acceptedQuantity: number;
    rejectedQuantity: number;
    onHoldQuantity: number;
  }[];
}

const referenceId = (value: QcDocumentReference) => {
  if (typeof value === "string") return value;
  if (value._id) {
    return typeof value._id === "string" ? value._id : value._id.toString();
  }
  return value.toString();
};

export const getPendingQcDeliveries = <T extends QcDeliveryReference>(
  deliveries: T[],
  inspections: QcInspectionReference[]
): T[] => {
  const inspectedDeliveryIds = new Set(
    inspections.map((inspection) => referenceId(inspection.deliveryId))
  );

  return deliveries.filter(
    (delivery) => !inspectedDeliveryIds.has(referenceId(delivery._id))
  );
};

const getLatestInspectionPerDelivery = <T extends QcInspectionReference>(
  inspections: T[]
): T[] => {
  const latestByDelivery = new Map<string, T>();
  const newestFirst = [...inspections].sort((left, right) => {
    const leftDate = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightDate = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightDate - leftDate;
  });

  for (const inspection of newestFirst) {
    const deliveryId = referenceId(inspection.deliveryId);
    if (!latestByDelivery.has(deliveryId)) {
      latestByDelivery.set(deliveryId, inspection);
    }
  }

  return [...latestByDelivery.values()];
};

export const getQcDashboardStats = (
  pendingDeliveries: QcDeliveryReference[],
  inspections: QcInspectionReference[]
) => {
  const latestInspections = getLatestInspectionPerDelivery(inspections);
  const completedInspections = latestInspections.filter(
    (inspection) => inspection.status === "completed"
  );

  return {
    pending: pendingDeliveries.length,
    inProgress: latestInspections.filter(
      (inspection) => inspection.status === "in_progress"
    ).length,
    completed: completedInspections.length,
    acceptedQuantity: completedInspections.reduce(
      (total, inspection) =>
        total +
        (inspection.decision === "passed"
          ? (inspection.productDispositions || []).reduce(
              (sum, disposition) => sum + disposition.acceptedQuantity,
              0
            )
          : 0),
      0
    ),
    rejectedQuantity: completedInspections.reduce(
      (total, inspection) =>
        total +
        (inspection.productDispositions || []).reduce(
          (sum, disposition) => sum + disposition.rejectedQuantity,
          0
        ),
      0
    ),
    onHold: latestInspections.filter(
      (inspection) => inspection.decision === "on_hold"
    ).length,
  };
};
