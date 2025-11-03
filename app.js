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
