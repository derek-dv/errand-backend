function inRushHour(date) {
  const h = date.getHours();
  const isWeekday = [1, 2, 3, 4, 5].includes(date.getDay());
  return isWeekday && ((h >= 7 && h < 9) || (h >= 16 && h < 19));
}
function inNight(date) {
  const h = date.getHours();
  return h >= 21 || h < 7;
}

function computePrice({
  distanceKm,
  scheduledAt,
  durationMin,
  priority,
  packageSize,
  verifiedDelivery,
}) {
  const BASE = 8.0;
  const DIST_RATE = 1.25;

  const when = scheduledAt ? new Date(scheduledAt) : new Date();

  // 1) base + distance
  let basePart = BASE;
  const distanceAddOn = Math.max(0, distanceKm - 3) * DIST_RATE;

  // 2) surcharges (percent) and long-delivery flat
  let rushSurcharge = 0,
    nightSurcharge = 0,
    longFlat = 0;
  let subtotal = basePart + distanceAddOn;

  if (inRushHour(when)) {
    rushSurcharge = subtotal * 0.2;
    subtotal += rushSurcharge;
  } else if (inNight(when)) {
    nightSurcharge = subtotal * 0.15;
    subtotal += nightSurcharge;
  }

  if (durationMin > 45) {
    longFlat = 2;
    subtotal += longFlat;
  }

  // 3) priority multiplier
  let priorityMultiplierApplied = false;
  if (priority) {
    subtotal *= 1.3;
    priorityMultiplierApplied = true;
  }

  // 4) size add-on
  let sizeAddOn = 0;
  switch ((packageSize || "").toLowerCase()) {
    case "small":
      sizeAddOn = 0;
      break;
    case "medium":
      sizeAddOn = 2;
      break;
    case "heavy":
      sizeAddOn = 7;
      break;
    case "extra-heavy":
      sizeAddOn = distanceKm <= 4 ? 10 : 15;
      break;
    default:
      throw new Error("Invalid package size");
  }
  subtotal += sizeAddOn;

  // 5) verified delivery add-on
  let verifiedAddOn = 0;
  if (verifiedDelivery) {
    if (["small", "medium"].includes(packageSize)) verifiedAddOn = 5;
    else if (packageSize === "heavy") verifiedAddOn = 7;
    else if (packageSize === "extra-heavy") verifiedAddOn = 10;
  }
  subtotal += verifiedAddOn;

  const total = Number(subtotal.toFixed(2));

  return {
    total,
    breakdown: {
      base: BASE,
      distanceAddOn: Number(distanceAddOn.toFixed(2)),
      rushHourSurcharge: Number(rushSurcharge.toFixed(2)),
      nightSurcharge: Number(nightSurcharge.toFixed(2)),
      longDeliveryFlat: longFlat,
      priorityMultiplierApplied,
      sizeAddOn,
      verifiedAddOn,
      subtotalBeforeMultipliers: Number((BASE + distanceAddOn).toFixed(2)),
      total,
    },
  };
}

module.exports = { computePrice };
