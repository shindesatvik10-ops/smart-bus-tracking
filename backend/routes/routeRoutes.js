const express = require("express");
const router = express.Router();
const routeController = require("../controllers/routeController");

// Get all routes
router.get("/", routeController.getAllRoutes);

// Get single route
router.get("/:id", routeController.getRouteById);

// Create route
router.post("/", routeController.createRoute);

// Update route
router.put("/:id", routeController.updateRoute);

// Delete route
router.delete("/:id", routeController.deleteRoute);

module.exports = router;
