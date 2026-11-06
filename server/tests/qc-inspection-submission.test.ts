import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose, { type ClientSession } from "mongoose";

const mocks = vi.hoisted(() => ({
  userFindById: vi.fn(),
  inspectionFindById: vi.fn(),
  deliveryFindById: vi.fn(),
  inventoryFind: vi.fn(),
  inventoryCreate: vi.fn(),
  purchaseOrderFindById: vi.fn(),
  rfqFindById: vi.fn(),
  inventoryProductFindOneAndUpdate: vi.fn(),
  deliveryExceptionCreate: vi.fn(),
  notifyOrganizationRoles: vi.fn(),
  notifySupplier: vi.fn(),
}));

vi.mock("../src/models/User", () => ({
  default: { findById: mocks.userFindById },
}));
vi.mock("../src/models/Inspection", () => ({
  default: { findById: mocks.inspectionFindById },
}));
vi.mock("../src/models/Delivery", () => ({
  default: { findById: mocks.deliveryFindById },
}));
vi.mock("../src/models/InventoryTransaction", () => ({
  default: {
    find: mocks.inventoryFind,
    create: mocks.inventoryCreate,
  },
}));
vi.mock("../src/models/DeliveryException", () => ({
  default: { create: mocks.deliveryExceptionCreate },
}));
vi.mock("../src/models/PurchaseOrder", () => ({
  default: { findById: mocks.purchaseOrderFindById },
}));
vi.mock("../src/models/RFQ", () => ({
  default: { findById: mocks.rfqFindById },
}));
vi.mock("../src/models/InventoryProduct", () => ({
  default: { findOneAndUpdate: mocks.inventoryProductFindOneAndUpdate },
}));
vi.mock("../src/models/Organizational", () => ({ default: {} }));
vi.mock("../src/modules/notification/notification.service", () => ({
  notifyOrganizationRoles: mocks.notifyOrganizationRoles,
  notifySupplier: mocks.notifySupplier,
}));

import { submitQualityInspectionResults } from "../src/modules/delivery/delivery.service";

describe("QC inspection result submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not post inventory or complete an inspection again on repeated submission", async () => {
    const inspectorId = "111111111111111111111111";
    const organizationId = "222222222222222222222222";
    const inspectionId = "333333333333333333333333";
    const deliveryId = "444444444444444444444444";
    const rfqItemId = "555555555555555555555555";
    const inspector = {
      _id: new mongoose.Types.ObjectId(inspectorId),
      role: "qc_inspector",
      accountStatus: "active",
      emailVerified: true,
      organizationId: new mongoose.Types.ObjectId(organizationId),
    };
    const inspection = {
      _id: new mongoose.Types.ObjectId(inspectionId),
      deliveryId: new mongoose.Types.ObjectId(deliveryId),
      buyerOrganizationId: new mongoose.Types.ObjectId(organizationId),
      inspectorId: new mongoose.Types.ObjectId(inspectorId),
      sampleSize: 1,
      rejectionThreshold: 1,
      status: "in_progress",
      decision: "pending",
      inspectedUnits: [],
      productDispositions: [],
      history: [],
      session: vi.fn(async () => inspection),
      save: vi.fn(async () => undefined),
    };
    const delivery = {
      _id: new mongoose.Types.ObjectId(deliveryId),
      buyerOrganizationId: new mongoose.Types.ObjectId(organizationId),
      purchaseOrderId: new mongoose.Types.ObjectId("666666666666666666666666"),
      supplierId: new mongoose.Types.ObjectId("777777777777777777777777"),
      items: [{
        rfqItemId: new mongoose.Types.ObjectId(rfqItemId),
        productName: "Business Laptop",
        acceptedForQcQuantity: 1,
        deliveredQuantity: 1,
        damagedQuantity: 0,
        missingQuantity: 0,
        unit: "each",
      }],
      session: vi.fn(async () => delivery),
    };
    const purchaseOrderId = delivery.purchaseOrderId;
    const purchaseOrder = {
      _id: purchaseOrderId,
      buyerOrganizationId: new mongoose.Types.ObjectId(organizationId),
      rfqId: new mongoose.Types.ObjectId("888888888888888888888888"),
      items: [{
        rfqItemId: new mongoose.Types.ObjectId(rfqItemId),
        unitPrice: 125,
      }],
    };
    const rfqItem = {
      _id: new mongoose.Types.ObjectId(rfqItemId),
      category: "Electronics",
      unit: "each",
    };

    mocks.userFindById.mockResolvedValue(inspector);
    mocks.inspectionFindById.mockReturnValue(inspection);
    mocks.deliveryFindById.mockReturnValue(delivery);
    mocks.inventoryFind.mockReturnValue({
      session: vi.fn().mockResolvedValue([]),
    });
    mocks.inventoryCreate.mockResolvedValue([]);
    mocks.purchaseOrderFindById.mockReturnValue({
      session: vi.fn().mockResolvedValue(purchaseOrder),
    });
    mocks.rfqFindById.mockReturnValue({
      session: vi.fn().mockResolvedValue({
        buyerOrganizationId: new mongoose.Types.ObjectId(organizationId),
        items: [rfqItem],
      }),
    });
    mocks.inventoryProductFindOneAndUpdate.mockResolvedValue({
      _id: new mongoose.Types.ObjectId("999999999999999999999999"),
    });

    const session = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
      endSession: vi.fn(),
    };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(
      session as unknown as ClientSession
    );

    const input = {
      inspectedUnits: [{ productId: "serial-1", result: "passed" as const }],
      dispositions: [{
        productId: rfqItemId,
        acceptedQuantity: 1,
        rejectedQuantity: 0,
        onHoldQuantity: 0,
      }],
      placeOnHold: false,
    };

    await submitQualityInspectionResults(inspectionId, inspectorId, input);
    expect(inspection.status).toBe("completed");
    expect(mocks.inventoryCreate).toHaveBeenCalledOnce();
    expect(mocks.inventoryCreate.mock.calls[0][0][0]).toMatchObject({
      quantity: 1,
      acceptedQuantity: 1,
      rejectedQuantity: 0,
      onHoldQuantity: 0,
      transactionType: "qc_accepted_receipt",
    });

    await expect(
      submitQualityInspectionResults(inspectionId, inspectorId, input)
    ).rejects.toThrow("This inspection is not open for result submission.");
    expect(mocks.inventoryCreate).toHaveBeenCalledOnce();
    expect(inspection.save).toHaveBeenCalledOnce();

    const rejectedInspection = {
      ...inspection,
      _id: new mongoose.Types.ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa"),
      status: "in_progress",
      decision: "pending",
      inspectedUnits: [],
      productDispositions: [],
      history: [],
      session: vi.fn(async () => rejectedInspection),
      save: vi.fn(async () => undefined),
    };
    mocks.inspectionFindById.mockReturnValue(rejectedInspection);
    mocks.inventoryFind.mockReturnValue({
      session: vi.fn().mockResolvedValue([{
        transactionType: "qc_accepted_receipt",
        quantity: 1,
        acceptedQuantity: 1,
      }]),
    });

    await submitQualityInspectionResults(rejectedInspection._id.toString(), inspectorId, {
      inspectedUnits: [{
        productId: "serial-2",
        result: "defective",
        defectDescription: "Damaged",
      }],
      dispositions: [{
        productId: rfqItemId,
        acceptedQuantity: 0,
        rejectedQuantity: 1,
        onHoldQuantity: 0,
      }],
      placeOnHold: false,
    });
    expect(mocks.inventoryCreate).toHaveBeenCalledTimes(2);
    expect(mocks.inventoryCreate.mock.calls[1][0][0]).toMatchObject({
      quantity: 1,
      acceptedQuantity: 0,
      rejectedQuantity: 1,
      onHoldQuantity: 0,
      transactionType: "qc_disposition",
    });
  });
});
