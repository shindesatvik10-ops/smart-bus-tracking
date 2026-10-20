const { db } = require("../config/firebase");

// In-memory fallback
const memoryBuses = new Map([
  [
    "bus-1",
    {
      busNumber: "BUS-101",
      licensePlate: "MH-09-AB-1234",
      capacity: 42,
      status: "active",
      isSharingLocation: false,
      currentLocation: { lat: 16.6950, lng: 74.2500, updatedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    },
  ],
  [
    "bus-2",
    {
      busNumber: "BUS-102",
      licensePlate: "MH-09-XY-5678",
      capacity: 35,
      status: "active",
      isSharingLocation: false,
      currentLocation: { lat: 16.7050, lng: 74.2400, updatedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    },
  ],
]);

// Get all buses
async function getAllBuses(req, res, next) {
  try {
    if (db) {
      const snap = await db.collection("buses").get();
      const buses = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      return res.json({ success: true, count: buses.length, data: buses });
    } else {
      const buses = Array.from(memoryBuses.entries()).map(([id, data]) => ({ id, ...data }));
      return res.json({ success: true, count: buses.length, data: buses });
    }
  } catch (err) {
    next(err);
  }
}

// Get bus by ID
async function getBusById(req, res, next) {
  try {
    const { id } = req.params;
    if (db) {
      const doc = await db.collection("buses").doc(id).get();
      if (!doc.exists) return res.status(404).json({ success: false, message: "Bus not found." });
      return res.json({ success: true, data: { id: doc.id, ...doc.data() } });
    } else {
      const bus = memoryBuses.get(id);
      if (!bus) return res.status(404).json({ success: false, message: "Bus not found." });
      return res.json({ success: true, data: { id, ...bus } });
    }
  } catch (err) {
    next(err);
  }
}

// Create new bus
async function createBus(req, res, next) {
  try {
    const { busNumber, licensePlate, capacity, assignedDriverId, assignedRouteId, status } = req.body;

    if (!busNumber) {
      return res.status(400).json({ success: false, message: "Bus number is required." });
    }

    const busData = {
      busNumber,
      licensePlate: licensePlate || "",
      capacity: Number(capacity) || 40,
      assignedDriverId: assignedDriverId || null,
      assignedRouteId: assignedRouteId || null,
      status: status || "active",
      isSharingLocation: false,
      currentLocation: null,
      createdAt: new Date().toISOString(),
    };

    if (db) {
      const docRef = await db.collection("buses").add(busData);
      return res.status(201).json({ success: true, message: "Bus created.", data: { id: docRef.id, ...busData } });
    } else {
      const id = "bus_" + Date.now();
      memoryBuses.set(id, busData);
      return res.status(201).json({ success: true, message: "[Memory Mode] Bus created.", data: { id, ...busData } });
    }
  } catch (err) {
    next(err);
  }
}

// Update bus details
async function updateBus(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (db) {
      await db.collection("buses").doc(id).update(updates);
      const updated = await db.collection("buses").doc(id).get();
      return res.json({ success: true, message: "Bus updated.", data: { id, ...updated.data() } });
    } else {
      const bus = memoryBuses.get(id);
      if (!bus) return res.status(404).json({ success: false, message: "Bus not found." });
      const updated = { ...bus, ...updates };
      memoryBuses.set(id, updated);
      return res.json({ success: true, message: "Bus updated.", data: { id, ...updated } });
    }
  } catch (err) {
    next(err);
  }
}

// Update live bus GPS location
async function updateLocation(req, res, next) {
  try {
    const { id } = req.params;
    const { lat, lng, speed, heading, lastStop, isSharingLocation } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({ success: false, message: "Latitude and longitude are required." });
    }

    const locationPayload = {
      currentLocation: {
        lat: Number(lat),
        lng: Number(lng),
        speed: speed != null ? Number(speed) : 0,
        heading: heading != null ? Number(heading) : 0,
        lastStop: lastStop || null,
        updatedAt: new Date().toISOString(),
      },
      isSharingLocation: isSharingLocation !== undefined ? Boolean(isSharingLocation) : true,
    };

    if (db) {
      await db.collection("buses").doc(id).update(locationPayload);
    } else {
      const bus = memoryBuses.get(id) || {};
      memoryBuses.set(id, { ...bus, ...locationPayload });
    }

    // Broadcast live location over Socket.io if active
    if (req.io) {
      req.io.emit("bus-location-update", {
        busId: id,
        ...locationPayload,
      });
    }

    return res.json({ success: true, message: "Location updated successfully.", data: { busId: id, ...locationPayload } });
  } catch (err) {
    next(err);
  }
}

// Delete bus
async function deleteBus(req, res, next) {
  try {
    const { id } = req.params;

    if (db) {
      await db.collection("buses").doc(id).delete();
    } else {
      memoryBuses.delete(id);
    }

    return res.json({ success: true, message: "Bus deleted." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllBuses,
  getBusById,
  createBus,
  updateBus,
  updateLocation,
  deleteBus,
};
