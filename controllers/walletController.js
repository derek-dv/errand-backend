const Wallet = require("../models/wallet");
const SenderReceiver = require("../models/senderReceiver");

exports.getWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    const wallet = await Wallet.findOne({ owner: userId });
    if (!wallet) {
      return res
        .status(404)
        .json({ status: false, message: "Wallet not found" });
    }

    res.status(200).json({
      status: true,
      balance: wallet.balance,
      transactionHistory: wallet.transactionHistory,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.topUp = async (req, res) => {
  try {
    const userId = req.user.id;

    const { amount, method, description } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({ status: false, message: "Valid top-up amount is required" });
    }

    const user = await SenderReceiver.findById(userId).populate("wallet");
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    let wallet;

    if (!user.wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: amount,
        transactions: [
          {
            type: "credit",
            amount,
            description: description || "Wallet top-up",
            date: new Date(),
          },
        ],
      });
      user.wallet = wallet._id;
      await user.save();
    } else {
      wallet = user.wallet;
      wallet.balance += amount;
      wallet.transactions.push({
        type: "credit",
        amount,
        description: description || "Wallet top-up",
        date: new Date(),
      });
      await wallet.save();
    }

    res
      .status(200)
      .json({ status: true, message: "Wallet topped up successfully", wallet });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.toggleRefill = async (req, res) => {
  try {
    const userId = req.user.id;

    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        status: false,
        message: "Invalid value for 'enabled'. Must be true or false.",
      });
    }

    const wallet = await Wallet.findOneAndUpdate(
      { user: userId },
      { $set: { autoRefill: enabled } },
      { new: true }
    );

    if (!wallet) {
      return res
        .status(404)
        .json({ status: false, message: "Wallet not found" });
    }

    res.status(200).json({
      status: true,
      message: `Auto-refill ${enabled ? "enabled" : "disabled"}`,
      wallet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getMethods = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await SenderReceiver.findById(userId).populate(
      "paymentDetails"
    );
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    res.status(200).json({ status: true, paymentMethods: user.paymentDetails });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.addMethod = async (req, res) => {
  try {
    const userId = req.user.id;

    const { cardNumber, expiryDate, cardHolder, brand, last4 } = req.body;
    if (!cardNumber || !expiryDate || !cardHolder || !brand || !last4) {
      return res.status(400).json({
        status: false,
        message: "Missing required payment method fields.",
      });
    }

    const user = await SenderReceiver.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const newMethod = { cardNumber, expiryDate, cardHolder, brand, last4 };
    user.paymentDetails.push(newMethod);
    await user.save();

    res.status(200).json({
      status: true,
      message: "Payment method added",
      paymentMethods: user.paymentDetails,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.removeMethod = async (req, res) => {
  try {
    const userId = req.user.id;
    const methodId = req.params.id;

    const user = await SenderReceiver.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    user.paymentDetails = user.paymentDetails.filter(
      (method) => method._id.toString() !== methodId
    );
    await user.save();

    res.status(200).json({
      status: true,
      message: "Payment method removed",
      paymentDetails: user.paymentDetails,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
