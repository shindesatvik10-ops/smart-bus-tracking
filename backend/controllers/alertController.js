const { db } = require("../config/firebase");

// Create alert / notification
async function createAlert(req, res, next) {
  try {
    const { type, message, busId, routeId, driverUid } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Alert message is required." });
    }

    const alertData = {
      type: type || "info", // "delay", "emergency", "breakdown", "info"
      message,
      busId: busId || null,
      routeId: routeId || null,
      driverUid: driverUid || null,
      createdAt: new Date().toISOString(),
    };

    let alertId = "alert_" + Date.now();

    if (db) {
      const ref = await db.collection("alerts").add(alertData);
      alertId = ref.id;
    }

    if (req.io) {
      req.io.emit("bus-alert", { id: alertId, ...alertData });
    }

    return res.status(201).json({ success: true, message: "Alert broadcasted.", data: { id: alertId, ...alertData } });
  } catch (err) {
    next(err);
  }
}

// Get recent alerts
async function getAlerts(req, res, next) {
  try {
    const { limit } = req.query;

    if (db) {
      const snap = await db.collection("alerts").orderBy("createdAt", "desc").limit(Number(limit) || 20).get();
      const alerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.json({ success: true, count: alerts.length, data: alerts });
    } else {
      return res.json({ success: true, count: 0, data: [] });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAlert,
  getAlerts,
};
