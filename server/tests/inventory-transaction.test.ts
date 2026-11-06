import { describe, expect, it } from "vitest";
import InventoryTransaction from "../src/models/InventoryTransaction";
import InventoryProduct from "../src/models/InventoryProduct";

describe("QC inventory posting idempotency", () => {
  it("enforces one accepted inventory transaction per inspection item", () => {
    const hasUniqueInspectionItemIndex = InventoryTransaction.schema
      .indexes()
      .some(([keys, options]) =>
        keys.inspectionId === 1 &&
        keys.rfqItemId === 1 &&
        options.unique === true
      );

    expect(hasUniqueInspectionItemIndex).toBe(true);
  });

  it("keeps inventory products unique by organization and source RFQ item", () => {
    const indexes = InventoryProduct.schema.indexes();

    expect(indexes).toContainEqual([
      { buyerOrganizationId: 1, sourceRfqItemId: 1 },
      { unique: true },
    ]);
    expect(indexes).toContainEqual([
      { buyerOrganizationId: 1, sku: 1 },
      { unique: true },
    ]);
  });
});
