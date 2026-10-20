const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alertController");

// Broadcast alert
router.post("/", alertController.createAlert);

// Get recent alerts
router.get("/", alertController.getAlerts);

module.exports = router;
