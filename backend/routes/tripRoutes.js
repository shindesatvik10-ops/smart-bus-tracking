const express = require("express");
const router = express.Router();
const tripController = require("../controllers/tripController");

// Start trip
router.post("/start", tripController.startTrip);

// End trip
router.post("/:id/end", tripController.endTrip);

// Get trip history
router.get("/", tripController.getTrips);

module.exports = router;
