
import mongoose, { Schema, Document, Types } from "mongoose";

// ==========================================
// DELIVERY STATUS
// ==========================================

export type DeliveryStatus =
  | "planned"
  | "dispatched"
  | "in_transit"
  | "partially_delivered"
  | "delivered"
  | "delayed"
  | "cancelled";

// Physical goods receiving status
export type ReceivingStatus =
  | "pending"
  | "arrived"
  | "receiving_in_progress"
  | "received"
  | "submitted_for_qc";

// ==========================================
// DELIVERY ITEM
// ==========================================

export interface IDeliveryItem {
  rfqItemId: Types.ObjectId;
  productName: string;
  orderedQuantity: number;
  dispatchedQuantity: number;
  deliveredQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  acceptedForQcQuantity: number;
  unit: string;
}

export interface IWarehouseReceiptItem {
  rfqItemId: Types.ObjectId;
  receivedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  acceptedForQcQuantity: number;
}

export interface IWarehouseReceiptHistory {
  items: IWarehouseReceiptItem[];
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  notes?: string;
}

// ==========================================
// DELIVERY STATUS HISTORY
// ==========================================

export interface IDeliveryStatusHistory {
  status: DeliveryStatus;
  updatedBy: Types.ObjectId;
  role: "supplier" | "procurement" | "warehouse";
  note?: string;
  changedAt: Date;
}

// ==========================================
// WAREHOUSE RECEIVING HISTORY
// ==========================================

export interface IReceivingHistory {
  status: ReceivingStatus;
  updatedBy: Types.ObjectId;
  role: "warehouse" | "procurement";
  note?: string;
  changedAt: Date;
}

// ==========================================
// DELIVERY INTERFACE
// ==========================================

export interface IDelivery extends Document {
  deliveryNumber: string;
  idempotencyKey?: string;

  purchaseOrderId: Types.ObjectId;
  supplierId: Types.ObjectId;
  buyerOrganizationId: Types.ObjectId;

  items: IDeliveryItem[];

  trackingNumber?: string;
  transporterName?: string;
  vehicleNumber?: string;
  challanNumber?: string;
  challanUrl?: string;

  deliveryAddress: string;
  expectedDeliveryDate: Date;
  dispatchedAt?: Date;
  deliveredAt?: Date;

  status: DeliveryStatus;

  // Physical receiving information
  receivingStatus: ReceivingStatus;
  arrivalAt?: Date;
  receivedAt?: Date;
  receivedBy?: Types.ObjectId;
  receivingNotes?: string;
  receivingClosed: boolean;
  arrivalRecordedBy?: Types.ObjectId;
  arrivalChallanNumber?: string;
  packagingCondition?: "intact" | "damaged" | "unknown";
  sealCondition?: "intact" | "damaged" | "missing" | "unknown";
  arrivalRemarks?: string;

  // Receiving audit history
  receivingHistory: IReceivingHistory[];
  warehouseReceipts: IWarehouseReceiptHistory[];

  // Shipment status audit history
  statusHistory: IDeliveryStatusHistory[];

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// DELIVERY ITEM SCHEMA
// ==========================================

const deliveryItemSchema = new Schema<IDeliveryItem>(
  {
    rfqItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    orderedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },

    dispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveredQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    damagedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    missingQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    acceptedForQcQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

// ==========================================
// DELIVERY STATUS HISTORY SCHEMA
// ==========================================

const deliveryStatusHistorySchema =
  new Schema<IDeliveryStatusHistory>(
    {
      status: {
        type: String,
        enum: [
          "planned",
          "dispatched",
          "in_transit",
          "partially_delivered",
          "delivered",
          "delayed",
          "cancelled",
        ],
        required: true,
      },

      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      role: {
        type: String,
        enum: ["supplier", "procurement", "warehouse"],
        required: true,
      },

      note: {
        type: String,
        trim: true,
        maxlength: 2000,
      },

      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
    { _id: false }
  );

  const warehouseReceiptItemSchema = new Schema<IWarehouseReceiptItem>(
    {
      rfqItemId: {
        type: Schema.Types.ObjectId,
        required: true,
      },
      receivedQuantity: {
        type: Number,
        required: true,
        min: 0,
      },
      damagedQuantity: {
        type: Number,
        required: true,
        min: 0,
      },
      missingQuantity: {
        type: Number,
        required: true,
        min: 0,
      },
      acceptedForQcQuantity: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    { _id: false }
  );

  const warehouseReceiptHistorySchema =
    new Schema<IWarehouseReceiptHistory>(
      {
        items: {
          type: [warehouseReceiptItemSchema],
          required: true,
        },
        recordedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        recordedAt: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          trim: true,
          maxlength: 2000,
        },
      },
      { _id: false }
    );

// ==========================================
// RECEIVING HISTORY SCHEMA
// ==========================================

const receivingHistorySchema =
  new Schema<IReceivingHistory>(
    {
      status: {
        type: String,
        enum: [
          "pending",
          "arrived",
          "receiving_in_progress",
          "received",
          "submitted_for_qc",
        ],
        required: true,
      },

      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      role: {
        type: String,
        enum: ["warehouse", "procurement"],
        required: true,
      },

      note: {
        type: String,
        trim: true,
        maxlength: 2000,
      },

      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
    { _id: false }
  );

// ==========================================
// DELIVERY SCHEMA
// ==========================================

const deliverySchema = new Schema<IDelivery>(
  {
    deliveryNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      index: true,
    },

    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    buyerOrganizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    items: {
      type: [deliveryItemSchema],
      required: true,
      validate: {
        validator: (items: IDeliveryItem[]) =>
          items.length > 0,
        message: "At least one delivery item is required.",
      },
    },

    trackingNumber: {
      type: String,
      trim: true,
    },

    transporterName: {
      type: String,
      trim: true,
    },

    vehicleNumber: {
      type: String,
      trim: true,
    },

    challanNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    challanUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
    },

    deliveryAddress: {
      type: String,
      required: true,
      trim: true,
    },

    expectedDeliveryDate: {
      type: Date,
      required: true,
    },

    dispatchedAt: {
      type: Date,
    },

    deliveredAt: {
      type: Date,
    },

    // Existing supplier shipment status
    status: {
      type: String,
      enum: [
        "planned",
        "dispatched",
        "in_transit",
        "partially_delivered",
        "delivered",
        "delayed",
        "cancelled",
      ],
      default: "planned",
      index: true,
    },

    // ======================================
    // WAREHOUSE RECEIVING FIELDS
    // ======================================

    receivingStatus: {
      type: String,
      enum: [
        "pending",
        "arrived",
        "receiving_in_progress",
        "received",
        "submitted_for_qc",
      ],
      default: "pending",
      index: true,
    },

    arrivalAt: {
      type: Date,
    },

    receivedAt: {
      type: Date,
    },

    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    receivingClosed: {
      type: Boolean,
      default: false,
    },

    arrivalRecordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    arrivalChallanNumber: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    packagingCondition: {
      type: String,
      enum: ["intact", "damaged", "unknown"],
    },

    sealCondition: {
      type: String,
      enum: ["intact", "damaged", "missing", "unknown"],
    },

    arrivalRemarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    receivingNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    // Warehouse receiving audit history
    receivingHistory: {
      type: [receivingHistorySchema],
      default: [],
    },

    warehouseReceipts: {
      type: [warehouseReceiptHistorySchema],
      default: [],
    },

    // Existing shipment status history
    statusHistory: {
      type: [deliveryStatusHistorySchema],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// INDEXES
// ==========================================

// Supplier delivery queries
deliverySchema.index({
  supplierId: 1,
  createdAt: -1,
});

deliverySchema.index(
  { supplierId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

// Buyer organization delivery queries
deliverySchema.index({
  buyerOrganizationId: 1,
  createdAt: -1,
});

// Warehouse receiving queries
deliverySchema.index({
  buyerOrganizationId: 1,
  receivingStatus: 1,
  createdAt: -1,
});

// ==========================================
// MODEL
// ==========================================

const Delivery = mongoose.model<IDelivery>(
  "Delivery",
  deliverySchema
);

export default Delivery;
