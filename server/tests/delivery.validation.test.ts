import { describe, expect, it } from "vitest";
import {
  createDeliverySchema,
  recordDeliveryArrivalSchema,
  recordWarehouseReceiptSchema,
  submitInspectionResultsSchema,
} from "../src/modules/delivery/delivery.validation";

describe("delivery workflow validation", () => {
  it("requires a tracking number, carrier, and idempotency key for shipments", () => {
    const invalid = createDeliverySchema.safeParse({
      items: [{
        rfqItemId: "6ae97dd339c360690b3288b6",
        dispatchedQuantity: 60,
      }],
      expectedDeliveryDate: "2026-11-24T00:00:00.000Z",
    });
    expect(invalid.success).toBe(false);

    const valid = createDeliverySchema.safeParse({
      idempotencyKey: "cfbff0d1-9375-4c12-8d37-3e6ba82c7298",
      items: [{
        rfqItemId: "6ae97dd339c360690b3288b6",
        dispatchedQuantity: 60,
      }],
      trackingNumber: "BD-TEST-10001",
      transporterName: "Blue Dart",
      expectedDeliveryDate: "2026-11-24T00:00:00.000Z",
    });
    expect(valid.success).toBe(true);
  });

  it("accepts warehouse arrival conditions and challan information", () => {
    const result = recordDeliveryArrivalSchema.safeParse({
      vehicleNumber: "KA 03 AB 1234",
      challanNumber: "CH-100",
      packagingCondition: "intact",
      sealCondition: "intact",
      notes: "Seal checked at gate.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects damaged quantities greater than the physical receipt", () => {
    const result = recordWarehouseReceiptSchema.safeParse({
      items: [{
        rfqItemId: "6ae97dd339c360690b3288b6",
        receivedQuantity: 3,
        damagedQuantity: 4,
      }],
    });

    expect(result.success).toBe(false);
  });

  it("requires a reason when the inspector places an inspection on hold", () => {
    const result = submitInspectionResultsSchema.safeParse({
      inspectedUnits: [{
        productId: "unit-1",
        result: "passed",
      }],
      dispositions: [{
        productId: "6ae97dd339c360690b3288b6",
        acceptedQuantity: 1,
        rejectedQuantity: 0,
        onHoldQuantity: 0,
      }],
      placeOnHold: true,
    });

    expect(result.success).toBe(false);
  });

  it("requires severity and a reason category for defective samples", () => {
    const result = submitInspectionResultsSchema.safeParse({
      inspectedUnits: [{
        productId: "unit-1",
        result: "defective",
        defectCategory: "Packaging",
      }],
      dispositions: [{
        productId: "6ae97dd339c360690b3288b6",
        acceptedQuantity: 0,
        rejectedQuantity: 1,
        onHoldQuantity: 0,
      }],
    });

    expect(result.success).toBe(false);
  });

  it("accepts QC evidence URLs and explicit product dispositions", () => {
    const result = submitInspectionResultsSchema.safeParse({
      inspectedUnits: [{
        productId: "unit-1",
        result: "defective",
        defectCategory: "Packaging",
        severity: "major",
        evidenceUrls: ["https://example.com/evidence.jpg"],
      }],
      dispositions: [{
        productId: "6ae97dd339c360690b3288b6",
        acceptedQuantity: 0,
        rejectedQuantity: 1,
        onHoldQuantity: 0,
      }],
    });

    expect(result.success).toBe(true);
  });
});
