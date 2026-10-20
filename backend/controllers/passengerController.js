const { db } = require("../config/firebase");

// Get all passengers (can filter by ?status=pending|approved)
async function getAllPassengers(req, res, next) {
  try {
    const { status } = req.query;

    if (db) {
      let query = db.collection("users").where("role", "==", "passenger");
      if (status) {
        query = query.where("status", "==", status);
      }
      const snap = await query.get();
      const passengers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json({ success: true, count: passengers.length, data: passengers });
    } else {
      return res.json({ success: true, count: 0, data: [] });
    }
  } catch (err) {
    next(err);
  }
}

// Approve or reject passenger
async function updatePassengerStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'approved', 'rejected', or 'pending'." });
    }

    if (db) {
      await db.collection("users").doc(id).update({ status });
      return res.json({ success: true, message: `Passenger status set to ${status}.` });
    } else {
      return res.json({ success: true, message: `[Memory Mode] Status set to ${status}.` });
    }
  } catch (err) {
    next(err);
  }
}

// Assign route or stop
async function assignRoute(req, res, next) {
  try {
    const { id } = req.params;
    const { routeId, stopName } = req.body;

    if (db) {
      await db.collection("users").doc(id).update({
        routeId: routeId || null,
        ...(stopName && { stopName }),
      });
      return res.json({ success: true, message: "Passenger route assignment updated." });
    } else {
      return res.json({ success: true, message: "[Memory Mode] Passenger route assignment updated." });
    }
  } catch (err) {
    next(err);
  }
}

// Delete passenger
async function deletePassenger(req, res, next) {
  try {
    const { id } = req.params;

    if (db) {
      await db.collection("users").doc(id).delete();
    }

    return res.json({ success: true, message: "Passenger deleted successfully." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllPassengers,
  updatePassengerStatus,
  assignRoute,
  deletePassenger,
};
