const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createPaymentIntent({ amountCAD, metadata }) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amountCAD * 100), // convert to cents
    currency: "cad",
    automatic_payment_methods: { enabled: true },
    metadata,
  });
  return { id: paymentIntent.id, clientSecret: paymentIntent.client_secret };
}

module.exports = { createPaymentIntent };

// // Load secret key from environment
// const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// module.exports = stripe;
