const { db } = require("../config/firebase");

// Start a new trip
async function startTrip(req, res, next) {
  try {
    const { driverUid, busId, routeId } = req.body;

    if (!driverUid || !busId) {
      return res.status(400).json({ success: false, message: "driverUid and busId are required." });
    }

    const tripData = {
      driverUid,
      busId,
      routeId: routeId || null,
      startTime: new Date().toISOString(),
      endTime: null,
      status: "in-progress",
      createdAt: new Date().toISOString(),
    };

    let tripId = "trip_" + Date.now();

    if (db) {
      const docRef = await db.collection("trips").add(tripData);
      tripId = docRef.id;

      // Enable location sharing flag on bus
      await db.collection("buses").doc(busId).update({
        isSharingLocation: true,
      });
    }

    // Broadcast trip started to Socket.io
    if (req.io) {
      req.io.emit("trip-started", { tripId, ...tripData });
    }

    return res.status(201).json({ success: true, message: "Trip started.", data: { id: tripId, ...tripData } });
  } catch (err) {
    next(err);
  }
}

// End a trip
async function endTrip(req, res, next) {
  try {
    const { id } = req.params;
    const { busId } = req.body;

    const updateData = {
      endTime: new Date().toISOString(),
      status: "completed",
    };

    if (db) {
      await db.collection("trips").doc(id).update(updateData);

      // Disable location sharing flag on bus if provided
      if (busId) {
        await db.collection("buses").doc(busId).update({
          isSharingLocation: false,
        });
      }
    }

    if (req.io) {
      req.io.emit("trip-ended", { tripId: id, busId });
    }

    return res.json({ success: true, message: "Trip ended.", data: { id, ...updateData } });
  } catch (err) {
    next(err);
  }
}

// Get trips
async function getTrips(req, res, next) {
  try {
    const { driverUid, busId, limit } = req.query;

    if (db) {
      let query = db.collection("trips");
      if (driverUid) query = query.where("driverUid", "==", driverUid);
      if (busId) query = query.where("busId", "==", busId);

      const snap = await query.limit(Number(limit) || 50).get();
      const trips = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json({ success: true, count: trips.length, data: trips });
    } else {
      return res.json({ success: true, count: 0, data: [] });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startTrip,
  endTrip,
  getTrips,
};
