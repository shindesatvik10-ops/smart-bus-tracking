# Smart Bus Tracking System - Backend API & Real-time Server

This is the dedicated Node.js & Express backend for the **Smart Bus Tracking System**, providing RESTful APIs, real-time WebSocket location broadcasting (via Socket.io), and Firebase Admin integration.

---

## 📁 Architecture Overview

```text
backend/
├── config/
│   └── firebase.js          # Firebase Admin SDK initialization
├── controllers/
│   ├── alertController.js    # Delay and emergency alert broadcasting
│   ├── attendanceController.js # Student/passenger attendance
│   ├── authController.js     # User registration, driver setup & profiles
│   ├── busController.js      # Bus CRUD & live GPS updates
│   ├── driverController.js   # Driver queries & assignments
│   ├── passengerController.js# Passenger approval workflow & routes
│   ├── routeController.js    # Routes and stops management
│   └── tripController.js     # Start / End trip tracking
├── middleware/
│   ├── authMiddleware.js     # Token verification & role checking
│   └── errorHandler.js       # Centralized error responses
├── routes/
│   ├── alertRoutes.js        # /api/alerts
│   ├── attendanceRoutes.js   # /api/attendance
│   ├── authRoutes.js         # /api/auth
│   ├── busRoutes.js          # /api/buses
│   ├── driverRoutes.js       # /api/drivers
│   ├── passengerRoutes.js    # /api/passengers
│   ├── routeRoutes.js        # /api/routes
│   └── tripRoutes.js         # /api/trips
├── firestore.rules           # Cloud Firestore security rules
├── .env.example              # Environment variables template
├── .env                      # Active environment settings
├── package.json              # Node dependencies & scripts
└── server.js                 # Express server & Socket.io server
```

---

## 🚀 Getting Started

### 1. Install Dependencies
Open a command prompt or terminal in the `backend` folder:
```bash
npm install
```

### 2. Configure Environment & Firebase (Optional for Cloud sync)
1. In your **Firebase Console** -> **Project Settings** -> **Service accounts**.
2. Click **Generate new private key**.
3. Save the downloaded JSON file as `serviceAccountKey.json` inside this `backend/` directory.
*(Note: If the key is not provided yet, the backend will run with safe defaults).*

### 3. Start the Server
```bash
npm start
```
Or for auto-reload during development:
```bash
npm run dev
```

The server will be available at **`http://localhost:5000`**.  
The frontend is also statically served at `http://localhost:5000/`.

---

## 📡 REST API Reference

### Health Check
- `GET /api/health` - Health status

### Buses (`/api/buses`)
- `GET /api/buses` - List all buses
- `GET /api/buses/:id` - Get bus details
- `POST /api/buses` - Register new bus (`busNumber`, `licensePlate`, `capacity`)
- `PUT /api/buses/:id` - Update bus info
- `POST /api/buses/:id/location` - Post live GPS coordinates (`lat`, `lng`, `speed`, `heading`)
- `DELETE /api/buses/:id` - Delete a bus

### Drivers (`/api/drivers`)
- `GET /api/drivers` - List all drivers
- `GET /api/drivers/:driverUid/bus` - Get driver's assigned bus
- `DELETE /api/drivers/:id` - Remove driver

### Passengers (`/api/passengers`)
- `GET /api/passengers` - List passengers (optional query: `?status=pending`)
- `PATCH /api/passengers/:id/status` - Admin approve/reject passenger (`{ "status": "approved" | "rejected" }`)
- `PUT /api/passengers/:id/route` - Assign route or stop
- `DELETE /api/passengers/:id` - Remove passenger

### Routes (`/api/routes`)
- `GET /api/routes` - List all routes & stops
- `GET /api/routes/:id` - Get route details
- `POST /api/routes` - Add new route (`routeName`, `routeCode`, `stops: [...]`)
- `PUT /api/routes/:id` - Update route
- `DELETE /api/routes/:id` - Delete route

### Trips (`/api/trips`)
- `POST /api/trips/start` - Driver starts trip (`busId`, `driverUid`, `routeId`)
- `POST /api/trips/:id/end` - Driver ends trip (`busId`)
- `GET /api/trips` - Query trip logs (`?driverUid=...` or `?busId=...`)

### Attendance (`/api/attendance`)
- `POST /api/attendance` - Record passenger attendance (`passengerId`, `date`, `status`)
- `GET /api/attendance` - Query attendance (`?date=YYYY-MM-DD`)

### Alerts (`/api/alerts`)
- `POST /api/alerts` - Broadcast alert (`type`, `message`, `busId`)
- `GET /api/alerts` - Get recent alerts

---

## ⚡ Real-Time WebSocket Events (Socket.io)

Connect to the Socket.io server at `ws://localhost:5000`:
- **Emit `live-location-update`** (from Driver): `{ busId, lat, lng, speed, heading }`
- **Listen `bus-location-update`** (from Passenger/Admin): receives real-time GPS stream
- **Emit `join-bus-room`**: `{ busId }` to receive filtered updates for a specific bus
- **Listen `bus-alert`**: receives instant breakdown, delay, or emergency warnings
