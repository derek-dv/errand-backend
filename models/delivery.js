const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const receiverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    note: { type: String },
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SenderReceiver",
      required: true,
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver", // better to keep separate Driver model
      default: null,
    },

    pickupLocation: { type: locationSchema, required: true },

    dropoffLocations: {
      type: [locationSchema],
      validate: [
        (val) => val.length >= 1 && val.length <= 2,
        "Must have 1 or 2 drop-off locations",
      ],
      required: true,
    },

    receiverDetails: {
      type: [receiverSchema],
      validate: [
        (val) => val.length >= 1 && val.length <= 2,
        "Must have 1 or 2 receivers",
      ],
      required: true,
    },

    vehicleType: {
      type: String,
      enum: ["scooter", "motorcycle", "car", "van"],
      required: true,
    },

    packageSize: {
      type: String,
      enum: ["small", "medium", "heavy", "extra-heavy"],
      required: true,
    },

    verifiedDelivery: { type: Boolean, default: false },
    priority: { type: Boolean, default: false },

    scheduledTime: { type: Date, default: Date.now },

    distanceKm: { type: Number },
    estimatedDurationMinutes: { type: Number },

    // pricing
    price: { type: Number, required: true },
    priceBreakdown: {
      base: Number,
      distanceAddOn: Number,
      rushHourSurcharge: Number,
      nightSurcharge: Number,
      longDeliveryFlat: Number,
      priorityMultiplierApplied: Boolean,
      sizeAddOn: Number,
      verifiedAddOn: Number,
      subtotalBeforeMultipliers: Number,
      total: Number,
    },

    // escrow (verified delivery add-on)
    escrow: {
      active: { type: Boolean, default: false },
      itemDescription: String,
      status: {
        type: String,
        enum: ["pending_verification", "approved", "rejected"],
        default: "pending_verification",
      },
      fee: { type: Number, default: 0 },
    },

    // payment tracking
    payment: {
      status: {
        type: String,
        enum: ["none", "requires_payment", "paid", "failed", "refunded"],
        default: "requires_payment",
      },
      stripePaymentIntentId: String,
      stripeClientSecret: String,
    },

    status: {
      type: String,
      enum: [
        "pending_payment",
        "upcoming",
        "broadcasted",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "pending_payment",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Delivery", deliverySchema);
