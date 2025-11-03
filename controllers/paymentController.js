const { createPaymentIntent } = require("../stripe");
const Delivery = require("../models/delivery");

exports.createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = "cad", deliveryId, senderId } = req.body;

    if (!amount || !deliveryId) {
      return res.status(400).json({ error: "Fill out required fields" });
    }

    const { id, clientSecret } = await createPaymentIntent({
      amountCAD: amount,
      currency,
      metadata: {
        deliveryId,
        senderId: senderId || "unknown",
      },
    });

    // Save payment info into Delivery
    await Delivery.findByIdAndUpdate(deliveryId, {
      "payment.stripePaymentIntentId": id,
      "payment.stripeClientSecret": clientSecret,
      "payment.status": "requires_payment",
    });

    return res.status(201).json({ id, clientSecret });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        console.log("✅ Payment succeeded:", pi.id);

        // Update delivery as paid
        await Delivery.findOneAndUpdate(
          { "payment.stripePaymentIntentId": pi.id },
          { "payment.status": "paid", status: "upcoming" }
        );
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        console.log("❌ Payment failed:", pi.id);
        await Delivery.findOneAndUpdate(
          { "payment.stripePaymentIntentId": pi.id },
          { "payment.status": "failed" }
        );
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: err.message });
  }
};
