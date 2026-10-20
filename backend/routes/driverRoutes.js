const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driverController");

// Get all drivers
router.get("/", driverController.getAllDrivers);

// Get assigned bus for driver
router.get("/:driverUid/bus", driverController.getDriverBus);

// Update driver (info / password)
router.put("/:id", driverController.updateDriver);

// Delete driver
router.delete("/:id", driverController.deleteDriver);

module.exports = router;
