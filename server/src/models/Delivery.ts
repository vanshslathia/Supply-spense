
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
  unit: string;
}

// ==========================================
// DELIVERY STATUS HISTORY
// ==========================================

export interface IDeliveryStatusHistory {
  status: DeliveryStatus;
  updatedBy: Types.ObjectId;
  role: "supplier" | "procurement";
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

  purchaseOrderId: Types.ObjectId;
  supplierId: Types.ObjectId;
  buyerOrganizationId: Types.ObjectId;

  items: IDeliveryItem[];

  trackingNumber?: string;
  transporterName?: string;
  vehicleNumber?: string;

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

  // Receiving audit history
  receivingHistory: IReceivingHistory[];

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
        enum: ["supplier", "procurement"],
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
