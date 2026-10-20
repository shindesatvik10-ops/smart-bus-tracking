const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");

// Passenger signup / registration
router.post("/register", authController.registerPassenger);

// Admin creates driver
router.post("/driver", authController.createDriver);

// Get user profile
router.get("/profile/:uid", authController.getProfile);

// Update user profile
router.put("/profile/:uid", authController.updateProfile);

module.exports = router;
