const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");

// Mark attendance
router.post("/", attendanceController.markAttendance);

// Query attendance records
router.get("/", attendanceController.getAttendance);

module.exports = router;
