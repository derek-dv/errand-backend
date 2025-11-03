const Notification = require("../models/notification");
const User = require("../models/senderReceiver");
const OneSignal = require("@onesignal/node-onesignal");

// OneSignal setup
const configuration = OneSignal.createConfiguration({
  appKey: process.env.ONESIGNAL_REST_API_KEY,
});
const onesignalClient = new OneSignal.DefaultApi(configuration);
const APP_ID = process.env.ONESIGNAL_APP_ID;

/**
 * Register a device (OneSignal playerId)
 */
exports.registerDevice = async (req, res) => {
  try {
    const { playerId } = req.body;
    const userId = req.user._id;

    if (!playerId) {
      return res.status(400).json({ message: "playerId is required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { oneSignalPlayerId: playerId },
      { new: true }
    ).select("fullName email oneSignalPlayerId role");

    res.status(200).json({
      message: "Device registered successfully",
      user,
    });
  } catch (error) {
    console.error("Register device error:", error);
    res.status(500).json({ message: "Failed to register device" });
  }
};

/**
 * Internal helper: send OneSignal notification
 */
async function sendOneSignal(
  playerIds,
  title,
  message,
  data = {},
  filters = null
) {
  const notification = new OneSignal.Notification();
  notification.app_id = APP_ID;
  if (filters) {
    notification.filters = filters; // e.g., tag-based targeting
  } else {
    notification.include_player_ids = playerIds;
  }
  notification.headings = { en: title };
  notification.contents = { en: message };
  notification.data = data;

  return onesignalClient.createNotification(notification);
}

/**
 * Send notification to a specific user
 */
exports.notifyCustomer = async (userId, title, message, data = {}) => {
  try {
    const user = await User.findById(userId).select("oneSignalPlayerId");
    if (!user?.oneSignalPlayerId) {
      console.warn("⚠️ No OneSignal playerId for user:", userId);
      return;
    }

    // Save notification in DB
    await Notification.create({
      user: userId,
      type: data.type || "system",
      title,
      message,
      data,
    });

    await sendOneSignal([user.oneSignalPlayerId], title, message, data);
    console.log(`📲 Notified customer ${userId}`);
  } catch (err) {
    console.error("notifyCustomer error:", err.message);
  }
};

/**
 * Broadcast notification to all drivers
 */
exports.broadcastDrivers = async (
  title,
  message,
  data = {},
  { useSegments = true } = {}
) => {
  try {
    if (useSegments) {
      // Recommended: tag drivers in OneSignal as { role: "driver" }
      await sendOneSignal([], title, message, data, [
        { field: "tag", key: "role", relation: "=", value: "driver" },
      ]);
      console.log("📲 Broadcast sent to drivers (segment)");
    } else {
      // DB fallback: fetch all driver playerIds
      const drivers = await User.find({
        role: "driver",
        oneSignalPlayerId: { $exists: true },
      }).select("oneSignalPlayerId");

      if (drivers.length > 0) {
        await sendOneSignal(
          drivers.map((d) => d.oneSignalPlayerId),
          title,
          message,
          data
        );
        console.log(`📲 Broadcast sent to ${drivers.length} drivers`);
      }
    }
  } catch (err) {
    console.error("broadcastDrivers error:", err.message);
  }
};

/**
 * Controller for generic notification (for API testing)
 */
exports.sendNotification = async (req, res) => {
  try {
    const { type, title, message, data, targetUserId, targetRole } = req.body;

    if (targetUserId) {
      await exports.notifyCustomer(targetUserId, title, message, {
        ...data,
        type,
      });
    } else if (targetRole === "drivers") {
      await exports.broadcastDrivers(title, message, { ...data, type });
    } else {
      return res
        .status(400)
        .json({ message: "Must provide targetUserId or targetRole" });
    }

    res.status(201).json({ message: "Notification sent successfully" });
  } catch (error) {
    console.error("sendNotification error:", error.message);
    res.status(500).json({ message: "Failed to send notification", error });
  }
};

/**
 * Get all notifications for logged-in user
 */
// exports.getUserNotifications = async (req, res) => {
//   try {
//     const userId = req.user._id;

//     const notifications = await Notification.find({ user: userId }).sort({
//       createdAt: -1,
//     });

//     res.json(notifications);
//   } catch (error) {
//     res.status(500).json({ message: "Failed to get notifications", error });
//   }
// };

// /**
//  * Mark notification as read
//  */
// exports.markAsRead = async (req, res) => {
//   try {
//     const { notificationId } = req.params;

//     const notification = await Notification.findByIdAndUpdate(
//       notificationId,
//       { isRead: true },
//       { new: true }
//     );

//     if (!notification) {
//       return res.status(404).json({ message: "Notification not found" });
//     }

//     res.json({ message: "Notification marked as read", notification });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Failed to mark notification as read", error });
//   }
// };
