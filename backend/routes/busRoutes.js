const express = require("express");
const router = express.Router();
const busController = require("../controllers/busController");

// Get all buses
router.get("/", busController.getAllBuses);

// Get single bus
router.get("/:id", busController.getBusById);

// Create bus
router.post("/", busController.createBus);

// Update bus
router.put("/:id", busController.updateBus);

// Update bus live location (GPS)
router.post("/:id/location", busController.updateLocation);

// Delete bus
router.delete("/:id", busController.deleteBus);

module.exports = router;
