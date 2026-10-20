const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

// Route imports
const authRoutes = require("./routes/authRoutes");
const busRoutes = require("./routes/busRoutes");
const driverRoutes = require("./routes/driverRoutes");
const routeRoutes = require("./routes/routeRoutes");
const tripRoutes = require("./routes/tripRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const alertRoutes = require("./routes/alertRoutes");

// Middleware imports
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app);

// Allowed origins
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",")
  : ["http://localhost:5000", "http://127.0.0.1:5500", "http://localhost:3000"];

// Socket.io for Real-time GPS Location & Alerts
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach Socket.io instance to req for controllers to broadcast events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Serve frontend static files directly (allows running full app from backend)
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Smart Bus Tracking API",
    time: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/alerts", alertRoutes);

// Socket.io real-time connection logic
io.on("connection", (socket) => {
  console.log(`⚡ Client connected to real-time socket: ${socket.id}`);

  // Join a room for a specific bus
  socket.on("join-bus-room", (busId) => {
    socket.join(`bus-${busId}`);
    console.log(`Socket ${socket.id} joined room bus-${busId}`);
  });

  // Driver emits GPS coordinates live
  socket.on("live-location-update", (data) => {
    // Broadcast to everyone tracking this bus
    io.to(`bus-${data.busId}`).emit("bus-location", data);
    // Broadcast globally
    io.emit("bus-location-update", data);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// 404 & Error handlers
app.use("/api/*", notFoundHandler);
app.use(errorHandler);

// Fallback to frontend index.html for non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Smart Bus Tracking Backend running on http://localhost:${PORT}`);
  console.log(`🌐 Serving Frontend from: ${frontendPath}`);
  console.log(`📡 WebSocket ready for live GPS tracking`);
  console.log(`===============================================`);
});
