import mongoose from "mongoose";
import Organization from "../../models/Organizational";
import User from "../../models/User";
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  UpdateOrganizationStatusInput,
} from "./organization.validation";

const employeeRoles = [
  "procurement",
  "analyst",
  "finance",
  "warehouse",
  "qc_inspector",
] as const;

export class OrganizationServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "OrganizationServiceError";
  }
}

interface OrganizationEmployeeStatsGroup {
  _id: {
    organizationId: mongoose.Types.ObjectId;
    role: (typeof employeeRoles)[number];
    accountStatus: "active" | "suspended";
  };
  count: number;
}

interface OrganizationStats {
  employeeCount: number;
  activeEmployees: number;
  suspendedEmployees: number;
  employeesByRole: Record<(typeof employeeRoles)[number], number>;
}

const emptyStats = (): OrganizationStats => ({
  employeeCount: 0,
  activeEmployees: 0,
  suspendedEmployees: 0,
  employeesByRole: {
    procurement: 0,
    analyst: 0,
    finance: 0,
    warehouse: 0,
    qc_inspector: 0,
  },
});

const getStatsByOrganization = async (
  organizationIds: mongoose.Types.ObjectId[]
) => {
  const groups = await User.aggregate<OrganizationEmployeeStatsGroup>([
    {
      $match: {
        organizationId: { $in: organizationIds },
        role: { $in: employeeRoles },
      },
    },
    {
      $group: {
        _id: {
          organizationId: "$organizationId",
          role: "$role",
          accountStatus: "$accountStatus",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const stats = new Map<string, OrganizationStats>();
  for (const group of groups) {
    const organizationId = group._id.organizationId.toString();
    const current = stats.get(organizationId) ?? emptyStats();
    current.employeeCount += group.count;
    current.employeesByRole[group._id.role] += group.count;
    if (group._id.accountStatus === "active") {
      current.activeEmployees += group.count;
    } else {
      current.suspendedEmployees += group.count;
    }
    stats.set(organizationId, current);
  }

  return stats;
};

const ensureValidId = (organizationId: string) => {
  if (!mongoose.Types.ObjectId.isValid(organizationId)) {
    throw new OrganizationServiceError("Invalid organization ID.", 400);
  }
};

const ensureCodeAvailable = async (
  code: string,
  excludingId?: mongoose.Types.ObjectId
) => {
  const query: { organizationCode: string; _id?: { $ne: mongoose.Types.ObjectId } } =
    { organizationCode: code };
  if (excludingId) query._id = { $ne: excludingId };
  const duplicate = await Organization.exists(query);
  if (duplicate) {
    throw new OrganizationServiceError(
      "An organization with this code already exists.",
      409
    );
  }
};

export const listOrganizations = async (activeOnly = false) => {
  const organizations = await Organization.find(
    activeOnly ? { isActive: true } : {}
  )
    .sort({ name: 1 })
    .lean();
  const stats = await getStatsByOrganization(
    organizations.map((organization) => organization._id)
  );

  return organizations.map((organization) => ({
    ...organization,
    employeeCount:
      stats.get(organization._id.toString())?.employeeCount ?? 0,
  }));
};

export const getOrganizationDetails = async (organizationId: string) => {
  ensureValidId(organizationId);
  const organization = await Organization.findById(organizationId).lean();
  if (!organization) {
    throw new OrganizationServiceError("Organization not found.", 404);
  }

  const stats = await getStatsByOrganization([organization._id]);
  return {
    ...organization,
    ...(stats.get(organization._id.toString()) ?? emptyStats()),
  };
};

export const createOrganization = async (
  input: CreateOrganizationInput
) => {
  await ensureCodeAvailable(input.organizationCode);
  try {
    return await Organization.create({
      ...input,
      isActive: true,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new OrganizationServiceError(
        "An organization with this code already exists.",
        409
      );
    }
    throw error;
  }
};

export const updateOrganization = async (
  organizationId: string,
  input: UpdateOrganizationInput
) => {
  ensureValidId(organizationId);
  if (input.organizationCode) {
    await ensureCodeAvailable(
      input.organizationCode,
      new mongoose.Types.ObjectId(organizationId)
    );
  }

  try {
    const organization = await Organization.findByIdAndUpdate(
      organizationId,
      { $set: input },
      { new: true, runValidators: true }
    );
    if (!organization) {
      throw new OrganizationServiceError("Organization not found.", 404);
    }
    return organization;
  } catch (error) {
    if (error instanceof OrganizationServiceError) throw error;
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new OrganizationServiceError(
        "An organization with this code already exists.",
        409
      );
    }
    throw error;
  }
};

export const updateOrganizationStatus = async (
  organizationId: string,
  input: UpdateOrganizationStatusInput
) => {
  ensureValidId(organizationId);
  const organization = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: { isActive: input.isActive } },
    { new: true, runValidators: true }
  );
  if (!organization) {
    throw new OrganizationServiceError("Organization not found.", 404);
  }
  return organization;
};
