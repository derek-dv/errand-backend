const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      enum: ["en", "fr", "es", "de", "zh"],
      default: "en",
    },
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "light",
    },
    notificationsEnabled: {
      type: Boolean,
      default: true,
    },
    notificationPreferences: {
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
