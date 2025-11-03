const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SenderReceiver", // The recipient of the notification
      required: true,
    },
    type: {
      type: String,
      enum: [
        "delivery_request", // New delivery request
        "delivery_update", // Status change (e.g., driver accepted, out for delivery)
        "payment", // Payment received, refund, etc.
        "promotion", // Coupons, offers
        "system", // App/system updates
      ],
      required: true,
    },
    title: { type: String, required: true }, // Short notification heading
    message: { type: String, required: true }, // Detailed description
    data: {
      deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: "Delivery" },
      deepLink: { type: String },
      extra: { type: Object, default: {} }, // free-form extra payload
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
