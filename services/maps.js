const axios = require("axios");

function isValidCoord({ lat, lng }) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

async function legDistanceDuration(origin, dest) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${dest.lat},${dest.lng}&key=${key}`;
  const { data } = await axios.get(url);
  const el = data?.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK") throw new Error("Maps distance lookup failed");
  return { meters: el.distance.value, seconds: el.duration.value };
}

async function routeTotals(
  pickup,
  dropoffs,
  { useMock = process.env.NODE_ENV !== "production" } = {}
) {
  if (!isValidCoord(pickup)) throw new Error("Invalid pickup coords");
  for (const d of dropoffs)
    if (!isValidCoord(d)) throw new Error("Invalid dropoff coords");

  if (useMock) {
    // simple deterministic mock for dev
    const legs = dropoffs.length;
    const meters = 4000 * legs; // 4km per leg
    const seconds = 12 * 60 * legs; // 12min per leg
    return { distanceKm: meters / 1000, durationMin: Math.round(seconds / 60) };
  }

  let meters = 0,
    seconds = 0,
    cur = pickup;
  for (const d of dropoffs) {
    const r = await legDistanceDuration(cur, d);
    meters += r.meters;
    seconds += r.seconds;
    cur = d;
  }
  return { distanceKm: meters / 1000, durationMin: Math.round(seconds / 60) };
}

module.exports = { routeTotals };
