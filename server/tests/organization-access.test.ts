import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const modelMocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
  findOrganizationById: vi.fn(),
}));

vi.mock("../src/models/User", () => ({
  default: { findById: modelMocks.findUserById },
}));

vi.mock("../src/models/Organizational", () => ({
  default: { findById: modelMocks.findOrganizationById },
}));

import { enforceActiveOrganization } from "../src/middleware/auth.middleware";

const createRequest = () => {
  const request = {
    session: {
      userId: "employee-id",
      destroy: vi.fn((callback: (error?: Error | null) => void) =>
        callback(null)
      ),
    },
  };
  return request as unknown as Request;
};

const createResponse = () => {
  const response = {
    clearCookie: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return response as unknown as Response & {
    clearCookie: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
};

describe("organization access enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an employee request when their organization is active", async () => {
    modelMocks.findUserById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        role: "warehouse",
        organizationId: "organization-id",
      }),
    });
    modelMocks.findOrganizationById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ isActive: true }),
    });
    const request = createRequest();
    const response = createResponse();
    const next = vi.fn();

    await enforceActiveOrganization(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
    expect(request.session.destroy).not.toHaveBeenCalled();
  });

  it("destroys an existing employee session when their organization is inactive", async () => {
    modelMocks.findUserById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        role: "warehouse",
        organizationId: "organization-id",
      }),
    });
    modelMocks.findOrganizationById.mockReturnValue({
      select: vi.fn().mockResolvedValue({ isActive: false }),
    });
    const request = createRequest();
    const response = createResponse();
    const next = vi.fn();

    await enforceActiveOrganization(request, response, next);

    expect(request.session.destroy).toHaveBeenCalledOnce();
    expect(response.clearCookie).toHaveBeenCalledWith("supplysense.sid");
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: "Your organization is inactive. Access has been revoked.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("does not apply organization access checks to administrators", async () => {
    modelMocks.findUserById.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        role: "admin",
        organizationId: "organization-id",
      }),
    });
    const request = createRequest();
    const response = createResponse();
    const next = vi.fn();

    await enforceActiveOrganization(request, response, next);

    expect(modelMocks.findOrganizationById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
