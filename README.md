# 🚌 Smart Bus Tracking & Fleet Management System

A real-time public transit tracking and fleet management system built with **vanilla JavaScript, Leaflet maps, Node.js, Express, Socket.io, and Firebase**. Designed for real GPS tracking with zero fake or simulated coordinates.

---

## 🌟 Key Features

### 1. 🗺️ Passenger Live Map (`index.html`)
* **Real-time Kolhapur Transit Network**: Pre-seeded with key city landmarks (Central Bus Stand, Dasara Chowk, Bindu Chowk, Mahalaxmi Temple, Rankala Lake Stand, Shivaji University, etc.).
* **Smart Route Search ("From $\rightarrow$ To")**: Flexible keyword/substring search that automatically resolves stop abbreviations (e.g. `cbs`, `rankala`, `university`).
* **Route Polyline & Stop Visualizer**: Dynamically renders complete route lines, boarding stops (green), destinations (red), and intermediate stops.
* **Live Bus Tracking**: Real GPS markers moving smoothly across the map with speed, heading rotation, next stop, and arrival ETA.
* **100% Free Maps**: High-contrast OpenStreetMap Humanitarian (HOT) & ESRI World Street Map tiles with zero watermarks and no API keys required.

### 2. 👨‍✈️ Driver Dashboard (`driver-dashboard.html`)
* **Role Guard & Assigned Bus**: Restricted to driver accounts with enforced bus and route assignments.
* **Real GPS Broadcast**: Uses `navigator.geolocation.watchPosition` with high accuracy filtering ($<100\text{ m}$ threshold, automatic speed/heading calculation).
* **Screen Wake Lock API**: Keeps driver phone screens awake during active duty.
* **Duty Shift & Attendance**: One-click "Start Duty" records driver attendance and starts live GPS broadcasting. "End Duty" cleanly signs off and marks the bus offline.
* **Duty Recovery**: An active duty is restored after a dashboard refresh, and GPS sharing resumes automatically. Use "End Duty" to stop sharing and clear the saved duty.
* **Single-Device Driver Login**: A driver account can have one active device session. Sessions renew while active and expire after 45 seconds without a heartbeat; deploy the `driverSessions` rules from `database.rules.json` to Firebase Realtime Database.
* **SOS Distress Alert**: Instant emergency broadcast to the Transport Admin.

### 3. 🛡️ Admin Dashboard (`admin-dashboard.html`)
* **Bus Fleet Management**: Add, view, edit, and assign buses with capacity tracking.
* **Driver Management**: Register drivers, manage login credentials, and assign buses/routes.
* **Interactive Route Builder**: Add stops by clicking the map, drag stop markers, search locations with Nominatim, and re-order stops.
* **Live Fleet Monitoring**: Real-time Leaflet mini-map and fleet tracker showing all active buses.
* **Attendance & Reports**: Live view of drivers on duty today and historical shift records.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+), FontAwesome
* **Mapping**: [Leaflet.js](https://leafletjs.com/), OpenStreetMap HOT, ESRI World Street Map
* **Backend**: Node.js, Express.js, Socket.io, CORS, dotenv
* **Database & Auth**: Firebase Authentication & Realtime Database (with fallback local storage synchronization)

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v16 or higher)
* [Git](https://git-scm.com/)

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shindesatvik10-ops/smart-bus-tracking.git
   cd smart-bus-tracking
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Start the local server:**
   ```bash
   npm start
   ```

4. **Open in your browser:**
   * **Passenger Live Map:** `http://localhost:5000/`
   * **Admin Login:** `http://localhost:5000/admin-login.html` (Use an Admin account registered in Firebase Authentication.)
   * **Driver Login:** `http://localhost:5000/driver-login.html` (Use a driver account created by the Admin and registered in Firebase Authentication.)

### Firebase Configuration

1. Copy `frontend/firebase-config.example.js` to `frontend/firebase-config.local.js`.
2. Replace the example values with your Firebase project's web app settings.
3. Create Admin and driver accounts in Firebase Authentication and assign their roles in the database.

The local config file is ignored by Git and must not be committed.

---

## 🔒 Security & Firebase Setup

* Place your `serviceAccountKey.json` inside `backend/` if connecting to Firebase Admin SDK. This file is ignored by Git and must not be committed.
* Realtime Database security rules are available in `database.rules.json`.
* Firestore security rules are available in `firestore.rules`.
