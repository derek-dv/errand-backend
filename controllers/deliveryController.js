const Delivery = require("../models/delivery");
const { routeTotals } = require("../services/maps");
const { computePrice } = require("../services/pricing");
const { createPaymentIntent } = require("../stripe");
const {
  notifyCustomer,
  broadcastDrivers,
} = require("../controllers/notificationController");

// ---------- 1) QUOTE ----------
exports.quote = async (req, res) => {
  try {
    const {
      pickupLocation,
      dropoffLocations,
      scheduledTime,
      packageSize,
      verifiedDelivery,
      priority,
    } = req.body;

    if (!pickupLocation || !dropoffLocations?.length || !packageSize) {
      return res
        .status(400)
        .json({ status: false, message: "Missing required fields" });
    }

    // distance + duration
    const { distanceKm, durationMin } = await routeTotals(
      pickupLocation,
      dropoffLocations
    );
    // price
    const { total, breakdown } = computePrice({
      distanceKm,
      scheduledAt: scheduledTime,
      durationMin,
      priority: !!priority,
      packageSize,
      verifiedDelivery: !!verifiedDelivery,
    });

    return res.status(200).json({
      status: true,
      quote: {
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMinutes: durationMin,
        price: total,
        breakdown,
      },
    });
  } catch (err) {
    console.error("Quote error:", err);
    return res
      .status(500)
      .json({ status: false, message: "Failed to create quote" });
  }
};

// ---------- 2) CREATE (with Stripe PaymentIntent; status: pending_payment) ----------
exports.create = async (req, res) => {
  try {
    const senderId = req.user.id;
    const {
      pickupLocation,
      dropoffLocations,
      receiverDetails,
      vehicleType,
      scheduledTime,
      packageSize,
      verifiedDelivery,
      priority,
    } = req.body;

    // basic validation
    if (
      !pickupLocation ||
      !dropoffLocations?.length ||
      !receiverDetails ||
      !packageSize ||
      !vehicleType
    ) {
      return res
        .status(400)
        .json({ status: false, message: "Missing required fields" });
    }
    if (receiverDetails.length !== dropoffLocations.length) {
      return res.status(400).json({
        status: false,
        message: "Each drop-off must have a matching receiver",
      });
    }

    // compute distance + duration
    const { distanceKm, durationMin } = await routeTotals(
      pickupLocation,
      dropoffLocations
    );

    // compute price
    const { total, breakdown } = computePrice({
      distanceKm,
      scheduledAt: scheduledTime,
      durationMin,
      priority: !!priority,
      packageSize,
      verifiedDelivery: !!verifiedDelivery,
    });

    // create stripe payment intent
    const { id: piId, clientSecret } = await createPaymentIntent({
      amountCAD: total,
      metadata: { senderId, type: "delivery" },
    });

    // persist delivery (pending_payment)
    const delivery = await Delivery.create({
      senderId,
      pickupLocation,
      dropoffLocations,
      receiverDetails,
      vehicleType,
      scheduledTime,
      packageSize,
      verifiedDelivery: !!verifiedDelivery,
      priority: !!priority,
      distanceKm: Number(distanceKm.toFixed(2)),
      estimatedDurationMinutes: durationMin,
      price: total,
      priceBreakdown: breakdown,
      status: "pending_payment",
      payment: {
        status: "requires_payment",
        stripePaymentIntentId: piId,
        stripeClientSecret: clientSecret,
      },
    });

    // notify customer (OneSignal)
    await notifyCustomer(
      senderId,
      "Delivery Created",
      "Your delivery request has been created. Please complete payment to proceed.",
      {
        type: "delivery_request",
        deliveryId: delivery._id,
        status: delivery.status,
        price: total,
        breakdown,
        clientSecret,
      }
    );

    return res.status(201).json({
      status: true,
      message: "Delivery created. Complete payment to proceed.",
      deliveryId: delivery._id,
      price: total,
      breakdown,
      stripeClientSecret: clientSecret,
    });
  } catch (err) {
    console.error("Create delivery error:", err);
    return res
      .status(500)
      .json({ status: false, message: "Server error", error: err.message });
  }
};

// ---------- 3) CONFIRM (called after webhook sets paid) ----------
exports.confirm = async (req, res) => {
  try {
    const { id } = req.params;
    const delivery = await Delivery.findById(id);
    if (!delivery)
      return res
        .status(404)
        .json({ status: false, message: "Delivery not found" });

    if (delivery.payment.status !== "paid") {
      return res
        .status(400)
        .json({ status: false, message: "Payment not completed yet" });
    }

    // set to upcoming and (if immediate) broadcast now
    delivery.status = "upcoming";
    await delivery.save();

    // If scheduled in future, actual broadcast will come from queue worker.
    if (
      !delivery.scheduledTime ||
      new Date(delivery.scheduledTime) <= new Date()
    ) {
      // immediate broadcast to drivers
      await broadcastDrivers(
        "New Delivery Available",
        "A customer has posted a new delivery request.",
        {
          type: "delivery_request",
          deliveryId: delivery._id,
          pickupLocation: delivery.pickupLocation,
          distanceKm: delivery.distanceKm,
          packageSize: delivery.packageSize,
          priority: delivery.priority,
          vehicleType: delivery.vehicleType,
        }
      );
      delivery.status = "broadcasted";
      await delivery.save();
    }

    // notify customer
    await notifyCustomer(
      delivery.senderId,
      "Delivery Confirmed",
      "Your delivery has been confirmed and is now visible to drivers.",
      {
        type: "delivery_update",
        deliveryId: delivery._id,
        status: delivery.status,
      }
    );

    return res
      .status(200)
      .json({ status: true, message: "Delivery confirmed", delivery });
  } catch (err) {
    console.error("Confirm delivery error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

// ---------- 4) MANUAL BROADCAST (optional admin/operator trigger) ----------
exports.broadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const delivery = await Delivery.findById(id);
    if (!delivery)
      return res
        .status(404)
        .json({ status: false, message: "Delivery not found" });
    if (delivery.payment.status !== "paid")
      return res
        .status(400)
        .json({ status: false, message: "Payment not completed" });

    await broadcastDrivers(
      "New Delivery Available",
      "A new delivery request is available for pickup.",
      {
        type: "delivery_request",
        deliveryId: delivery._id,
        pickupLocation: delivery.pickupLocation,
        distanceKm: delivery.distanceKm,
        packageSize: delivery.packageSize,
        priority: delivery.priority,
        vehicleType: delivery.vehicleType,
      }
    );

    delivery.status = "broadcasted";
    await delivery.save();

    return res.status(200).json({ status: true, message: "Broadcast sent" });
  } catch (err) {
    console.error("Broadcast error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

const haversine = require("haversine-distance");

exports.create = async (req, res) => {
  try {
    const senderId = req.user.id;

    const {
      pickupLocation,
      dropoffLocations, // array: max 2
      vehicleType,
      scheduledTime,
      receiverDetails, // array: max 2
    } = req.body;

    // Validate required fields
    if (
      !pickupLocation ||
      !dropoffLocations ||
      !vehicleType ||
      !receiverDetails
    ) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields",
      });
    }

    if (dropoffLocations.length < 1 || dropoffLocations.length > 2) {
      return res.status(400).json({
        status: false,
        message: "Must have 1 or 2 drop-off locations",
      });
    }

    if (receiverDetails.length !== dropoffLocations.length) {
      return res.status(400).json({
        status: false,
        message: "Each drop-off location must have a matching receiver",
      });
    }

    if (receiverDetails.length > 2) {
      return res.status(400).json({
        status: false,
        message: "Maximum 2 receivers allowed",
      });
    }

    // --- Pricing Logic ---
    const BASE_FARE = 2.5;
    const PER_KM_RATE = {
      scooter: 1.0,
      motorcycle: 1.5,
      car: 2.0,
    };
    const TIME_RATE_PER_MIN = 0.25;

    const vehicleRate = PER_KM_RATE[vehicleType];
    if (!vehicleRate) {
      return res.status(400).json({
        status: false,
        message: "Invalid vehicle type",
      });
    }

    // Calculate distance & duration
    let totalDistanceMeters = 0;
    let totalDurationMinutes = 0;

    let currentLocation = pickupLocation;

    for (const drop of dropoffLocations) {
      const distanceMeters = haversine(currentLocation, drop);
      totalDistanceMeters += distanceMeters;

      const distanceKm = distanceMeters / 1000;
      totalDurationMinutes += distanceKm * 2;

      currentLocation = drop;
    }

    const totalDistanceKm = totalDistanceMeters / 1000;

    // Final price
    const price =
      BASE_FARE +
      totalDistanceKm * vehicleRate +
      totalDurationMinutes * TIME_RATE_PER_MIN;

    const newDelivery = await Delivery.create({
      senderId,
      pickupLocation,
      dropoffLocations,
      vehicleType,
      scheduledTime,
      price: price.toFixed(2),
      status: "upcoming",
      receiverDetails,
    });

    return res.status(201).json({
      status: true,
      message: "Delivery created successfully",
      delivery: newDelivery,
    });
  } catch (error) {
    console.error("Create delivery error:", error);
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getOne = async (req, res) => {
  try {
    const deliveryId = req.params.id;

    const delivery = await Delivery.findById(deliveryId).populate(
      "senderId",
      "fullName email"
    );

    if (!delivery) {
      return res.status(404).json({
        status: false,
        message: "Delivery not found",
      });
    }

    res.status(200).json({
      status: true,
      delivery,
    });
  } catch (error) {
    console.error("Get delivery error:", error);
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getUpcoming = async (req, res) => {
  try {
    const senderId = req.user.id;

    const upcomingDeliveries = await Delivery.find({
      senderId,
      status: "upcoming",
    })
      .sort({ scheduledTime: 1 })
      .populate("senderId", "fullName email"); // Optional, only if you want sender info

    res.status(200).json({
      status: true,
      deliveries: upcomingDeliveries,
    });
  } catch (error) {
    console.error("Get upcoming deliveries error:", error);
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getPast = async (req, res) => {
  try {
    const userId = req.user.id;

    const deliveries = await Delivery.find({
      senderId: userId,
      status: "completed",
    }).sort({ scheduledTime: -1 });

    res.status(200).json({ status: true, deliveries });
  } catch (error) {
    console.error("Get past deliveries error:", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.cancel = async (req, res) => {
  try {
    const deliveryId = req.params.id;

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery) {
      return res.status(404).json({
        status: false,
        message: "Delivery not found",
      });
    }

    if (delivery.status === "cancelled") {
      return res.status(400).json({
        status: false,
        message: "Delivery is already cancelled",
      });
    }

    delivery.status = "cancelled";
    await delivery.save();

    res.status(200).json({
      status: true,
      message: "Delivery cancelled successfully",
      delivery,
    });
  } catch (error) {
    console.error("Cancel delivery error:", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.repeat = async (req, res) => {
  try {
    const userId = req.user.id;
    const originalDeliveryId = req.params.id;

    const original = await Delivery.findById(originalDeliveryId);
    if (!original) {
      return res.status(404).json({
        status: false,
        message: "Original delivery not found",
      });
    }

    const repeatedDelivery = await Delivery.create({
      senderId: userId,
      pickupLocation: original.pickupLocation,
      dropoffLocation: original.dropoffLocation,
      vehicleType: original.vehicleType,
      price: original.price,
      scheduledTime: new Date(), // Now
      status: "upcoming",
      receiverDetails: {
        name: original.receiverDetails.name,
        phoneNumber: original.receiverDetails.phoneNumber,
        note: original.receiverDetails.note || "",
      },
    });

    res.status(201).json({
      status: true,
      message: "Delivery repeated successfully",
      delivery: repeatedDelivery,
    });
  } catch (error) {
    console.error("Repeat delivery error:", error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.confirmLocation = async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { pickupLocation } = req.body;

    // Validate presence of pickupLocation with lat and lng
    if (
      !pickupLocation ||
      typeof pickupLocation.lat !== "number" ||
      typeof pickupLocation.lng !== "number"
    ) {
      return res.status(400).json({
        status: false,
        message:
          "pickupLocation (lat, lng) is required and must be valid numbers",
      });
    }

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({
        status: false,
        message: "Delivery not found",
      });
    }

    delivery.pickupLocation = pickupLocation;
    await delivery.save();

    res.status(200).json({
      status: true,
      message: "Pickup location confirmed successfully",
      delivery,
    });
  } catch (error) {
    console.error("Confirm location error:", error);
    res.status(500).json({
      status: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getOptions = async (req, res) => {
  try {
    // Example static options - later can come from DB or pricing service
    const options = [
      {
        type: "scooter",
        baseFare: 2.5,
        perKmRate: 0.6,
        estimatedTime: "10-15 mins",
      },
      {
        type: "motorcycle",
        baseFare: 5.0,
        perKmRate: 1.2,
        estimatedTime: "15-25 mins",
      },
      {
        type: "car",
        baseFare: 8.0,
        perKmRate: 1.8,
        estimatedTime: "25-35 mins",
      },
    ];

    res.status(200).json({
      status: true,
      message: "Available delivery options",
      options,
    });
  } catch (error) {
    console.error("Get options error:", error);
    res.status(500).json({
      status: false,
      message: "Failed to fetch delivery options",
      error: error.message,
    });
  }
};
