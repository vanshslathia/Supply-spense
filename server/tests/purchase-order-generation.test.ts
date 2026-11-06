import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import PurchaseOrder from "../src/models/PurchaseOrder";
import Delivery from "../src/models/Delivery";
import Quotation from "../src/models/Quotation";
import RFQ from "../src/models/RFQ";
import {
  buildPurchaseOrderData,
  mergePurchaseOrderItemsWithQuotation,
} from "../src/modules/purchase-order/purchase-order.service";
import { getPurchaseOrderProgress } from "../../client/src/features/delivery/utils/purchaseOrderProgress";

const makeQuotation = (overrides: Record<string, unknown> = {}) =>
  new Quotation({
    quotationNumber: "QUO-TEST",
    rfqId: new mongoose.Types.ObjectId(),
    supplierId: new mongoose.Types.ObjectId(),
    buyerOrganizationId: new mongoose.Types.ObjectId(),
    items: [
      {
        rfqItemId: new mongoose.Types.ObjectId(),
        productName: "Business Laptop",
        quantity: 100,
        unit: "unit",
        unitPrice: 48_000,
        totalPrice: 4_800_000,
      },
    ],
    subtotal: 4_800_000,
    taxPercentage: 18,
    taxAmount: 864_000,
    deliveryCharges: 0,
    totalAmount: 5_664_000,
    deliveryTimeline: 18,
    validityDate: new Date("2026-12-06"),
    status: "accepted",
    ...overrides,
  });

const makeRFQ = (overrides: Record<string, unknown> = {}) =>
  new RFQ({
    deliveryLocation: "Buyer warehouse",
    deliveryDate: new Date("2026-12-24"),
    ...overrides,
  });

describe("purchase order generation", () => {
  it("copies and validates the accepted quotation's commercial values", () => {
    const quotation = makeQuotation();
    const rfq = makeRFQ();
    const createdBy = new mongoose.Types.ObjectId();
    const issuedAt = new Date("2026-11-06T00:00:00.000Z");

    const purchaseOrder = buildPurchaseOrderData(
      quotation,
      rfq,
      createdBy,
      issuedAt
    );

    expect(purchaseOrder).toMatchObject({
      quotationId: quotation._id,
      rfqId: quotation.rfqId,
      supplierId: quotation.supplierId,
      buyerOrganizationId: quotation.buyerOrganizationId,
      subtotal: 4_800_000,
      taxPercentage: 18,
      taxAmount: 864_000,
      deliveryCharges: 0,
      totalAmount: 5_664_000,
      deliveryTimeline: 18,
      status: "issued",
      issuedAt,
      createdBy,
    });
    expect(purchaseOrder.items).toEqual([
      expect.objectContaining({
        productName: "Business Laptop",
        quantity: 100,
        unitPrice: 48_000,
        totalPrice: 4_800_000,
      }),
    ]);
  });

  it("rejects inconsistent quotation totals", () => {
    const quotation = makeQuotation({ totalAmount: 5_000_000 });

    expect(() =>
      buildPurchaseOrderData(
        quotation,
        makeRFQ(),
        new mongoose.Types.ObjectId()
      )
    ).toThrow("Quotation commercial totals are inconsistent.");
  });

  it("enforces one purchase order per quotation with a unique index", () => {
    const hasUniqueQuotationIndex = PurchaseOrder.schema
      .indexes()
      .some(
        ([keys, options]) =>
          keys.quotationId === 1 && options.unique === true
      );

    expect(hasUniqueQuotationIndex).toBe(true);
    expect(PurchaseOrder.schema.path("acknowledgedBy")).toBeDefined();
  });

  it("enforces idempotency keys for supplier shipment requests", () => {
    const hasUniqueIdempotencyIndex = Delivery.schema
      .indexes()
      .some(
        ([keys, options]) =>
          keys.supplierId === 1 &&
          keys.idempotencyKey === 1 &&
          options.unique === true &&
          options.partialFilterExpression !== undefined
      );

    expect(hasUniqueIdempotencyIndex).toBe(true);
  });

  it("uses the source quotation to fill missing legacy PO item fields", () => {
    const quotation = makeQuotation();
    const quotationItem = quotation.items[0];
    const repairedItems = mergePurchaseOrderItemsWithQuotation(
      [
        {
          rfqItemId: quotationItem.rfqItemId,
        },
      ],
      quotation.items
    );

    expect(repairedItems[0]).toMatchObject({
      productName: "Business Laptop",
      quantity: 100,
      unit: "unit",
      unitPrice: 48_000,
      totalPrice: 4_800_000,
    });
  });

  it("calculates safe progress for undispatched, partially dispatched, and received quantities", () => {
    const items = [
      { rfqItemId: "laptop", quantity: 100, unit: "Pieces" },
    ];

    expect(
      getPurchaseOrderProgress(items, []).formatPending
    ).toBe("100 Pieces");
    expect(getPurchaseOrderProgress(items, []).progress).toBe(0);

    const partialDispatch = [
      {
        items: [
          {
            rfqItemId: "laptop",
            dispatchedQuantity: 40,
            deliveredQuantity: 0,
          },
        ],
      },
    ];
    const dispatchedProgress = getPurchaseOrderProgress(
      items,
      partialDispatch
    );
    expect(dispatchedProgress.formatDispatched).toBe("40 Pieces");
    expect(dispatchedProgress.formatPending).toBe("60 Pieces");
    expect(dispatchedProgress.progress).toBe(0);

    const partialReceipt = [
      {
        items: [
          {
            rfqItemId: "laptop",
            dispatchedQuantity: 40,
            deliveredQuantity: 20,
          },
        ],
      },
    ];
    const receivedProgress = getPurchaseOrderProgress(items, partialReceipt);
    expect(receivedProgress.formatReceived).toBe("20 Pieces");
    expect(receivedProgress.formatPending).toBe("60 Pieces");
    expect(receivedProgress.progress).toBe(20);
    expect(Number.isFinite(receivedProgress.progress)).toBe(true);
  });

  it("keeps quantities grouped by unit and handles invalid numbers safely", () => {
    const progress = getPurchaseOrderProgress(
      [
        { rfqItemId: "box", quantity: "4", unit: "Boxes" },
        { rfqItemId: "each", quantity: Number.NaN, unit: "Pieces" },
      ],
      [
        {
          items: [
            {
              rfqItemId: "box",
              dispatchedQuantity: Number.POSITIVE_INFINITY,
              deliveredQuantity: "2",
            },
          ],
        },
      ]
    );

    expect(progress.formatOrdered).toBe("4 Boxes");
    expect(progress.formatDispatched).toBe("0 Boxes · 0 Pieces");
    expect(progress.formatReceived).toBe("2 Boxes");
    expect(Number.isFinite(progress.progress)).toBe(true);
    expect(progress.progress).toBe(50);
  });
});
