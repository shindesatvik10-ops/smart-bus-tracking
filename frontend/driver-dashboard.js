// ========================================================
// SMART BUS TRACKING - DRIVER DASHBOARD (driver-dashboard.js)
// Real GPS Live Broadcast & Driver Duty Management
// ========================================================

// Require "driver" role from Firebase Auth & RTDB
let currentUser = null;
let currentProfile = null;
let currentShiftLogId = null;
let assignedBus = null;
let assignedRoute = null;
let assignedRouteDoc = null;

let isDutyActive = false;
let isDutyRestoreStarted = false;
let todayAttendanceMarked = false;
let hasLiveGpsFix = false;
let geoWatchId = null;
let wakeLock = null;

let lastSentTime = 0;
let lastSentLat = null;
let lastSentLng = null;
let lastPosTime = null;
let lastPosLat = null;
let lastPosLng = null;

let driverMap = null;
let driverMarker = null;
let driverRoutePolyline = null;
let driverStopMarkers = [];
let lastSentTickerInterval = null;
let isLocationWritePending = false;

const DEFAULT_CENTER = [16.7050, 74.2433];
const ACTIVE_DUTY_STORAGE_KEY = "smartbus_active_duties";

function readActiveDuties() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_DUTY_STORAGE_KEY) || "{}");
  } catch (error) {
    console.warn("Could not read saved duty state:", error.message);
    return {};
  }
}

function saveActiveDuty(driverUid, busNo) {
  const activeDuties = readActiveDuties();
  activeDuties[driverUid] = {
    busNo,
    startedAt:
      activeDuties[driverUid] && activeDuties[driverUid].busNo === busNo
        ? activeDuties[driverUid].startedAt
        : Date.now(),
  };
  localStorage.setItem(ACTIVE_DUTY_STORAGE_KEY, JSON.stringify(activeDuties));
}

function clearSavedActiveDuty(driverUid) {
  const activeDuties = readActiveDuties();
  delete activeDuties[driverUid];
  localStorage.setItem(ACTIVE_DUTY_STORAGE_KEY, JSON.stringify(activeDuties));
}

// ================= DEFAULT KOLHAPUR SEEDS =================
const DEFAULT_KOLHAPUR_ROUTES = {
  "route-1": {
    name: "Central Bus Stand (CBS) - Rankala Lake",
    routeCode: "KLP-01",
    stops: [
      { name: "Central Bus Stand (CBS)", lat: 16.7025, lng: 74.2425 },
      { name: "Dasara Chowk", lat: 16.6978, lng: 74.2340 },
      { name: "Bindu Chowk", lat: 16.6945, lng: 74.2285 },
      { name: "Mahalaxmi Temple", lat: 16.6938, lng: 74.2238 },
      { name: "Rankala Lake Stand", lat: 16.6905, lng: 74.2150 },
    ],
  },
  "route-2": {
    name: "CBS - Shivaji University Campus",
    routeCode: "KLP-02",
    stops: [
      { name: "Central Bus Stand (CBS)", lat: 16.7025, lng: 74.2425 },
      { name: "Railway Station (CSMT)", lat: 16.7042, lng: 74.2472 },
      { name: "Kawala Naka", lat: 16.7055, lng: 74.2580 },
      { name: "Cyber Chowk", lat: 16.6920, lng: 74.2595 },
      { name: "Shivaji University Gate", lat: 16.6785, lng: 74.2560 },
    ],
  },
};

const DEFAULT_KOLHAPUR_BUSES = {
  "MH-09-V-1204": {
    busNo: "MH-09-V-1204",
    capacity: 45,
    assignedDriver: "driver_sunil",
    driverName: "Sunil Shinde",
    routeId: "route-1",
    sharing: false,
    active: true,
  },
  "MH-09-CV-4512": {
    busNo: "MH-09-CV-4512",
    capacity: 50,
    assignedDriver: null,
    driverName: null,
    routeId: "route-2",
    sharing: false,
    active: true,
  },
};

const DEFAULT_KOLHAPUR_DRIVERS = {
  "driver_sunil": {
    uid: "driver_sunil",
    name: "Sunil Shinde",
    phone: "9876543210",
    email: "sunil.driver@smartbus.com",
    address: "Rajarampuri, Kolhapur",
    role: "driver",
    assignedBus: "MH-09-V-1204",
    assignedRoute: "route-1",
    createdAt: new Date().toISOString(),
  },
};

function seedDefaultsIfEmpty() {
  try {
    const d = localStorage.getItem("smartbus_drivers");
    if (!d || Object.keys(JSON.parse(d || "{}")).length === 0) {
      localStorage.setItem("smartbus_drivers", JSON.stringify(DEFAULT_KOLHAPUR_DRIVERS));
    }
    const b = localStorage.getItem("smartbus_buses");
    if (!b || Object.keys(JSON.parse(b || "{}")).length === 0) {
      localStorage.setItem("smartbus_buses", JSON.stringify(DEFAULT_KOLHAPUR_BUSES));
    }
    const r = localStorage.getItem("smartbus_routes");
    if (!r || Object.keys(JSON.parse(r || "{}")).length === 0) {
      localStorage.setItem("smartbus_routes", JSON.stringify(DEFAULT_KOLHAPUR_ROUTES));
    }
  } catch (e) {
    console.warn("Storage seed notice:", e);
  }
}
seedDefaultsIfEmpty();

// ================================
// DOM ELEMENTS
// ================================
const gpsStatusBadge = document.getElementById("gpsStatusBadge");
const gpsErrorAlert = document.getElementById("gpsErrorAlert");
const gpsErrorText = document.getElementById("gpsErrorText");

const dutyAssignedBus = document.getElementById("dutyAssignedBus");
const dutyAssignedRoute = document.getElementById("dutyAssignedRoute");
const dutyShiftStart = document.getElementById("dutyShiftStart");
const dutyGpsAccuracy = document.getElementById("dutyGpsAccuracy");
const dutyGpsSpeed = document.getElementById("dutyGpsSpeed");
const dutyLastSent = document.getElementById("dutyLastSent");

const startDutyBtn = document.getElementById("startDutyBtn");
const endDutyBtn = document.getElementById("endDutyBtn");
const broadcastStatusBanner = document.getElementById("broadcastStatusBanner");
const tripLiveIndicator = document.getElementById("tripLiveIndicator");
const tripBadge = document.getElementById("tripBadge");

const switchBusSection = document.getElementById("switchBusSection");
const switchBusSelect = document.getElementById("switchBusSelect");
const switchBusBtn = document.getElementById("switchBusBtn");

const statBusNumber = document.getElementById("statBusNumber");
const statRouteName = document.getElementById("statRouteName");
const attendanceStatBadge = document.getElementById("attendanceStatBadge");
const attendanceStatText = document.getElementById("attendanceStatText");
const tripStatBadge = document.getElementById("tripStatBadge");
const tripStatText = document.getElementById("tripStatText");
const tripStatIcon = document.getElementById("tripStatIcon");

const dashTripStatusText = document.getElementById("dashTripStatusText");
const dashTripIcon = document.getElementById("dashTripIcon");
const quickMarkBtn = document.getElementById("quickMarkBtn");
const dashStartTripBtn = document.getElementById("dashStartTripBtn");

const driverNameLabel = document.getElementById("driverNameLabel");
const driverBusLabel = document.getElementById("driverBusLabel");
const topSubtitleDriverName = document.getElementById("topSubtitleDriverName");
const welcomeBannerHeading = document.getElementById("welcomeBannerHeading");
const welcomeDriverName = document.getElementById("welcomeDriverName");
const welcomeBannerSub = document.getElementById("welcomeBannerSub");

const attendanceDateText = document.getElementById("attendanceDateText");
const attendancePageStatusText = document.getElementById("attendancePageStatusText");
const attendancePageIcon = document.getElementById("attendancePageIcon");
const markAttendanceBtn = document.getElementById("markAttendanceBtn");

const locationShareModal = document.getElementById("locationShareModal");
const modalAllowShareBtn = document.getElementById("modalAllowShareBtn");
const modalCancelShareBtn = document.getElementById("modalCancelShareBtn");
const modalCloseXBtn = document.getElementById("modalCloseXBtn");

const routeCardName = document.getElementById("routeCardName");
const routeCardCode = document.getElementById("routeCardCode");
const routeCardBus = document.getElementById("routeCardBus");
const routeCardStopsCount = document.getElementById("routeCardStopsCount");

const settingsProfileName = document.getElementById("settingsProfileName");
const settingsProfileRole = document.getElementById("settingsProfileRole");
const settingsDriverUid = document.getElementById("settingsDriverUid");
const settingsDriverEmail = document.getElementById("settingsDriverEmail");
const settingsDriverPhone = document.getElementById("settingsDriverPhone");
const settingsAssignedBus = document.getElementById("settingsAssignedBus");
const settingsAssignedRoute = document.getElementById("settingsAssignedRoute");
const settingsAttendanceStatus = document.getElementById("settingsAttendanceStatus");
const settingsRefreshBtn = document.getElementById("settingsRefreshBtn");
const settingsLogoutBtn = document.getElementById("settingsLogoutBtn");

const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const logoutBtn = document.getElementById("logoutBtn");
const sosBtn = document.getElementById("sosBtn");
const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".dashboard-section");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

if (attendanceDateText) {
  attendanceDateText.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ================================
// HAVERSINE DISTANCE HELPER
// ================================
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ================================
// SCREEN WAKE LOCK API
// ================================
async function requestScreenWakeLock() {
  try {
    if ("wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    }
  } catch (err) {
    console.warn("Screen wake lock error:", err.message);
  }
}

async function releaseScreenWakeLock() {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (err) {
    console.warn("Wake lock release error:", err.message);
  }
}

document.addEventListener("visibilitychange", async () => {
  if (isDutyActive && wakeLock === null && document.visibilityState === "visible") {
    await requestScreenWakeLock();
  }
});

// ================================
// NAVIGATION & SIDEBAR
// ================================
const pageData = {
  dashboard: {
    title: "Dashboard Overview",
    subtitle: "Welcome back, Driver. Here's your duty overview for today.",
  },
  trip: {
    title: "Driver Duty & Live GPS",
    subtitle: "Start duty to begin real GPS broadcasting to the live map.",
  },
  attendance: {
    title: "Attendance & Shift Logs",
    subtitle: "Your daily attendance and shift duty history.",
  },
  route: {
    title: "My Assigned Route",
    subtitle: "Stops assigned to your bus today.",
  },
  notifications: {
    title: "Notifications",
    subtitle: "Announcements from the transport administration.",
  },
  settings: {
    title: "Settings",
    subtitle: "Manage your driver profile and preferences.",
  },
};

function showSection(sectionName) {
  sections.forEach((s) => s.classList.remove("active-section"));
  const selected = document.getElementById(sectionName);
  if (selected) selected.classList.add("active-section");

  if (pageData[sectionName] && pageTitle && pageSubtitle) {
    pageTitle.textContent = pageData[sectionName].title;
    if (sectionName === "dashboard") {
      const curName = (currentProfile && currentProfile.name) || sessionStorage.getItem("driverName") || "Sunil Shinde";
      pageSubtitle.innerHTML = `Welcome back, <strong>${curName}</strong>. Here's your trip status for today.`;
    } else {
      pageSubtitle.textContent = pageData[sectionName].subtitle;
    }
  }

  navItems.forEach((item) => item.classList.remove("active"));
  const activeItem = document.querySelector(`[data-section="${sectionName}"]`);
  if (activeItem) activeItem.classList.add("active");

  if (sectionName === "trip") {
    if (!driverMap) {
      initDriverMap();
    }
    [50, 200, 500].forEach((ms) => {
      setTimeout(() => {
        if (driverMap) driverMap.invalidateSize();
      }, ms);
    });
  } else if (sectionName === "settings") {
    syncDriverAssignment();
    checkTodayAttendance();
  } else if (sectionName === "route") {
    if (assignedRouteDoc && Array.isArray(assignedRouteDoc.stops)) {
      renderRouteStops(assignedRouteDoc.stops);
    }
  }

  if (sidebar) sidebar.classList.remove("open");
  if (sidebarOverlay) sidebarOverlay.classList.remove("active");
}

navItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const sectionName = item.getAttribute("data-section");
    if (sectionName) showSection(sectionName);
  });
});

document.querySelectorAll("[data-section]").forEach((el) => {
  if (el.classList.contains("nav-item")) return;
  el.addEventListener("click", () => {
    const sectionName = el.getAttribute("data-section");
    if (sectionName) showSection(sectionName);
  });
});

if (menuButton && sidebar && sidebarOverlay) {
  menuButton.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    sidebarOverlay.classList.toggle("active");
  });
  sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
  });
}

// ================================
// LEAFLET MAP ON DRIVER DASHBOARD
// ================================
function initDriverMap(centerCoords = DEFAULT_CENTER) {
  const container = document.getElementById("driverMap");
  if (!container || typeof L === "undefined") return;

  // Ensure default Leaflet marker icons load without 404s
  if (L.Icon && L.Icon.Default) {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }

  if (driverMap) {
    try {
      driverMap.remove();
    } catch (e) {}
    driverMap = null;
  }

  driverMap = L.map("driverMap", {
    zoomControl: true,
    scrollWheelZoom: false,
  }).setView(centerCoords, 14);

  const osmHot = L.tileLayer(
    "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    {
      subdomains: "abc",
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">HOT</a>',
    }
  );

  const esriStreet = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, METI, TomTom',
    }
  );

  const osmStandard = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }
  );

  osmStandard.addTo(driverMap);

  try {
    L.control
      .layers(
        {
          "OpenStreetMap (Humanitarian)": osmHot,
          "ESRI World Street Map": esriStreet,
          "OpenStreetMap Standard": osmStandard,
        },
        null,
        { position: "topright" }
      )
      .addTo(driverMap);
  } catch (e) {}

  if (window.ResizeObserver && container) {
    const ro = new ResizeObserver(() => {
      if (driverMap) driverMap.invalidateSize();
    });
    ro.observe(container);
  }

  const ownBusIcon = L.divIcon({
    className: "driver-own-bus-icon",
    html: `
      <div style="width: 36px; height: 36px; background: #16a34a; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.35); font-size: 15px;">
        <i class="fa-solid fa-bus"></i>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });

  driverMarker = L.marker(centerCoords, { icon: ownBusIcon })
    .addTo(driverMap)
    .bindPopup(`<strong>${assignedBus || "Your Bus"}</strong><br>GPS Standby`);

  drawAssignedRouteOnMap();

  setTimeout(() => {
    if (driverMap) driverMap.invalidateSize();
  }, 250);
}

function drawAssignedRouteOnMap() {
  if (!driverMap || !assignedRouteDoc || !Array.isArray(assignedRouteDoc.stops)) return;

  if (driverRoutePolyline) {
    driverMap.removeLayer(driverRoutePolyline);
    driverRoutePolyline = null;
  }
  driverStopMarkers.forEach((m) => driverMap.removeLayer(m));
  driverStopMarkers = [];

  const stops = assignedRouteDoc.stops;
  if (stops.length < 2) return;

  const coords = stops.map((s) => [Number(s.lat), Number(s.lng)]);

  driverRoutePolyline = L.polyline(coords, {
    color: "#2563eb",
    weight: 4,
    opacity: 0.8,
    dashArray: "6, 8",
  }).addTo(driverMap);

  stops.forEach((stop, i) => {
    const isEndpoint = i === 0 || i === stops.length - 1;
    const color = i === 0 ? "#16a34a" : i === stops.length - 1 ? "#dc2626" : "#2563eb";

    const stopIcon = L.divIcon({
      className: "driver-stop-dot",
      html: `
        <div style="background:${color}; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.3);">
          ${i + 1}
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const m = L.marker([Number(stop.lat), Number(stop.lng)], { icon: stopIcon })
      .addTo(driverMap)
      .bindPopup(`<strong>#${i + 1}: ${stop.name}</strong>`);
    driverStopMarkers.push(m);
  });

  if (coords.length > 0) {
    driverMap.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
  }
}

// ================================
// ERROR / ALERT HELPERS
// ================================
function showGpsError(message) {
  if (gpsErrorAlert && gpsErrorText) {
    gpsErrorText.innerHTML = message;
    gpsErrorAlert.style.display = "block";
  }
  if (gpsStatusBadge) {
    gpsStatusBadge.style.background = "#fee2e2";
    gpsStatusBadge.style.color = "#991b1b";
    gpsStatusBadge.innerHTML = `<span style="width:8px; height:8px; background:#ef4444; border-radius:50%; display:inline-block;"></span> Error: Location Issue`;
  }
}

function getRealtimeDatabaseErrorMessage(error) {
  const code = error && error.code ? String(error.code) : "unknown";
  const message = error && error.message ? String(error.message) : "No error message was provided.";
  if (code.toLowerCase().includes("permission_denied") || message.toLowerCase().includes("permission_denied")) {
    return `Firebase Realtime Database permission denied (${code}): ${message}`;
  }
  if (code.toLowerCase().includes("network") || message.toLowerCase().includes("network")) {
    return `Firebase Realtime Database network error (${code}): ${message}`;
  }
  return `Firebase Realtime Database error (${code}): ${message}`;
}

function clearGpsError() {
  if (gpsErrorAlert) {
    gpsErrorAlert.style.display = "none";
  }
}

// Update Last Sent relative time
function updateLastSentUI() {
  if (!dutyLastSent) return;
  if (!lastSentTime) {
    dutyLastSent.textContent = "Never";
    return;
  }
  const diffSec = Math.floor((Date.now() - lastSentTime) / 1000);
  if (diffSec < 3) dutyLastSent.textContent = "Just now";
  else if (diffSec < 60) dutyLastSent.textContent = `${diffSec}s ago`;
  else dutyLastSent.textContent = `${Math.floor(diffSec / 60)}m ago`;
}

// ================================
// DRIVER NAME UI HELPER
// ================================
function updateDriverNameUI(name) {
  if (!name) return;
  if (driverNameLabel) driverNameLabel.textContent = name;
  if (topSubtitleDriverName) topSubtitleDriverName.textContent = name;
  if (welcomeDriverName) welcomeDriverName.textContent = name;
  if (settingsProfileName) settingsProfileName.textContent = name;

  if (pageData && pageData.dashboard) {
    pageData.dashboard.subtitle = `Welcome back, ${name}. Here's your trip status for today.`;
  }
  const pageSub = document.getElementById("pageSubtitle");
  const activeSec = document.querySelector(".dashboard-section.active-section");
  if (pageSub && (!activeSec || activeSec.id === "dashboard")) {
    pageSub.innerHTML = `Welcome back, <strong>${name}</strong>. Here's your trip status for today.`;
  }
}

// ================================
// ATTENDANCE LOGIC
// ================================
function checkTodayAttendance() {
  const uid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid") || "driver_sunil";
  const today = new Date().toISOString().split("T")[0];

  let isMarked = false;
  let markedRecord = null;

  try {
    const localAtt = JSON.parse(localStorage.getItem("smartbus_attendance") || "{}");
    if (localAtt[`${uid}_${today}`]) {
      isMarked = true;
      markedRecord = localAtt[`${uid}_${today}`];
    }
  } catch (e) {}

  updateAttendanceUI(isMarked, markedRecord);

  // Also verify with cloud RTDB if connected
  if (db && typeof db.ref === "function") {
    try {
      db.ref(`attendance/${uid}_${today}`).once("value", (snap) => {
        const val = snap.val();
        if (val) {
          updateAttendanceUI(true, val);
        }
      });
    } catch (e) {}
  }
}

function openLocationShareModal() {
  const modal = document.getElementById("locationShareModal");
  if (!modal) return;

  const driverName = (currentProfile && currentProfile.name) || sessionStorage.getItem("driverName") || "Sunil Shinde";
  const busNo = assignedBus || "Not assigned";
  const routeName = (assignedRouteDoc && assignedRouteDoc.name) || assignedRoute || "Not assigned";

  const nameEl = document.getElementById("modalDriverName");
  const busEl = document.getElementById("modalBusNo");
  const routeEl = document.getElementById("modalRouteName");

  if (nameEl) nameEl.textContent = driverName;
  if (busEl) busEl.textContent = busNo;
  if (routeEl) routeEl.textContent = routeName;

  modal.style.display = "flex";
}

function closeLocationShareModal() {
  const modal = document.getElementById("locationShareModal");
  if (modal) modal.style.display = "none";
}

function startDuty() {
  if (isDutyActive) return;
  openLocationShareModal();
}

function updateAttendanceUI(isMarked, record = null) {
  todayAttendanceMarked = isMarked;

  const attStatBadge = document.getElementById("attendanceStatBadge");
  const attStatText = document.getElementById("attendanceStatText");
  const attPageStatusText = document.getElementById("attendancePageStatusText");
  const attPageIcon = document.getElementById("attendancePageIcon");
  const markBtn = document.getElementById("markAttendanceBtn");
  const qMarkBtn = document.getElementById("quickMarkBtn");
  const dashStartBtn = document.getElementById("dashStartTripBtn");
  const settingsAtt = document.getElementById("settingsAttendanceStatus");

  if (isMarked) {
    let timeStr = "Today";
    if (record && record.markedAt) {
      timeStr = new Date(record.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    }

    if (attStatBadge) {
      attStatBadge.textContent = "Present";
      attStatBadge.className = "stat-status green-text";
    }
    if (attStatText) attStatText.textContent = "Marked Present";
    if (attPageStatusText) attPageStatusText.textContent = `Present · Marked today at ${timeStr}`;
    if (attPageIcon) {
      attPageIcon.style.background = "#dcfce7";
      attPageIcon.style.color = "#16a34a";
    }
    if (markBtn) {
      if (hasLiveGpsFix) {
        markBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Sharing GPS Live';
        markBtn.style.background = "#16a34a";
      } else if (isDutyActive) {
        markBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Waiting for Real GPS';
        markBtn.style.background = "";
      } else {
        markBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Present · Start GPS Sharing';
        markBtn.style.background = "";
      }
      markBtn.disabled = false;
    }
    if (qMarkBtn) {
      if (hasLiveGpsFix) {
        qMarkBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Sharing GPS Live';
        qMarkBtn.style.background = "#16a34a";
      } else if (isDutyActive) {
        qMarkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Waiting for Real GPS';
        qMarkBtn.style.background = "";
      } else {
        qMarkBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Present · Start GPS Sharing';
        qMarkBtn.style.background = "";
      }
      qMarkBtn.disabled = false;
    }
    if (dashStartBtn && !isDutyActive) {
      dashStartBtn.style.display = "inline-flex";
    }
    if (settingsAtt) {
      settingsAtt.textContent = `Present (${timeStr})`;
      settingsAtt.style.color = "#16a34a";
    }
  } else {
    if (attStatBadge) {
      attStatBadge.textContent = "Not Marked";
      attStatBadge.className = "stat-status";
    }
    if (attStatText) attStatText.textContent = "Pending";
    if (attPageStatusText) attPageStatusText.textContent = "Not Marked Yet";
    if (attPageIcon) {
      attPageIcon.style.background = "";
      attPageIcon.style.color = "";
    }
    if (markBtn) {
      markBtn.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Mark Attendance';
      markBtn.disabled = false;
      markBtn.style.background = "";
    }
    if (qMarkBtn) {
      qMarkBtn.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Mark Attendance';
      qMarkBtn.disabled = false;
      qMarkBtn.style.background = "";
    }
    if (dashStartBtn) dashStartBtn.style.display = "none";
    if (settingsAtt) {
      settingsAtt.textContent = "Pending";
      settingsAtt.style.color = "#ea580c";
    }
  }
}

async function markAttendanceForToday(showPopup = true) {
  const uid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid") || "driver_sunil";
  if (todayAttendanceMarked) {
    if (showPopup && !isDutyActive) await beginDuty();
    return;
  }

  const driverName = (currentProfile && currentProfile.name) || sessionStorage.getItem("driverName") || "Driver";
  const today = new Date().toISOString().split("T")[0];
  const now = Date.now();
  const timeStr = new Date(now).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const attRecord = {
    driverUid: uid,
    driverName: driverName,
    busNo: assignedBus || "Not assigned",
    routeId: assignedRoute || "Not assigned",
    date: today,
    markedAt: now,
    status: "Present",
    shiftLogId: `${uid}_${now}`,
  };

  // 1. Save to localStorage immediately
  try {
    const localAtt = JSON.parse(localStorage.getItem("smartbus_attendance") || "{}");
    localAtt[`${uid}_${today}`] = attRecord;
    localStorage.setItem("smartbus_attendance", JSON.stringify(localAtt));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {}

  // 2. Sync to Firebase RTDB
  try {
    if (typeof markAttendance === "function") {
      await markAttendance(uid, assignedBus, assignedRoute);
    }
  } catch (e) {
    console.warn("RTDB mark attendance notice:", e.message);
  }

  // 3. Update UI
  updateAttendanceUI(true, attRecord);
  loadShiftDutyHistory();

  // 4. Start live GPS sharing from the attendance action
  if (showPopup) {
    if (!isDutyActive) {
      await beginDuty();
    } else {
      alert(`✓ Attendance Marked!\n\nDriver: ${driverName}\nStatus: PRESENT\n(Live GPS Location Sharing is already active)`);
    }
  }
}

// ================================
// GPS DUTY STATE MACHINE & REAL-TIME BROADCAST
// ================================
async function beginDuty({ restore = false } = {}) {
  if (isDutyActive) return;

  const activeUid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid") || "driver_sunil";
  const authenticatedUid = auth && auth.currentUser && auth.currentUser.uid;
  if (!authenticatedUid || authenticatedUid !== activeUid) {
    showGpsError("A Firebase-authenticated driver account is required to share live location across devices. Sign out and sign in with the driver account created by the Admin.");
    return;
  }

  if (!assignedBus) {
    alert("No bus assigned to your account. Please contact the Transport Administrator to assign a bus.");
    return;
  }

  clearGpsError();

  if (!navigator.geolocation) {
    showGpsError("Device location is unavailable. Open this dashboard over HTTPS on a device/browser that supports GPS location.");
    return;
  }

  if (!db || typeof db.ref !== "function") {
    showGpsError("Live passenger tracking is unavailable because the Firebase Realtime Database is not connected. Check your internet connection and try again.");
    return;
  }

  // Pre-check if another driver/device is already sharing this bus
  if (db && typeof db.ref === "function") {
    try {
      const busSnap = await db.ref(`buses/${assignedBus}`).once("value");
      const busVal = busSnap.val() || {};
      const activeUid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid");
      if (busVal.sharing === true && busVal.currentDriver && busVal.currentDriver !== activeUid) {
        const locSnap = await db.ref(`locations/${assignedBus}`).once("value");
        const locVal = locSnap.val();
        const serverNow = typeof getServerNow === "function" ? getServerNow() : Date.now();
        if (locVal && locVal.ts && serverNow - Number(locVal.ts) < 30000) {
          showGpsError(`Bus <strong>${assignedBus}</strong> is already being actively driven by another device. Only one driver can share at a time.`);
          return;
        }
      }
    } catch (chkErr) {
      showGpsError(getRealtimeDatabaseErrorMessage(chkErr));
      return;
    }
  }

  isDutyActive = true;
  hasLiveGpsFix = false;

  // 1. Automatically mark attendance for today if not already marked
  if (!restore && !todayAttendanceMarked) {
    try {
      await markAttendanceForToday(false);
    } catch (attErr) {
      console.warn("Auto attendance notice:", attErr.message);
    }
  }
  updateAttendanceUI(todayAttendanceMarked);

  const savedDuty = readActiveDuties()[activeUid];
  const shiftStartedAt = restore && savedDuty && savedDuty.startedAt ? savedDuty.startedAt : Date.now();
  const nowStr = new Date(shiftStartedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (dutyShiftStart) dutyShiftStart.textContent = nowStr;

  // 2. Request Screen Wake Lock
  await requestScreenWakeLock();

  // 3. Mark bus sharing=true in Firebase RTDB & localStorage
  try {
    await db.ref(`locations/${assignedBus}/ts`).set(0);
    try {
      const locs = JSON.parse(localStorage.getItem("smartbus_locations") || "{}");
      if (locs[assignedBus]) {
        locs[assignedBus].ts = 0;
        localStorage.setItem("smartbus_locations", JSON.stringify(locs));
        window.dispatchEvent(new Event("storage"));
      }
    } catch (storageErr) {
      console.warn("Local location cache reset notice:", storageErr.message);
    }
    if (typeof startSharing === "function") {
      await startSharing(assignedBus, null, activeUid);
    }
    saveActiveDuty(activeUid, assignedBus);
  } catch (shareErr) {
    showGpsError(getRealtimeDatabaseErrorMessage(shareErr));
    isDutyActive = false;
    hasLiveGpsFix = false;
    updateAttendanceUI(todayAttendanceMarked);
    return;
  }

  // 4. Update UI to Active Sharing state
  if (startDutyBtn) startDutyBtn.style.display = "none";
  if (endDutyBtn) endDutyBtn.style.display = "inline-flex";
  if (dashStartTripBtn) dashStartTripBtn.style.display = "none";
  if (broadcastStatusBanner) broadcastStatusBanner.style.display = "none";

  if (gpsStatusBadge) {
    gpsStatusBadge.style.background = "#dbeafe";
    gpsStatusBadge.style.color = "#1e40af";
    gpsStatusBadge.innerHTML = `<span style="width:8px; height:8px; background:#2563eb; border-radius:50%; display:inline-block;"></span> Waiting for Device GPS Fix`;
  }

  if (tripLiveIndicator) tripLiveIndicator.style.display = "none";
  if (tripBadge) tripBadge.style.display = "none";
  if (tripStatBadge) {
    tripStatBadge.textContent = "On Duty";
    tripStatBadge.className = "stat-status green-text";
  }
  if (tripStatText) tripStatText.textContent = "Waiting for GPS Fix";
  if (tripStatIcon) tripStatIcon.classList.add("running");
  if (dashTripStatusText) dashTripStatusText.textContent = `On Duty · Bus ${assignedBus}`;
  if (dashTripIcon) dashTripIcon.classList.add("running");

  // 5. Start real GPS watch with maximum accuracy
  lastSentTime = 0;
  lastSentLat = null;
  lastSentLng = null;
  lastPosTime = null;
  lastPosLat = null;
  lastPosLng = null;

  geoWatchId = navigator.geolocation.watchPosition(
    onGpsUpdate,
    onGpsError,
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000,
    }
  );

  // Interval updating the "Last sent: Ns ago" ticker
  if (lastSentTickerInterval) clearInterval(lastSentTickerInterval);
  lastSentTickerInterval = setInterval(updateLastSentUI, 1000);
}

async function endDuty() {
  if (!isDutyActive) return;

  isDutyActive = false;
  hasLiveGpsFix = false;
  const activeUid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid") || "driver_sunil";
  try {
    clearSavedActiveDuty(activeUid);
  } catch (storageErr) {
    console.warn("Could not clear saved duty state:", storageErr.message);
  }
  updateAttendanceUI(todayAttendanceMarked);

  // 2. Stop geolocation watch
  if (geoWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geoWatchId);
    geoWatchId = null;
  }

  // 3. Release wake lock
  await releaseScreenWakeLock();

  if (lastSentTickerInterval) {
    clearInterval(lastSentTickerInterval);
    lastSentTickerInterval = null;
  }

  // 4. Stop sharing in RTDB and localStorage
  try {
    if (typeof stopSharing === "function") {
      await stopSharing(assignedBus, currentShiftLogId);
    }
  } catch (stopErr) {
    console.warn("stopSharing notice:", stopErr.message);
  }

  // 5. Update UI to Duty Ended state
  if (endDutyBtn) endDutyBtn.style.display = "none";
  if (startDutyBtn) startDutyBtn.style.display = "inline-flex";
  if (broadcastStatusBanner) broadcastStatusBanner.style.display = "none";

  const localAtt = JSON.parse(localStorage.getItem("smartbus_attendance") || "{}");
  const uid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid") || "driver_sunil";
  const today = new Date().toISOString().split("T")[0];
  if (localAtt[`${uid}_${today}`] && dashStartTripBtn) {
    dashStartTripBtn.style.display = "inline-flex";
  }

  if (gpsStatusBadge) {
    gpsStatusBadge.style.background = "#f1f5f9";
    gpsStatusBadge.style.color = "#475569";
    gpsStatusBadge.innerHTML = `<span style="width:8px; height:8px; background:#94a3b8; border-radius:50%; display:inline-block;"></span> Duty Ended`;
  }

  if (dutyGpsSpeed) dutyGpsSpeed.textContent = "0.0 km/h";
  if (dutyGpsAccuracy) dutyGpsAccuracy.textContent = "--";
  if (tripLiveIndicator) tripLiveIndicator.style.display = "none";
  if (tripBadge) tripBadge.style.display = "none";

  if (tripStatBadge) {
    tripStatBadge.textContent = "Ended";
    tripStatBadge.className = "stat-status";
  }
  if (tripStatText) tripStatText.textContent = "Duty Ended";
  if (tripStatIcon) tripStatIcon.classList.remove("running");
  if (dashTripStatusText) dashTripStatusText.textContent = "Duty Completed";
  if (dashTripIcon) dashTripIcon.classList.remove("running");

  if (driverMarker) {
    driverMarker.setPopupContent(`<strong>${assignedBus || "Your Bus"}</strong><br>Duty Ended (Offline)`);
  }
}

// GPS Update Handler with accuracy rejection and throttling
async function onGpsUpdate(position) {
  if (!isDutyActive) return;

  const coords = position.coords;
  const accuracy = coords.accuracy;

  // Reject poor readings: ignore positions with accuracy > 100 m
  if (accuracy > 100) {
    hasLiveGpsFix = false;
    if (tripLiveIndicator) tripLiveIndicator.style.display = "none";
    if (tripBadge) tripBadge.style.display = "none";
    if (broadcastStatusBanner) broadcastStatusBanner.style.display = "none";
    updateAttendanceUI(todayAttendanceMarked);
    if (dutyGpsAccuracy) {
      dutyGpsAccuracy.innerHTML = `<span style="color:#dc2626;">±${Math.round(accuracy)}m (Weak)</span>`;
    }
    if (gpsStatusBadge) {
      gpsStatusBadge.style.background = "#fef3c7";
      gpsStatusBadge.style.color = "#92400e";
      gpsStatusBadge.innerHTML = `<span style="width:8px; height:8px; background:#f59e0b; border-radius:50%; display:inline-block;"></span> Weak GPS Signal (±${Math.round(accuracy)}m > 100m) - Point Ignored`;
    }
    if (tripStatText) tripStatText.textContent = "Waiting for Accurate GPS";
    return;
  }

  clearGpsError();

  if (dutyGpsAccuracy) {
    dutyGpsAccuracy.innerHTML = `<span style="color:#16a34a; font-weight:700;">±${Math.round(accuracy)}m</span>`;
  }

  let speedMs = 0;
  if (coords.speed != null && !isNaN(coords.speed) && coords.speed >= 0) {
    speedMs = Number(coords.speed);
  } else if (lastPosLat != null && lastPosLng != null && lastPosTime != null) {
    const dtSec = (Date.now() - lastPosTime) / 1000;
    const distKm = haversineDistanceKm(lastPosLat, lastPosLng, coords.latitude, coords.longitude);
    if (dtSec > 0) speedMs = (distKm * 1000) / dtSec;
  }

  lastPosLat = coords.latitude;
  lastPosLng = coords.longitude;
  lastPosTime = Date.now();

  const speedKmH = (speedMs * 3.6).toFixed(1);
  if (dutyGpsSpeed) dutyGpsSpeed.textContent = `${speedKmH} km/h`;

  if (driverMarker) {
    driverMarker.setLatLng([coords.latitude, coords.longitude]);
    driverMarker.setPopupContent(
      `<strong>${assignedBus}</strong><br>Real GPS Speed: ${speedKmH} km/h<br>Accuracy: ±${Math.round(accuracy)}m`
    );
  }

  if (!navigator.onLine) {
    hasLiveGpsFix = false;
    if (tripLiveIndicator) tripLiveIndicator.style.display = "none";
    if (tripBadge) tripBadge.style.display = "none";
    if (broadcastStatusBanner) broadcastStatusBanner.style.display = "none";
    updateAttendanceUI(todayAttendanceMarked);
    showGpsError("No internet connection. Your real GPS location has not been sent to passengers; sharing will resume when the connection returns.");
    return;
  }

  const now = Date.now();
  const timeSinceLastSend = now - lastSentTime;
  let distFromLastSent = Infinity;

  if (lastSentLat != null && lastSentLng != null) {
    distFromLastSent = haversineDistanceKm(lastSentLat, lastSentLng, coords.latitude, coords.longitude) * 1000;
  }

  const shouldSend = timeSinceLastSend >= 3000 && (distFromLastSent >= 5 || timeSinceLastSend >= 10000);

  if (shouldSend && !isLocationWritePending) {
    const payload = {
      lat: Number(coords.latitude),
      lng: Number(coords.longitude),
      speed: Number(speedMs),
      heading: coords.heading != null && !isNaN(coords.heading) ? Number(coords.heading) : null,
      accuracy: Math.round(accuracy),
      ts: typeof serverTimestamp === "function" ? serverTimestamp() : (typeof firebase !== "undefined" && firebase.database ? firebase.database.ServerValue.TIMESTAMP : now),
    };

    isLocationWritePending = true;
    try {
      await db.ref(`locations/${assignedBus}`).set(payload);
      if (!isDutyActive) return;

      lastSentTime = now;
      lastSentLat = coords.latitude;
      lastSentLng = coords.longitude;
      hasLiveGpsFix = true;
      updateLastSentUI();

      try {
        const locs = JSON.parse(localStorage.getItem("smartbus_locations") || "{}");
        locs[assignedBus] = { ...payload, ts: now };
        localStorage.setItem("smartbus_locations", JSON.stringify(locs));
        window.dispatchEvent(new Event("storage"));
      } catch (storageErr) {
        console.warn("Local location cache notice:", storageErr.message);
      }

      if (gpsStatusBadge) {
        gpsStatusBadge.style.background = "#dcfce7";
        gpsStatusBadge.style.color = "#166534";
        gpsStatusBadge.innerHTML = `<span style="width:8px; height:8px; background:#22c55e; border-radius:50%; display:inline-block;"></span> Real GPS Shared with Passengers`;
      }
      if (tripLiveIndicator) tripLiveIndicator.style.display = "inline-block";
      if (tripBadge) tripBadge.style.display = "inline-block";
      if (broadcastStatusBanner) broadcastStatusBanner.style.display = "flex";
      if (tripStatText) tripStatText.textContent = "Sharing Real GPS";
      updateAttendanceUI(todayAttendanceMarked);
    } catch (err) {
      hasLiveGpsFix = false;
      if (tripLiveIndicator) tripLiveIndicator.style.display = "none";
      if (tripBadge) tripBadge.style.display = "none";
      if (broadcastStatusBanner) broadcastStatusBanner.style.display = "none";
      updateAttendanceUI(todayAttendanceMarked);
      showGpsError(`Real GPS location could not be sent to passengers. ${getRealtimeDatabaseErrorMessage(err)}`);
      console.error("Realtime Database location write failed:", err);
    } finally {
      isLocationWritePending = false;
    }
  }
}

async function onGpsError(err) {
  if (!isDutyActive) return;
  hasLiveGpsFix = false;
  if (tripLiveIndicator) tripLiveIndicator.style.display = "none";
  if (tripBadge) tripBadge.style.display = "none";
  if (broadcastStatusBanner) broadcastStatusBanner.style.display = "none";
  updateAttendanceUI(todayAttendanceMarked);

  switch (err.code) {
    case 1:
      await endDuty();
      showGpsError(
        "<strong>Location Permission Denied.</strong><br>No location was shared. Allow Location in your browser's site settings, then start duty again."
      );
      break;
    case 2:
      showGpsError(
        "<strong>GPS Position Unavailable.</strong><br>Make sure Location Services / GPS is turned ON in your mobile phone settings."
      );
      break;
    case 3:
      showGpsError(
        "<strong>GPS Signal Timeout.</strong><br>Acquiring satellite signal timed out. Please step into an open area or ensure your device has a clear view of the sky."
      );
      break;
    default:
      showGpsError(`GPS Error: ${err.message || "Unknown error occurred while acquiring GPS."}`);
      break;
  }
}

// ================================
// DRIVER PROFILE & ASSIGNMENT LOADING
// ================================
function syncDriverAssignment() {
  seedDefaultsIfEmpty();

  const uid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid") || "driver_sunil";

  let localDrivers = {};
  let localBuses = {};
  let localRoutes = {};
  try {
    localDrivers = JSON.parse(localStorage.getItem("smartbus_drivers") || "{}");
    localBuses = JSON.parse(localStorage.getItem("smartbus_buses") || "{}");
    localRoutes = JSON.parse(localStorage.getItem("smartbus_routes") || "{}");
  } catch (e) {}

  // Find driver object by UID, email, or session name
  let myDriver = localDrivers[uid];
  if (!myDriver && currentUser && currentUser.email) {
    myDriver = Object.values(localDrivers).find(
      (d) => (d.email || "").toLowerCase() === currentUser.email.toLowerCase()
    );
  }
  if (!myDriver && currentProfile && currentProfile.name) {
    myDriver = Object.values(localDrivers).find(
      (d) => (d.name || "").toLowerCase() === currentProfile.name.toLowerCase()
    );
  }
  if (!myDriver && sessionStorage.getItem("driverName")) {
    const sName = sessionStorage.getItem("driverName").toLowerCase();
    myDriver = Object.values(localDrivers).find(
      (d) => (d.name || "").toLowerCase() === sName
    );
  }
  if (!myDriver) myDriver = DEFAULT_KOLHAPUR_DRIVERS[uid] || null;

  // Update driver name everywhere
  const driverName = (myDriver && myDriver.name) || (currentProfile && currentProfile.name) || sessionStorage.getItem("driverName") || "Sunil Shinde";
  updateDriverNameUI(driverName);

  // Resolve assigned bus
  const profileHasBus = currentProfile && Object.prototype.hasOwnProperty.call(currentProfile, "assignedBus");
  let newBus = profileHasBus ? currentProfile.assignedBus : (myDriver && myDriver.assignedBus) || null;
  if (!newBus && !profileHasBus) {
    const matchingBus = Object.values(localBuses).find(
      (b) => b.assignedDriver === uid || (myDriver && b.assignedDriver === myDriver.uid)
    );
    if (matchingBus) newBus = matchingBus.busNo;
  }
  if (!newBus && !profileHasBus && sessionStorage.getItem("driverAssignedBus")) {
    newBus = sessionStorage.getItem("driverAssignedBus");
  }

  // Resolve assigned route
  const profileHasRoute = currentProfile && Object.prototype.hasOwnProperty.call(currentProfile, "assignedRoute");
  let newRoute = profileHasRoute ? currentProfile.assignedRoute : (myDriver && myDriver.assignedRoute) || null;
  if (!newRoute && newBus && localBuses[newBus] && localBuses[newBus].routeId) {
    newRoute = localBuses[newBus].routeId;
  }
  if (!newRoute && !profileHasRoute && sessionStorage.getItem("driverAssignedRoute")) {
    newRoute = sessionStorage.getItem("driverAssignedRoute");
  }
  assignedBus = newBus;
  assignedRoute = newRoute;

  if (assignedBus) sessionStorage.setItem("driverAssignedBus", assignedBus);
  else sessionStorage.removeItem("driverAssignedBus");
  if (assignedRoute) sessionStorage.setItem("driverAssignedRoute", assignedRoute);
  else sessionStorage.removeItem("driverAssignedRoute");

  updateDutyLabels();

  // Populate Route Documentation and Map
  if (assignedRoute && localRoutes[assignedRoute]) {
    assignedRouteDoc = localRoutes[assignedRoute];
    const rName = assignedRouteDoc.name || assignedRoute;
    if (dutyAssignedRoute) dutyAssignedRoute.textContent = rName;
    if (statRouteName) statRouteName.textContent = rName;
    renderRouteStops(assignedRouteDoc.stops || []);
    drawAssignedRouteOnMap();
  } else if (assignedRoute) {
    if (dutyAssignedRoute) dutyAssignedRoute.textContent = assignedRoute;
    if (statRouteName) statRouteName.textContent = assignedRoute;
  }

  // Update Settings tab profile fields
  if (settingsDriverUid) settingsDriverUid.textContent = uid;
  if (settingsDriverEmail) settingsDriverEmail.textContent = (myDriver && myDriver.email) || sessionStorage.getItem("driverEmail") || "sunil.driver@smartbus.com";
  if (settingsDriverPhone) settingsDriverPhone.textContent = (myDriver && myDriver.phone) || sessionStorage.getItem("driverPhone") || "9876543210";
  if (settingsAssignedBus) settingsAssignedBus.textContent = assignedBus || "Not assigned";
  if (settingsAssignedRoute) settingsAssignedRoute.textContent = (assignedRouteDoc && assignedRouteDoc.name) || assignedRoute || "Not assigned";

  // Check today's attendance status
  checkTodayAttendance();
}

function loadDriverAssignment(user, profile) {
  currentUser = user;
  currentProfile = profile;

  if (profile && profile.name) {
    updateDriverNameUI(profile.name);
  }

  // Initial local sync
  syncDriverAssignment();

  // Cross-tab and same-tab periodic sync
  window.addEventListener("storage", () => syncDriverAssignment());
  setInterval(syncDriverAssignment, 2000);

  // Check if admin has assigned another bus (or multiple buses)
  const allowedBuses = profile?.assignedBuses || (profile?.assignedBus ? [profile.assignedBus] : []);
  if (Array.isArray(allowedBuses) && allowedBuses.length > 1) {
    if (switchBusSection && switchBusSelect) {
      switchBusSection.style.display = "block";
      switchBusSelect.innerHTML = allowedBuses
        .map((b) => `<option value="${b}" ${b === assignedBus ? "selected" : ""}>${b}</option>`)
        .join("");
    }
  } else if (switchBusSection) {
    switchBusSection.style.display = "none";
  }

  // Cloud RTDB listener if available
  if (db && typeof db.ref === "function") {
    try {
      if (assignedRoute) {
        db.ref(`routes/${assignedRoute}`).on("value", (snap) => {
          const val = snap.val();
          if (val) {
            assignedRouteDoc = val;
            if (dutyAssignedRoute) dutyAssignedRoute.textContent = assignedRouteDoc.name || assignedRoute;
            if (statRouteName) statRouteName.textContent = assignedRouteDoc.name || assignedRoute;
            renderRouteStops(assignedRouteDoc.stops || []);
            drawAssignedRouteOnMap();
          }
        });
      }

      db.ref(`users/${user.uid}`).on("value", (snap) => {
        const updated = snap.val();
        if (!updated) return;
        currentProfile = { ...(currentProfile || {}), ...updated };
        if (updated.name) updateDriverNameUI(updated.name);
        syncDriverAssignment();
      });
    } catch (e) {
      console.warn("RTDB driver sync notice:", e.message);
    }
  }

  // Listen to shift duty history
  loadShiftDutyHistory();
  claimDriverSession(user)
    .then(() => restoreActiveDuty(user))
    .catch(async (sessionErr) => {
      console.error("Could not verify the active driver login session:", sessionErr);
      showGpsError(sessionErr.message || "Could not verify this driver's device session.");
      if (sessionErr.code === "driver-session-active") {
        try {
          await auth.signOut();
        } catch (signOutErr) {
          console.warn("Could not end duplicate driver login:", signOutErr.message);
        }
        window.location.replace("driver-login.html");
      }
    });
}

async function restoreActiveDuty(user) {
  if (isDutyRestoreStarted) return;
  const driverUid = user && user.uid;
  if (!driverUid) return;

  const savedDuty = readActiveDuties()[driverUid];
  if (!savedDuty || !savedDuty.busNo) return;
  isDutyRestoreStarted = true;

  if (savedDuty.busNo !== assignedBus) {
    console.warn("Saved duty belongs to a different bus assignment; not restoring it.");
    return;
  }

  if (auth && auth.currentUser && auth.currentUser.uid !== driverUid) {
    console.warn("Saved duty belongs to a different authenticated driver; not restoring it.");
    return;
  }

  try {
    await beginDuty({ restore: true });
    if (!isDutyActive) isDutyRestoreStarted = false;
  } catch (restoreErr) {
    console.error("Could not restore active duty after page reload:", restoreErr);
    isDutyRestoreStarted = false;
  }
}

function updateDutyLabels() {
  if (dutyAssignedBus) dutyAssignedBus.textContent = assignedBus || "No bus assigned";
  if (statBusNumber) statBusNumber.textContent = assignedBus || "Not assigned";
  if (driverBusLabel) driverBusLabel.textContent = assignedBus ? `Driver · ${assignedBus}` : "Driver";

  const welcomeSub = document.getElementById("welcomeBannerSub");
  if (welcomeSub && assignedBus && assignedRouteDoc) {
    welcomeSub.innerHTML = `Assigned Bus: <strong style="color:#2563eb;">${assignedBus}</strong> &middot; Route: <strong style="color:#2563eb;">${assignedRouteDoc.name || assignedRoute}</strong>`;
  }

  if (driverMarker) {
    driverMarker.setPopupContent(`<strong>${assignedBus || "Your Bus"}</strong><br>GPS Standby`);
  }
}

function renderRouteStops(stops) {
  const preview = document.getElementById("routePreviewList");
  const list = document.getElementById("routeStopsList");
  const routeName = (assignedRouteDoc && assignedRouteDoc.name) || "Assigned Route";
  const routeCode = (assignedRouteDoc && assignedRouteDoc.routeCode) || "KLP-01";

  const previewTitle = document.getElementById("routePreviewTitle");
  const pageRouteTitle = document.getElementById("routePageTitle");
  if (previewTitle) previewTitle.textContent = `${routeName} · ${stops.length} stop${stops.length === 1 ? "" : "s"}`;
  if (pageRouteTitle) pageRouteTitle.textContent = `${routeName} · Stops assigned to your bus today.`;

  if (routeCardName) routeCardName.textContent = routeName;
  if (routeCardCode) routeCardCode.textContent = routeCode;
  if (routeCardBus) routeCardBus.textContent = assignedBus || "Not assigned";
  if (routeCardStopsCount) routeCardStopsCount.textContent = `${stops.length} Stops`;

  if (preview) {
    preview.innerHTML =
      stops.length === 0
        ? '<p style="padding:16px; opacity:0.6;">Your route stops will appear here once assigned by Admin.</p>'
        : stops
            .slice(0, 5)
            .map(
              (stop, i) => `
          <div class="bus-status-item">
            <div class="bus-small-icon"><i class="fa-solid fa-location-dot"></i></div>
            <div class="bus-info">
              <strong>${stop.name}</strong>
              <span>${i === 0 ? "First Stop (Departure)" : i === stops.length - 1 ? "Final Destination" : "Stop " + (i + 1)}</span>
            </div>
          </div>
        `
            )
            .join("");
  }

  if (list) {
    list.innerHTML =
      stops.length === 0
        ? '<p style="opacity:0.6;">No stops assigned yet.</p>'
        : stops
            .map((stop, i) => {
              const isEndpoint = i === 0 || i === stops.length - 1;
              const label = i === 0 ? "First Stop · Departure Point" : i === stops.length - 1 ? "Last Stop · Destination" : `Stop #${i + 1}`;
              const badgeBg = i === 0 ? "#dcfce7" : i === stops.length - 1 ? "#fee2e2" : "#eff6ff";
              const badgeColor = i === 0 ? "#166534" : i === stops.length - 1 ? "#991b1b" : "#1e40af";
              return `
          <div class="route-stop-item" style="display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 16px; border-bottom:1px solid #f1f5f9;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="stop-order" style="width:32px; height:32px; background:${i === 0 ? "#16a34a" : i === stops.length - 1 ? "#dc2626" : "#2563eb"}; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">${i + 1}</div>
              <div class="stop-info">
                <strong style="font-size:14px; color:#1e293b;">${stop.name}</strong>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">Lat: ${Number(stop.lat).toFixed(4)}, Lng: ${Number(stop.lng).toFixed(4)}</div>
              </div>
            </div>
            <span style="padding:4px 10px; border-radius:12px; font-size:11px; font-weight:700; background:${badgeBg}; color:${badgeColor}; white-space:nowrap;">
              ${label}
            </span>
          </div>
        `;
            })
            .join("");
  }
}

// Switch bus button click
if (switchBusBtn && switchBusSelect) {
  switchBusBtn.addEventListener("click", async () => {
    const selectedBus = switchBusSelect.value;
    if (!selectedBus || selectedBus === assignedBus) return;
    try {
      if (typeof switchBus === "function") {
        await switchBus(currentUser?.uid || sessionStorage.getItem("driverUid"), assignedBus, selectedBus);
      }
      assignedBus = selectedBus;
      updateDutyLabels();
      alert(`Switched active bus to ${selectedBus}`);
    } catch (err) {
      alert(err.message);
    }
  });
}

// ================================
// SHIFT & ATTENDANCE HISTORY LISTENER
// Merges local and cloud history
// ================================
function loadShiftDutyHistory() {
  const uid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid") || "driver_sunil";

  // 1. Render from localStorage immediately
  try {
    const localShifts = JSON.parse(localStorage.getItem("smartbus_shiftLogs") || "{}");
    const myShifts = Object.values(localShifts)
      .filter((s) => s.driverUid === uid || !s.driverUid)
      .sort((a, b) => Number(b.startTime || 0) - Number(a.startTime || 0))
      .slice(0, 5);

    renderRecentTripsTable(myShifts);

    const localAtt = JSON.parse(localStorage.getItem("smartbus_attendance") || "{}");
    const myAtt = Object.values(localAtt)
      .filter((a) => a.driverUid === uid || !a.driverUid)
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || Number(b.markedAt || 0) - Number(a.markedAt || 0))
      .slice(0, 15);

    renderAttendanceHistoryTable(myAtt);
  } catch (e) {}

  // 2. Listen to Cloud RTDB if connected
  if (db && typeof db.ref === "function") {
    try {
      db.ref("shiftLogs")
        .orderByChild("driverUid")
        .equalTo(uid)
        .on("value", (snap) => {
          const val = snap.val() || {};
          const logs = Object.values(val)
            .sort((a, b) => Number(b.startTime || 0) - Number(a.startTime || 0))
            .slice(0, 5);
          if (logs.length > 0) renderRecentTripsTable(logs);
        });

      db.ref("attendance")
        .orderByChild("driverUid")
        .equalTo(uid)
        .on("value", (snap) => {
          const val = snap.val() || {};
          const atts = Object.values(val)
            .sort((a, b) => (b.date || "").localeCompare(a.date || "") || Number(b.markedAt || 0) - Number(a.markedAt || 0))
            .slice(0, 15);
          if (atts.length > 0) renderAttendanceHistoryTable(atts);
        });
    } catch (e) {}
  }
}

function renderRecentTripsTable(logs) {
  const tbody = document.getElementById("driverRecentTripsBody");
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.6; padding:20px;">No shift logs recorded yet. Start duty to begin logging.</td></tr>';
    return;
  }

  tbody.innerHTML = logs
    .map((l) => {
      const date = l.date || (l.startTime ? new Date(l.startTime).toLocaleDateString("en-IN") : "Today");
      const startStr = l.startTime ? new Date(l.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--";
      const endStr = l.endTime ? new Date(l.endTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : (l.status === "active" ? "--" : "Ended");
      const isAct = l.status === "active";
      return `
        <tr>
          <td>${date}</td>
          <td>${l.busNo || assignedBus || "-"}</td>
          <td>${startStr}</td>
          <td>${endStr}</td>
          <td><span class="table-status ${isAct ? "running" : "completed"}">${isAct ? "Active Duty" : "Completed"}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderAttendanceHistoryTable(atts) {
  const tbody = document.getElementById("attendanceHistoryBody");
  if (!tbody) return;

  if (!atts || atts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; opacity:0.6; padding:20px;">No attendance records yet. Click "Mark Attendance" above.</td></tr>';
    return;
  }

  tbody.innerHTML = atts
    .map((a) => {
      const time = a.markedAt ? new Date(a.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--";
      return `
        <tr>
          <td>${a.date}</td>
          <td>${time}</td>
          <td>${a.busNo || assignedBus || "-"}</td>
          <td><span class="table-status completed">Present</span></td>
        </tr>
      `;
    })
    .join("");
}

// ================================
// EVENT LISTENERS
// ================================
if (startDutyBtn) startDutyBtn.addEventListener("click", startDuty);
if (endDutyBtn) endDutyBtn.addEventListener("click", endDuty);
if (modalAllowShareBtn) {
  modalAllowShareBtn.addEventListener("click", async () => {
    closeLocationShareModal();
    await beginDuty();
  });
}
if (modalCancelShareBtn) modalCancelShareBtn.addEventListener("click", closeLocationShareModal);
if (modalCloseXBtn) modalCloseXBtn.addEventListener("click", closeLocationShareModal);

if (markAttendanceBtn) {
  markAttendanceBtn.addEventListener("click", () => markAttendanceForToday(true));
}
if (quickMarkBtn) {
  quickMarkBtn.addEventListener("click", () => markAttendanceForToday(true));
}
if (dashStartTripBtn) {
  dashStartTripBtn.addEventListener("click", () => {
    showSection("trip");
    startDuty();
  });
}

if (settingsRefreshBtn) {
  settingsRefreshBtn.addEventListener("click", () => {
    syncDriverAssignment();
    checkTodayAttendance();
    loadShiftDutyHistory();
    alert("✓ Driver profile and duty assignments refreshed successfully.");
  });
}

if (settingsLogoutBtn) {
  settingsLogoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (isDutyActive) {
      if (!confirm("You have an active GPS sharing duty running. End duty and logout?")) return;
      await endDuty();
    }
    logout("driver-login.html");
  });
}

// SOS Alert
if (sosBtn) {
  sosBtn.addEventListener("click", () => {
    if (!confirm("Send an EMERGENCY distress alert to Transport Admin right now?")) return;
    const activeUid = (currentUser && currentUser.uid) || sessionStorage.getItem("driverUid") || "driver_sunil";
    const driverName = (currentProfile && currentProfile.name) || sessionStorage.getItem("driverName") || "Driver";

    const alertPayload = {
      type: "driver_sos",
      driverUid: activeUid,
      driverName: driverName,
      busNumber: assignedBus || "Unknown",
      location: lastPosLat && lastPosLng ? { lat: lastPosLat, lng: lastPosLng } : null,
      status: "active",
      ts: Date.now(),
    };

    try {
      const localAlerts = JSON.parse(localStorage.getItem("smartbus_alerts") || "[]");
      localAlerts.unshift(alertPayload);
      localStorage.setItem("smartbus_alerts", JSON.stringify(localAlerts));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    if (db && typeof db.ref === "function") {
      db.ref("alerts").push({
        ...alertPayload,
        ts: typeof firebase !== "undefined" && firebase.database ? firebase.database.ServerValue.TIMESTAMP : Date.now(),
      });
    }

    sosBtn.textContent = "Alert Sent";
    sosBtn.disabled = true;
    sosBtn.style.background = "#7f1d1d";
    setTimeout(() => {
      sosBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> SOS';
      sosBtn.disabled = false;
      sosBtn.style.background = "#ef4444";
    }, 15000);
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (isDutyActive) {
      if (!confirm("You have an active GPS sharing duty running. Ending duty and logging out?")) return;
      await endDuty();
    }
    logout("driver-login.html");
  });
}

window.addEventListener("beforeunload", () => {
  if (isDutyActive && geoWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geoWatchId);
  }
});

// ================================
// IMMEDIATE STARTUP HYDRATION
// ================================
seedDefaultsIfEmpty();
syncDriverAssignment();
checkTodayAttendance();
loadShiftDutyHistory();

// Initialize map on trip tab immediately so it's ready
setTimeout(() => {
  if (!driverMap) initDriverMap();
}, 200);

// ================================
// AUTH GUARD INITIALIZATION
// ================================
requireRole("driver", (user, profile) => {
  loadDriverAssignment(user, profile);
  initDriverMap();
}, "driver-login.html");
