const { db } = require("../config/firebase");

const memoryRoutes = new Map([
  [
    "route-1",
    {
      routeName: "Central Campus Route",
      routeCode: "CCR-01",
      startPoint: "Railway Station",
      endPoint: "University Campus",
      stops: [
        { name: "Railway Station", lat: 16.695, lng: 74.24 },
        { name: "Bus Stand", lat: 16.702, lng: 74.245 },
        { name: "University Campus", lat: 16.71, lng: 74.255 },
      ],
      createdAt: new Date().toISOString(),
    },
  ],
]);

// Get all routes
async function getAllRoutes(req, res, next) {
  try {
    if (db) {
      const snap = await db.collection("routes").get();
      const routes = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json({ success: true, count: routes.length, data: routes });
    } else {
      const routes = Array.from(memoryRoutes.entries()).map(([id, data]) => ({ id, ...data }));
      return res.json({ success: true, count: routes.length, data: routes });
    }
  } catch (err) {
    next(err);
  }
}

// Get route by ID
async function getRouteById(req, res, next) {
  try {
    const { id } = req.params;

    if (db) {
      const doc = await db.collection("routes").doc(id).get();
      if (!doc.exists) return res.status(404).json({ success: false, message: "Route not found." });
      return res.json({ success: true, data: { id: doc.id, ...doc.data() } });
    } else {
      const route = memoryRoutes.get(id);
      if (!route) return res.status(404).json({ success: false, message: "Route not found." });
      return res.json({ success: true, data: { id, ...route } });
    }
  } catch (err) {
    next(err);
  }
}

// Create new route
async function createRoute(req, res, next) {
  try {
    const { routeName, routeCode, startPoint, endPoint, stops } = req.body;

    if (!routeName) {
      return res.status(400).json({ success: false, message: "Route name is required." });
    }

    const routeData = {
      routeName,
      routeCode: routeCode || "",
      startPoint: startPoint || "",
      endPoint: endPoint || "",
      stops: Array.isArray(stops) ? stops : [],
      createdAt: new Date().toISOString(),
    };

    if (db) {
      const docRef = await db.collection("routes").add(routeData);
      return res.status(201).json({ success: true, message: "Route created.", data: { id: docRef.id, ...routeData } });
    } else {
      const id = "route_" + Date.now();
      memoryRoutes.set(id, routeData);
      return res.status(201).json({ success: true, message: "[Memory Mode] Route created.", data: { id, ...routeData } });
    }
  } catch (err) {
    next(err);
  }
}

// Update route
async function updateRoute(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (db) {
      await db.collection("routes").doc(id).update(updates);
      const updated = await db.collection("routes").doc(id).get();
      return res.json({ success: true, message: "Route updated.", data: { id, ...updated.data() } });
    } else {
      const route = memoryRoutes.get(id);
      if (!route) return res.status(404).json({ success: false, message: "Route not found." });
      const updated = { ...route, ...updates };
      memoryRoutes.set(id, updated);
      return res.json({ success: true, message: "Route updated.", data: { id, ...updated } });
    }
  } catch (err) {
    next(err);
  }
}

// Delete route
async function deleteRoute(req, res, next) {
  try {
    const { id } = req.params;

    if (db) {
      const batch = db.batch();
      // Unassign route from buses
      const buses = await db.collection("buses").where("assignedRouteId", "==", id).get();
      buses.forEach((b) => batch.update(b.ref, { assignedRouteId: null }));

      // Unassign route from passengers
      const passengers = await db.collection("users").where("routeId", "==", id).get();
      passengers.forEach((p) => batch.update(p.ref, { routeId: null }));

      // Delete route
      batch.delete(db.collection("routes").doc(id));
      await batch.commit();
    } else {
      memoryRoutes.delete(id);
    }

    return res.json({ success: true, message: "Route deleted successfully." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
};
