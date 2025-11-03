const SenderReceiver = require("../models/senderReceiver");
const GiftCard = require("../models/giftCard");

exports.getAll = async (req, res) => {
  try {
    const userId = req.user.id;
    await SenderReceiver.findById(userId)
      .populate("giftCards")
      .then((user) => {
        if (!user)
          return res
            .status(404)
            .json({ status: false, message: "User not found" });
        res.status(200).json({ status: true, giftCards: user.giftCards });
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.buy = async (req, res) => {
  try {
    const userId = req.user.id;

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid gift card amount" });
    }

    const code = `GC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const newCard = await GiftCard.create({
      code,
      balance: amount,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      redeemed: false,
      purchasedBy: userId,
    });

    res.status(201).json({
      status: true,
      message: "Gift card purchased",
      giftCard: newCard,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.redeem = async (req, res) => {
  try {
    const userId = req.user.id;

    const { code } = req.body;
    if (!code)
      return res
        .status(400)
        .json({ status: false, message: "Gift card code is required" });

    const giftCard = await GiftCard.findOne({ code, redeemed: false });
    if (!giftCard)
      return res.status(404).json({
        status: false,
        message: "Invalid or already redeemed gift card",
      });

    // Mark as redeemed
    giftCard.redeemed = true;
    await giftCard.save();

    // Add gift card to user's account
    const user = await SenderReceiver.findById(userId);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    user.giftCards.push(giftCard._id);
    await user.save();

    res
      .status(200)
      .json({ status: true, message: "Gift card redeemed", giftCard });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
