const { db, auth } = require("../config/firebase");

// In-memory fallback if Firestore is not yet configured
const memoryUsers = new Map();

// Register passenger (defaults to "pending" approval)
async function registerPassenger(req, res, next) {
  try {
    const { uid, name, email, phone, routeId } = req.body;

    if (!email || !name) {
      return res.status(400).json({ success: false, message: "Name and email are required." });
    }

    const userData = {
      name,
      email,
      phone: phone || "",
      role: "passenger",
      status: "pending",
      routeId: routeId || null,
      createdAt: new Date().toISOString(),
    };

    if (db) {
      const docId = uid || (auth ? (await auth.getUserByEmail(email)).uid : String(Date.now()));
      await db.collection("users").doc(docId).set(userData, { merge: true });
      return res.status(201).json({ success: true, message: "Passenger registered successfully. Pending admin approval.", data: { id: docId, ...userData } });
    } else {
      const docId = uid || "user_" + Date.now();
      memoryUsers.set(docId, userData);
      return res.status(201).json({ success: true, message: "[Memory Mode] Passenger registered. Pending admin approval.", data: { id: docId, ...userData } });
    }
  } catch (err) {
    next(err);
  }
}

// Admin creates driver
async function createDriver(req, res, next) {
  try {
    const { uid, name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: "Name and email are required." });
    }

    const driverData = {
      name,
      email,
      phone: phone || "",
      role: "driver",
      status: "approved",
      createdAt: new Date().toISOString(),
    };

    if (db) {
      const docId = uid || String(Date.now());
      await db.collection("users").doc(docId).set(driverData, { merge: true });
      return res.status(201).json({ success: true, message: "Driver account created.", data: { id: docId, ...driverData } });
    } else {
      const docId = uid || "driver_" + Date.now();
      memoryUsers.set(docId, driverData);
      return res.status(201).json({ success: true, message: "[Memory Mode] Driver created.", data: { id: docId, ...driverData } });
    }
  } catch (err) {
    next(err);
  }
}

// Get user profile by UID
async function getProfile(req, res, next) {
  try {
    const { uid } = req.params;

    if (db) {
      const doc = await db.collection("users").doc(uid).get();
      if (!doc.exists) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
      return res.json({ success: true, data: { id: doc.id, ...doc.data() } });
    } else {
      const user = memoryUsers.get(uid);
      if (!user) return res.status(404).json({ success: false, message: "User not found." });
      return res.json({ success: true, data: { id: uid, ...user } });
    }
  } catch (err) {
    next(err);
  }
}

// Update profile
async function updateProfile(req, res, next) {
  try {
    const { uid } = req.params;
    const updates = req.body;

    // Prevent direct tampering of role via regular update
    delete updates.role;

    if (db) {
      await db.collection("users").doc(uid).update(updates);
      const updated = await db.collection("users").doc(uid).get();
      return res.json({ success: true, message: "Profile updated.", data: { id: uid, ...updated.data() } });
    } else {
      const existing = memoryUsers.get(uid) || {};
      const updated = { ...existing, ...updates };
      memoryUsers.set(uid, updated);
      return res.json({ success: true, message: "Profile updated.", data: { id: uid, ...updated } });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerPassenger,
  createDriver,
  getProfile,
  updateProfile,
};
