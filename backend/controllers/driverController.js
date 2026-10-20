const { db, auth } = require("../config/firebase");

// Get all drivers
async function getAllDrivers(req, res, next) {
  try {
    if (db) {
      const snap = await db.collection("users").where("role", "==", "driver").get();
      const drivers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json({ success: true, count: drivers.length, data: drivers });
    } else {
      return res.json({ success: true, count: 0, data: [] });
    }
  } catch (err) {
    next(err);
  }
}

// Get bus assigned to driver
async function getDriverBus(req, res, next) {
  try {
    const { driverUid } = req.params;

    if (db) {
      const snap = await db.collection("buses").where("assignedDriverId", "==", driverUid).limit(1).get();
      if (snap.empty) {
        return res.status(404).json({ success: false, message: "No bus currently assigned to this driver." });
      }
      const busDoc = snap.docs[0];
      return res.json({ success: true, data: { id: busDoc.id, ...busDoc.data() } });
    } else {
      return res.status(404).json({ success: false, message: "No bus assigned (Memory Mode)." });
    }
  } catch (err) {
    next(err);
  }
}

// Update driver (details and/or password)
async function updateDriver(req, res, next) {
  try {
    const { id } = req.params;
    const { name, phone, address, email, password } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (email) updates.email = email;
    if (password) {
      updates.password = password;
      updates.tempPassword = password;
    }

    if (db) {
      await db.collection("users").doc(id).set(updates, { merge: true });
    }

    if (auth) {
      const authUpdates = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (name) authUpdates.displayName = name;

      try {
        await auth.updateUser(id, authUpdates);
      } catch (authErr) {
        console.warn("Firebase Admin Auth update notice:", authErr.message);
      }
    }

    return res.json({ success: true, message: "Driver updated successfully.", data: { id, ...updates } });
  } catch (err) {
    next(err);
  }
}

// Delete driver
async function deleteDriver(req, res, next) {
  try {
    const { id } = req.params;

    if (db) {
      const batch = db.batch();
      // Unassign driver from any buses
      const buses = await db.collection("buses").where("assignedDriverId", "==", id).get();
      buses.forEach((doc) => {
        batch.update(doc.ref, { assignedDriverId: null, isSharingLocation: false });
      });
      // Delete user
      batch.delete(db.collection("users").doc(id));
      await batch.commit();
    }

    return res.json({ success: true, message: "Driver removed successfully." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllDrivers,
  getDriverBus,
  updateDriver,
  deleteDriver,
};
