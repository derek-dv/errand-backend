const express = require(`express`);
const cors = require(`cors`);
const morgan = require(`morgan`);
const authRoutes = require("./routes/authRoutes");
const userProfile = require("./routes/userProfileRoutes");
const security = require("./routes/securityRoutes");
const settings = require("./routes/settingsRoutes");
const deliveries = require("./routes/deliveriesRoutes");
const notifications = require("./routes/notificationsRoutes");
const wallet = require("./routes/walletRoutes");
const giftCards = require("./routes/giftCardsRoutes");
const errander = require(`./routes/erranderRoutes`);
const escrow = require("./routes/escrowRoutes");
const payments = require("./routes/paymentRoutes");
const chatRoutes = require("./routes/chatRoutes");
const authenticate = require(`./utils/jwt`).authenticate;

const app = express();

// Enable CORS globally
app.use(cors());
app.use(morgan(`dev`));

// JSON body parsing for all routes except Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === "/api/v1/payments/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});


app.get("/places/autocomplete", async (req, res) => {
  const q = req.query.q;
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=AIzaSyC_xipol58KPZZ0CRDrnCxOkkR19U8CX_M`
  );
  const data = await response.json();
  res.json(data);
});

app.get("/places/details", async (req, res) => {
  try {
    const placeId = req.query.place_id;
    if (!placeId) {
      return res.status(400).json({ error: "Missing 'place_id' parameter" });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      placeId
    )}&fields=formatted_address,geometry&key=AIzaSyC_xipol58KPZZ0CRDrnCxOkkR19U8CX_M`;

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error("Details proxy error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Routers
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", authenticate, userProfile);
app.use("/api/v1/security", authenticate, security);
app.use("/api/v1/settings", authenticate, settings);
app.use("/api/v1/deliveries", authenticate, deliveries);
app.use("/api/v1/notifications", authenticate, notifications);
app.use("/api/v1/wallet", authenticate, wallet);
app.use("/api/v1/gift-cards", authenticate, giftCards);
app.use("/api/v1/errander", authenticate, errander);
app.use("/api/v1/escrow", authenticate, escrow);
app.use("/api/v1/payments", payments);
app.use("/api/v1/chat", authenticate, chatRoutes);

module.exports = app;
