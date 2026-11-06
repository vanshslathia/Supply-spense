import { describe, expect, it } from "vitest";
import {
  getPendingQcDeliveries,
  getQcDashboardStats,
} from "../src/modules/delivery/qc-dashboard.utils";

const delivery = { _id: "delivery-1", receivingStatus: "submitted_for_qc" };

describe("QC dashboard queue and statistics", () => {
  it("includes a QC-eligible delivery that has no inspection", () => {
    const pending = getPendingQcDeliveries([delivery], []);

    expect(pending).toEqual([delivery]);
    expect(getQcDashboardStats(pending, []).pending).toBe(1);
  });

  it("removes a delivery from pending when an inspection is in progress", () => {
    const inspections = [{
      deliveryId: "delivery-1",
      status: "in_progress" as const,
      decision: "pending" as const,
    }];
    const pending = getPendingQcDeliveries([delivery], inspections);
    const stats = getQcDashboardStats(pending, inspections);

    expect(pending).toEqual([]);
    expect(stats.pending).toBe(0);
    expect(stats.inProgress).toBe(1);
  });

  it("removes completed deliveries from pending and summarizes accepted quantities", () => {
    const inspections = [{
      deliveryId: "delivery-1",
      status: "completed" as const,
      decision: "passed" as const,
      productDispositions: [{
        acceptedQuantity: 100,
        rejectedQuantity: 0,
        onHoldQuantity: 0,
      }],
    }];
    const pending = getPendingQcDeliveries([delivery], inspections);
    const stats = getQcDashboardStats(pending, inspections);

    expect(pending).toEqual([]);
    expect(stats).toEqual({
      pending: 0,
      inProgress: 0,
      completed: 1,
      acceptedQuantity: 100,
      rejectedQuantity: 0,
      onHold: 0,
    });
  });

  it("matches populated delivery references by their database ID", () => {
    const inspections = [{
      deliveryId: {
        _id: "delivery-1",
        toString: () => "[object Object]",
      },
      status: "completed" as const,
      decision: "passed" as const,
    }];

    expect(getPendingQcDeliveries([delivery], inspections)).toEqual([]);
  });

  it("keeps on-hold deliveries out of pending and counts one latest inspection per delivery", () => {
    const inspections = [
      {
        deliveryId: "delivery-1",
        status: "completed" as const,
        decision: "passed" as const,
        updatedAt: "2026-11-06T10:00:00.000Z",
        productDispositions: [{
          acceptedQuantity: 100,
          rejectedQuantity: 0,
          onHoldQuantity: 0,
        }],
      },
      {
        deliveryId: "delivery-1",
        status: "completed" as const,
        decision: "on_hold" as const,
        updatedAt: "2026-11-06T11:00:00.000Z",
        productDispositions: [{
          acceptedQuantity: 0,
          rejectedQuantity: 0,
          onHoldQuantity: 100,
        }],
      },
    ];
    const pending = getPendingQcDeliveries([delivery], inspections);
    const stats = getQcDashboardStats(pending, inspections);

    expect(pending).toEqual([]);
    expect(stats.completed).toBe(1);
    expect(stats.acceptedQuantity).toBe(0);
    expect(stats.onHold).toBe(1);
  });
});
