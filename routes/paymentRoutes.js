const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const authenticate = require(`../utils/jwt`).authenticate;

// Create Payment Intent
router.post(
  "/create-payment-intent",
  authenticate,
  paymentController.createPaymentIntent
);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // raw body required
  paymentController.handleWebhook
);

module.exports = router;
