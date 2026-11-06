import { Types } from "mongoose";
import InventoryProduct from "../../models/InventoryProduct";
import InventoryTransaction from "../../models/InventoryTransaction";
import RFQ from "../../models/RFQ";
import User, { IUser } from "../../models/User";
import WarehouseLocation from "../../models/WarehouseLocation";

type InventoryScope = { buyerOrganizationId?: Types.ObjectId };

export type InventoryFilters = {
  search?: string;
  category?: string;
  locationId?: string;
  status?: "all" | "healthy" | "low_stock" | "out_of_stock";
};

const getInventoryScope = (user: IUser, organizationId?: string): InventoryScope => {
  if (user.role === "admin") {
    if (organizationId && !Types.ObjectId.isValid(organizationId)) {
      throw new Error("Invalid organization ID.");
    }
    return organizationId
      ? { buyerOrganizationId: new Types.ObjectId(organizationId) }
      : {};
  }

  if (!["procurement", "warehouse"].includes(user.role) || !user.organizationId) {
    throw new Error("You are not authorized to view inventory.");
  }
  return { buyerOrganizationId: user.organizationId };
};

const toNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const getInventoryProducts = async (
  scope: InventoryScope,
  filters: InventoryFilters = {}
) => {
  const grouped = await InventoryTransaction.aggregate<{
    _id: { buyerOrganizationId: Types.ObjectId; rfqItemId: Types.ObjectId };
    productName: string;
    locationId?: Types.ObjectId;
    availableQuantity: number;
    rejectedQuantity: number;
    onHoldQuantity: number;
    lastUpdated: Date;
    inventoryValue: number;
    unpricedAcceptedQuantity: number;
  }>([
    { $match: scope },
    {
      $group: {
        _id: {
          buyerOrganizationId: "$buyerOrganizationId",
          rfqItemId: "$rfqItemId",
        },
        productName: { $last: "$productName" },
        locationId: { $last: "$warehouseLocationId" },
        availableQuantity: {
          $sum: {
            $ifNull: [
              "$acceptedQuantity",
              {
                $cond: [
                  { $eq: ["$transactionType", "qc_accepted_receipt"] },
                  "$quantity",
                  0,
                ],
              },
            ],
          },
        },
        rejectedQuantity: { $sum: { $ifNull: ["$rejectedQuantity", 0] } },
        onHoldQuantity: { $sum: { $ifNull: ["$onHoldQuantity", 0] } },
        lastUpdated: { $max: "$postedAt" },
        inventoryValue: {
          $sum: {
            $cond: [
              { $isNumber: "$unitCost" },
              {
                $multiply: [
                  {
                    $ifNull: [
                      "$acceptedQuantity",
                      {
                        $cond: [
                          { $eq: ["$transactionType", "qc_accepted_receipt"] },
                          "$quantity",
                          0,
                        ],
                      },
                    ],
                  },
                  "$unitCost",
                ],
              },
              0,
            ],
          },
        },
        unpricedAcceptedQuantity: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $gt: [
                      {
                        $ifNull: [
                          "$acceptedQuantity",
                          {
                            $cond: [
                              { $eq: ["$transactionType", "qc_accepted_receipt"] },
                              "$quantity",
                              0,
                            ],
                          },
                        ],
                      },
                      0,
                    ],
                  },
                  { $not: [{ $isNumber: "$unitCost" }] },
                ],
              },
              {
                $ifNull: [
                  "$acceptedQuantity",
                  {
                    $cond: [
                      { $eq: ["$transactionType", "qc_accepted_receipt"] },
                      "$quantity",
                      0,
                    ],
                  },
                ],
              },
              0,
            ],
          },
        },
      },
    },
  ]);

  if (!grouped.length) return [];

  const organizationIds = [...new Set(grouped.map((entry) => entry._id.buyerOrganizationId.toString()))]
    .map((id) => new Types.ObjectId(id));
  const sourceItemIds = [...new Set(grouped.map((entry) => entry._id.rfqItemId.toString()))]
    .map((id) => new Types.ObjectId(id));
  const [products, locations] = await Promise.all([
    InventoryProduct.find({
      buyerOrganizationId: { $in: organizationIds },
      sourceRfqItemId: { $in: sourceItemIds },
    }).lean(),
    WarehouseLocation.find({
      buyerOrganizationId: { $in: organizationIds },
      isActive: true,
    }).select("_id name code").lean(),
  ]);
  const productBySource = new Map(
    products.map((product) => [
      `${product.buyerOrganizationId.toString()}:${product.sourceRfqItemId.toString()}`,
      product,
    ])
  );
  const locationById = new Map(locations.map((location) => [location._id.toString(), location]));
  const missingSourceItemIds = grouped
    .filter((entry) =>
      !productBySource.has(
        `${entry._id.buyerOrganizationId.toString()}:${entry._id.rfqItemId.toString()}`
      )
    )
    .map((entry) => entry._id.rfqItemId);
  const sourceRfqs = missingSourceItemIds.length
    ? await RFQ.find({
        buyerOrganizationId: { $in: organizationIds },
        "items._id": { $in: missingSourceItemIds },
      }).select("buyerOrganizationId items").lean()
    : [];
  const sourceItemByKey = new Map<string, { category: string; unit: string }>();
  for (const rfq of sourceRfqs) {
    for (const item of rfq.items) {
      sourceItemByKey.set(
        `${rfq.buyerOrganizationId.toString()}:${item._id.toString()}`,
        { category: item.category, unit: item.unit }
      );
    }
  }

  const result = grouped.map((entry) => {
    const orgId = entry._id.buyerOrganizationId.toString();
    const itemId = entry._id.rfqItemId.toString();
    const product = productBySource.get(`${orgId}:${itemId}`);
    const sourceItem = sourceItemByKey.get(`${orgId}:${itemId}`);
    const locationId = entry.locationId?.toString() || product?.warehouseLocationId?.toString();
    const location = locationId ? locationById.get(locationId) : undefined;
    const availableQuantity = toNumber(entry.availableQuantity);
    const rejectedQuantity = toNumber(entry.rejectedQuantity);
    const onHoldQuantity = toNumber(entry.onHoldQuantity);
    const reorderLevel = product?.reorderLevel || 0;
    const status = availableQuantity <= 0
      ? "out_of_stock"
      : reorderLevel > 0 && availableQuantity <= reorderLevel
        ? "low_stock"
        : "healthy";

    return {
      productId: product?._id.toString() || itemId,
      sourceRfqItemId: itemId,
      buyerOrganizationId: orgId,
      sku: product?.sku || `RFQ-${itemId.toUpperCase()}`,
      productName: product?.productName || entry.productName,
      category: product?.category || sourceItem?.category || "Uncategorized",
      unit: product?.unit || sourceItem?.unit || "unit",
      locationId: locationId || null,
      locationName: location?.name || "Unassigned",
      totalQuantity: availableQuantity + rejectedQuantity + onHoldQuantity,
      availableQuantity,
      reservedQuantity: 0,
      rejectedQuantity,
      onHoldQuantity,
      reorderLevel,
      status,
      lastUpdated: entry.lastUpdated,
      inventoryValue: toNumber(entry.unpricedAcceptedQuantity) > 0
        ? null
        : toNumber(entry.inventoryValue),
    };
  });

  const normalizedSearch = filters.search?.trim().toLowerCase();
  return result.filter((product) => {
    if (normalizedSearch && ![
      product.sku,
      product.productName,
      product.category,
    ].some((value) => value.toLowerCase().includes(normalizedSearch))) return false;
    if (filters.category && product.category !== filters.category) return false;
    if (filters.locationId === "unassigned" && product.locationId) return false;
    if (
      filters.locationId &&
      filters.locationId !== "unassigned" &&
      product.locationId !== filters.locationId
    ) return false;
    return !filters.status || filters.status === "all" || product.status === filters.status;
  }).sort((left, right) => left.productName.localeCompare(right.productName));
};

export const getInventoryOverview = async (
  user: IUser,
  organizationId?: string,
  filters: InventoryFilters = {}
) => {
  const scope = getInventoryScope(user, organizationId);
  const products = await getInventoryProducts(scope, filters);
  const summary = products.reduce(
    (totals, product) => {
      totals.totalStockQuantity += product.totalQuantity;
      totals.availableStock += product.availableQuantity;
      totals.reservedStock += product.reservedQuantity;
      totals.rejectedStock += product.rejectedQuantity;
      totals.onHoldStock += product.onHoldQuantity;
      if (product.status === "low_stock") totals.lowStockProducts += 1;
      if (product.inventoryValue === null) totals.hasUnpricedAcceptedStock = true;
      else totals.inventoryValuation += product.inventoryValue;
      return totals;
    },
    {
      totalProducts: products.length,
      totalStockQuantity: 0,
      availableStock: 0,
      reservedStock: 0,
      rejectedStock: 0,
      onHoldStock: 0,
      lowStockProducts: 0,
      inventoryValuation: 0,
      hasUnpricedAcceptedStock: false,
    }
  );

  const recentTransactions = await InventoryTransaction.find(scope)
    .sort({ postedAt: -1 })
    .limit(10)
    .select("productName quantity acceptedQuantity rejectedQuantity onHoldQuantity transactionType postedAt buyerOrganizationId")
    .lean();

  return {
    summary: {
      ...summary,
      inventoryValuation: summary.hasUnpricedAcceptedStock
        ? null
        : summary.inventoryValuation,
    },
    products,
    recentTransactions,
  };
};

export const getInventoryProductsForUser = async (
  user: IUser,
  organizationId?: string,
  filters: InventoryFilters = {}
) => getInventoryProducts(getInventoryScope(user, organizationId), filters);

export const getInventoryLocations = async (
  user: IUser,
  organizationId?: string
) => {
  const scope = getInventoryScope(user, organizationId);
  return WarehouseLocation.find({ ...scope, isActive: true })
    .sort({ name: 1 })
    .select("_id name code")
    .lean();
};

export const getInventoryLedger = async (
  user: IUser,
  options: {
    organizationId?: string;
    sourceRfqItemId?: string;
    transactionType?: string;
    startDate?: Date;
    endDate?: Date;
    page: number;
    pageSize: number;
  }
) => {
  const scope = getInventoryScope(user, options.organizationId);
  const query: Record<string, unknown> = { ...scope };
  if (options.sourceRfqItemId) {
    if (!Types.ObjectId.isValid(options.sourceRfqItemId)) {
      throw new Error("Invalid product ID.");
    }
    query.rfqItemId = new Types.ObjectId(options.sourceRfqItemId);
  }
  if (options.transactionType) query.transactionType = options.transactionType;
  if (options.startDate || options.endDate) {
    query.postedAt = {};
    if (options.startDate) (query.postedAt as Record<string, Date>).$gte = options.startDate;
    if (options.endDate) (query.postedAt as Record<string, Date>).$lte = options.endDate;
  }

  const [transactions, total] = await Promise.all([
    InventoryTransaction.find(query)
      .sort({ postedAt: -1, _id: -1 })
      .skip((options.page - 1) * options.pageSize)
      .limit(options.pageSize)
      .populate("warehouseLocationId", "name code")
      .lean(),
    InventoryTransaction.countDocuments(query),
  ]);

  return {
    transactions,
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.ceil(total / options.pageSize),
    },
  };
};

export const updateInventoryReorderLevel = async (
  user: IUser,
  sourceRfqItemId: string,
  reorderLevel: number,
  organizationId?: string
) => {
  const scope = getInventoryScope(user, organizationId);
  if (!Types.ObjectId.isValid(sourceRfqItemId)) throw new Error("Invalid product ID.");

  const source = await InventoryTransaction.findOne({
    ...scope,
    rfqItemId: sourceRfqItemId,
  }).sort({ postedAt: -1 });
  if (!source) throw new Error("Inventory product not found.");
  const sourceRfq = await RFQ.findOne({
    buyerOrganizationId: source.buyerOrganizationId,
    "items._id": source.rfqItemId,
  }).select("items");
  const sourceItem = sourceRfq?.items.find(
    (item) => item._id.toString() === source.rfqItemId.toString()
  );

  const product = await InventoryProduct.findOneAndUpdate(
    {
      buyerOrganizationId: source.buyerOrganizationId,
      sourceRfqItemId: source.rfqItemId,
    },
    {
      $set: { reorderLevel },
      $setOnInsert: {
        sku: `RFQ-${source.rfqItemId.toString().toUpperCase()}`,
        productName: source.productName,
        category: source.category || sourceItem?.category || "Uncategorized",
        unit: source.unit || sourceItem?.unit || "unit",
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return product;
};
