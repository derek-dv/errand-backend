const express = require(`express`);
const router = express.Router();
const notificationController = require(`../controllers/notificationController`);

// Save OneSignal playerId after login
router.post("/register-device", notificationController.registerDevice);

// router.get("/", notificationController.getUserNotifications);
// router.post("/", notificationController.sendNotification);
// router.patch("/:notificationId/read", notificationController.markAsRead);

module.exports = router;
