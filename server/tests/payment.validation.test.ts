
import { describe, it, expect } from "vitest";
import {
  createPaymentSchema,
  updatePaymentStatusSchema,
} from "../src/modules/payment/payment.validation";

describe("Payment Validation Tests", () => {
  it("should accept valid payment details", () => {
    const result = createPaymentSchema.safeParse({
      invoiceId: "6ae97dd339c360690b3288b6",
      amount: 1000,
      paymentMethod: "bank_transfer",
      transactionReference: "TEST-TXN-001",
      paymentDate: new Date().toISOString(),
      remarks: "Automated payment test",
    });

    expect(result.success).toBe(true);
  });

  it("should reject a zero payment amount", () => {
    const result = createPaymentSchema.safeParse({
      invoiceId: "6ae97dd339c360690b3288b6",
      amount: 0,
      paymentMethod: "bank_transfer",
      paymentDate: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it("should reject an invalid payment method", () => {
    const result = createPaymentSchema.safeParse({
      invoiceId: "6ae97dd339c360690b3288b6",
      amount: 1000,
      paymentMethod: "cash",
      paymentDate: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it("should accept a valid completed status update", () => {
    const result = updatePaymentStatusSchema.safeParse({
      status: "completed",
      remarks: "Payment verified",
    });

    expect(result.success).toBe(true);
  });

  it("should reject an invalid payment status", () => {
    const result = updatePaymentStatusSchema.safeParse({
      status: "approved",
    });

    expect(result.success).toBe(false);
  });
});
