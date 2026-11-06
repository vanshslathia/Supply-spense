import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const mocks = vi.hoisted(() => ({
  transactionAggregate: vi.fn(),
  transactionFind: vi.fn(),
  productFind: vi.fn(),
  locationFind: vi.fn(),
}));

vi.mock("../src/models/InventoryTransaction", () => ({
  default: {
    aggregate: mocks.transactionAggregate,
    find: mocks.transactionFind,
  },
}));
vi.mock("../src/models/InventoryProduct", () => ({
  default: { find: mocks.productFind },
}));
vi.mock("../src/models/WarehouseLocation", () => ({
  default: { find: mocks.locationFind },
}));

import { getInventoryProductsForUser } from "../src/modules/inventory/inventory.service";

describe("inventory service organization scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the authenticated employee organization and derives stock buckets from the ledger", async () => {
    const organizationId = new mongoose.Types.ObjectId("222222222222222222222222");
    const rfqItemId = new mongoose.Types.ObjectId("555555555555555555555555");
    const productId = new mongoose.Types.ObjectId("999999999999999999999999");
    const locationId = new mongoose.Types.ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa");
    const postedAt = new Date("2026-01-01T00:00:00.000Z");
    mocks.transactionAggregate.mockResolvedValue([{
      _id: { buyerOrganizationId: organizationId, rfqItemId },
      productName: "Business Laptop",
      locationId,
      availableQuantity: 100,
      rejectedQuantity: 2,
      onHoldQuantity: 3,
      lastUpdated: postedAt,
      inventoryValue: 125000,
      unpricedAcceptedQuantity: 0,
    }]);
    mocks.productFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{
        _id: productId,
        buyerOrganizationId: organizationId,
        sourceRfqItemId: rfqItemId,
        sku: "RFQ-TEST",
        productName: "Business Laptop",
        category: "Electronics",
        unit: "each",
        reorderLevel: 100,
        warehouseLocationId: locationId,
      }]),
    });
    mocks.locationFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{
          _id: locationId,
          name: "Main Warehouse",
          code: "MAIN",
        }]),
      }),
    });

    const products = await getInventoryProductsForUser({
      role: "warehouse",
      organizationId,
    } as never);

    expect(mocks.transactionAggregate.mock.calls[0][0][0]).toEqual({
      $match: { buyerOrganizationId: organizationId },
    });
    expect(products).toMatchObject([{
      sourceRfqItemId: rfqItemId.toString(),
      productName: "Business Laptop",
      category: "Electronics",
      locationName: "Main Warehouse",
      totalQuantity: 105,
      availableQuantity: 100,
      rejectedQuantity: 2,
      onHoldQuantity: 3,
      reorderLevel: 100,
      status: "low_stock",
      inventoryValue: 125000,
    }]);
  });

  it("does not apply an employee-selected organization override", async () => {
    const organizationId = new mongoose.Types.ObjectId("222222222222222222222222");
    mocks.transactionAggregate.mockResolvedValue([]);

    await getInventoryProductsForUser(
      { role: "procurement", organizationId } as never,
      "333333333333333333333333"
    );

    expect(mocks.transactionAggregate.mock.calls[0][0][0]).toEqual({
      $match: { buyerOrganizationId: organizationId },
    });
  });
});
