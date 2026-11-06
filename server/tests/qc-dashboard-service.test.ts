import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const mocks = vi.hoisted(() => ({
  userFindById: vi.fn(),
  deliveryFind: vi.fn(),
  inspectionFind: vi.fn(),
}));

vi.mock("../src/models/User", () => ({
  default: { findById: mocks.userFindById },
}));
vi.mock("../src/models/Delivery", () => ({
  default: { find: mocks.deliveryFind },
}));
vi.mock("../src/models/Inspection", () => ({
  default: { find: mocks.inspectionFind },
}));
vi.mock("../src/models/DeliveryException", () => ({ default: {} }));
vi.mock("../src/models/InventoryTransaction", () => ({ default: {} }));
vi.mock("../src/models/PurchaseOrder", () => ({ default: {} }));
vi.mock("../src/models/Organizational", () => ({ default: {} }));
vi.mock("../src/modules/notification/notification.service", () => ({
  notifyOrganizationRoles: vi.fn(),
  notifySupplier: vi.fn(),
}));

import { getQcInspectorDashboard } from "../src/modules/delivery/delivery.service";

const createQuery = <T,>(records: T[]) => {
  const query = {
    populate: vi.fn(),
    sort: vi.fn(),
  };
  query.populate.mockReturnValue(query);
  query.sort.mockResolvedValue(records);
  return query;
};

describe("QC dashboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes delivery and inspection records to the authenticated inspector organization", async () => {
    const organizationId = new mongoose.Types.ObjectId(
      "222222222222222222222222"
    );
    const inspectorId = new mongoose.Types.ObjectId(
      "111111111111111111111111"
    );
    const deliveryId = new mongoose.Types.ObjectId(
      "444444444444444444444444"
    );
    const inspector = {
      _id: inspectorId,
      role: "qc_inspector",
      accountStatus: "active",
      emailVerified: true,
      organizationId,
    };
    const delivery = {
      _id: deliveryId,
      receivingStatus: "submitted_for_qc",
    };
    const inspection = {
      deliveryId,
      status: "completed" as const,
      decision: "passed" as const,
      productDispositions: [{
        acceptedQuantity: 100,
        rejectedQuantity: 0,
        onHoldQuantity: 0,
      }],
    };

    mocks.userFindById.mockResolvedValue(inspector);
    mocks.deliveryFind.mockReturnValue(createQuery([delivery]));
    mocks.inspectionFind.mockReturnValue(createQuery([inspection]));

    const dashboard = await getQcInspectorDashboard(inspectorId.toString());

    expect(mocks.deliveryFind).toHaveBeenCalledWith({
      buyerOrganizationId: organizationId,
      receivingStatus: "submitted_for_qc",
    });
    expect(mocks.inspectionFind).toHaveBeenCalledWith({
      buyerOrganizationId: organizationId,
    });
    expect(dashboard.pendingDeliveries).toEqual([]);
    expect(dashboard.stats).toEqual({
      pending: 0,
      inProgress: 0,
      completed: 1,
      acceptedQuantity: 100,
      rejectedQuantity: 0,
      onHold: 0,
    });
  });
});
