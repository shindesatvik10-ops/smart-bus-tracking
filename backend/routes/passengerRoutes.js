const express = require("express");
const router = express.Router();
const passengerController = require("../controllers/passengerController");

// Get all passengers
router.get("/", passengerController.getAllPassengers);

// Approve or reject passenger status (Admin)
router.patch("/:id/status", passengerController.updatePassengerStatus);

// Assign route/stop to passenger
router.put("/:id/route", passengerController.assignRoute);

// Delete passenger
router.delete("/:id", passengerController.deletePassenger);

module.exports = router;
