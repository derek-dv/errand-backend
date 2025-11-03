const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtpAndLogin);
router.post("/google", authController.loginWithGoogle);
router.post("/apple", authController.loginWithApple);

module.exports = router;
