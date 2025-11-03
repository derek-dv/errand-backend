const Delivery = require("../models/delivery");

exports.initiateEscrow = async (req, res) => {
  try {
    const { deliveryId, itemDescription } = req.body;
    if (!deliveryId || !itemDescription) {
      return res.status(400).json({
        status: false,
        message: "Delivery ID and item details are required",
      });
    }

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res
        .status(404)
        .json({ status: false, message: "Delivery not found" });
    }

    delivery.escrow = {
      active: true,
      itemDescription,
      status: "pending_verification",
      fee: 5.0, // Flat escrow fee, or calculate dynamically
    };
    delivery.totalCost += delivery.escrow.fee;
    await delivery.save();

    res
      .status(200)
      .json({ status: true, message: "Escrow service added", delivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.updateEscrowStatus = async (req, res) => {
  try {
    const { deliveryId, status } = req.body;

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery || !delivery.escrow?.active) {
      return res.status(404).json({
        status: false,
        message: "Active escrow not found for this delivery",
      });
    }

    delivery.escrow.status = status;
    await delivery.save();

    res.status(200).json({
      status: true,
      message: `Escrow status updated to ${status}`,
      delivery,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
