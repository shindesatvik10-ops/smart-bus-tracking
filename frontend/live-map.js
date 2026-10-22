// ========================================================
// SMART BUS TRACKING - SHARED LIVE MAP MODULE (live-map.js)
// Real-time Leaflet Map with Real GPS Tracking & "From -> To" Search
// ========================================================

// Access Firebase RTDB wrappers from window (provided by firebase.js)
const getDb = () => window.rtdb || (window.db && typeof window.db.ref === "function" ? window.db : null) || (typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : null);
const getRef = (d, path) => (window.ref ? window.ref(d, path) : (d && d.ref ? d.ref(path) : null));
const getOnValue = (dbRef, cb, errCb) => (window.onValue ? window.onValue(dbRef, cb, errCb) : (dbRef && dbRef.on ? (dbRef.on("value", cb, errCb), () => dbRef.off("value", cb)) : () => {}));
const getWatchAllBuses = (cb, errCb) => (window.watchAllBuses ? window.watchAllBuses(cb, errCb) : (() => {}));
const getLiveMapServerNow = () => (typeof window.getServerNow === "function" ? window.getServerNow() : Date.now());

const LIVE_TIMEOUT_MS = 30 * 1000; // 30 seconds threshold for live status
const DEFAULT_CENTER = [16.7050, 74.2433]; // Kolhapur, Maharashtra, India
const DEFAULT_ZOOM = 13;

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

// Active state per initialized map instance
let currentMap = null;
let currentContainerId = null;
let busMarkers = {}; // busNo -> L.Marker
let stopMarkers = []; // Array of L.Marker
let routePolylines = []; // Array of L.Polyline

let allRoutes = {}; // routeId -> { name, stops: [...] }
let allBuses = {}; // busNo -> { busNo, capacity, assignedDriver, routeId, sharing, active }
let allLocations = {}; // busNo -> { lat, lng, speed, heading, accuracy, ts }
let allDrivers = {}; // uid -> { name, phone, email, ... }

let unsubBuses = null;
let unsubRoutes = null;
let unsubLocations = null;
let unsubDrivers = null;
let popupTickerInterval = null;

let activeSearchFilter = null; // { fromStop, toStop, matchedRouteIds }

// ========================================================
// UTILITY FUNCTIONS: HAVERSINE, LIVE CHECK & FORMATTING
// ========================================================

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

// A bus is LIVE only if sharing is true AND the location ts is less than 30 seconds old
function isBusLive(busNo) {
  const bus = allBuses[busNo];
  const loc = allLocations[busNo];
  if (!bus || bus.sharing !== true) return false;
  if (!loc || loc.lat == null || loc.lng == null) return false;
  const ts = Number(loc.ts || 0);
  if (!ts) return false;
  const serverNow = typeof getLiveMapServerNow === "function" ? getLiveMapServerNow() : Date.now();
  return serverNow - ts < LIVE_TIMEOUT_MS;
}

function formatRelativeTime(ts) {
  if (!ts) return "offline";
  const serverNow = typeof getLiveMapServerNow === "function" ? getLiveMapServerNow() : Date.now();
  const diffMs = serverNow - Number(ts);
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ago`;
}

// Find nearest stop to a bus location along a route
function findNearestStop(busLat, busLng, stops) {
  if (!stops || stops.length === 0) return null;
  let nearest = stops[0];
  let minDistance = haversineDistanceKm(busLat, busLng, Number(nearest.lat), Number(nearest.lng));

  for (let i = 1; i < stops.length; i++) {
    const s = stops[i];
    const d = haversineDistanceKm(busLat, busLng, Number(s.lat), Number(s.lng));
    if (d < minDistance) {
      minDistance = d;
      nearest = s;
    }
  }
  return nearest;
}

// Compute ETA from bus to a destination stop
function calculateETA(busLat, busLng, busSpeedMs, toStopLat, toStopLng) {
  const distKm = haversineDistanceKm(busLat, busLng, toStopLat, toStopLng);
  let speedKmH = (Number(busSpeedMs) || 0) * 3.6;
  if (speedKmH < 2) speedKmH = 20; // 20 km/h fallback when bus is stopped or speed < 2 km/h
  const hours = distKm / speedKmH;
  const minutes = Math.round(hours * 60);

  if (distKm < 0.08) return "Arriving now";
  if (minutes <= 1) return "1 min";
  return `${minutes} mins (${distKm.toFixed(1)} km)`;
}

// ========================================================
// LEAFLET ICONS
// ========================================================

function createBusIcon(heading = null, isLive = true) {
  const rotationStyle =
    heading != null && !isNaN(heading) ? `transform: rotate(${heading}deg);` : "";
  const filterStyle = isLive ? "" : "filter: grayscale(100%) opacity(0.6);";

  return L.divIcon({
    className: "real-bus-marker-wrapper",
    html: `
      <div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; ${rotationStyle} transition: transform 0.4s ease-out;">
        <img src="bus.png" style="width: 36px; height: 36px; ${filterStyle} drop-shadow(0 3px 6px rgba(0,0,0,0.3));" alt="Bus">
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
  });
}

function createStopIcon(number, color = "#2563eb", isEndpoint = false) {
  const size = isEndpoint ? 30 : 24;
  return L.divIcon({
    className: "custom-stop-marker",
    html: `
      <div style="
        background: ${color};
        color: white;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: ${isEndpoint ? 13 : 11}px;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      ">${number}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ========================================================
// MARKER & POPUP MANAGEMENT
// ========================================================

function buildPopupHtml(busNo, live, loc, bus, route, driverName) {
  const speedKmH = ((Number(loc.speed) || 0) * 3.6).toFixed(1);
  const updatedTime = formatRelativeTime(loc.ts);
  const headingText =
    loc.heading != null && !isNaN(loc.heading) ? `${Math.round(loc.heading)}°` : "N/A";
  const accuracyText =
    loc.accuracy != null && !isNaN(loc.accuracy) ? `±${Math.round(loc.accuracy)}m` : "";

  if (live) {
    return `
      <div style="font-family: inherit; min-width: 190px; padding: 4px;" data-bus-popup="${busNo}">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <div style="background:#2563eb; color:#fff; padding:4px 8px; border-radius:6px; font-weight:700; font-size:13px;">
            ${busNo}
          </div>
          <span style="font-size:11px; background:#dcfce7; color:#166534; padding:2px 7px; border-radius:12px; font-weight:700; border:1px solid #bbf7d0;">
            ● LIVE GPS
          </span>
        </div>
        <div style="font-size:12px; color:#475569; margin-bottom:4px;">
          <i class="fa-solid fa-route" style="color:#2563eb; width:16px;"></i> <strong>Route:</strong> ${route.name || "Assigned Route"}
        </div>
        <div style="font-size:12px; color:#475569; margin-bottom:4px;">
          <i class="fa-solid fa-user-tie" style="color:#2563eb; width:16px;"></i> <strong>Driver:</strong> ${driverName}
        </div>
        <div style="font-size:12px; color:#475569; margin-bottom:4px;">
          <i class="fa-solid fa-gauge" style="color:#2563eb; width:16px;"></i> <strong>Speed:</strong> ${speedKmH} km/h
        </div>
        <div style="font-size:11px; color:#64748b; margin-top:4px; padding-top:4px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between;">
          <span class="live-ts-counter">Last updated: ${updatedTime}</span>
          <span>${accuracyText}</span>
        </div>
      </div>
    `;
  }

  // Offline bus popup (in grey, never shows as live)
  const serverNow = typeof getLiveMapServerNow === "function" ? getLiveMapServerNow() : Date.now();
  const minsAgo = loc.ts ? Math.max(1, Math.floor((serverNow - Number(loc.ts)) / 60000)) : 0;
  const offlineLabel = minsAgo > 0 ? `offline, last seen ${minsAgo} min ago` : "offline";

  return `
    <div style="font-family: inherit; min-width: 180px; padding: 4px; color:#64748b;" data-bus-popup="${busNo}">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <div style="background:#94a3b8; color:#fff; padding:4px 8px; border-radius:6px; font-weight:700; font-size:13px;">
          ${busNo}
        </div>
        <span style="font-size:11px; background:#f1f5f9; color:#64748b; padding:2px 6px; border-radius:12px; font-weight:600;">
          Offline
        </span>
      </div>
      <div style="font-size:12px; margin-bottom:4px;">
        <strong>Route:</strong> ${route.name || "Assigned Route"}
      </div>
      <div style="font-size:11px; color:#94a3b8; margin-top:4px;">
        ${offlineLabel}
      </div>
    </div>
  `;
}

function updateBusMarkers() {
  if (!currentMap) return;

  const activeBusNos = new Set();
  let liveBusCount = 0;

  Object.keys(allBuses).forEach((busNo) => {
    const live = isBusLive(busNo);
    const loc = allLocations[busNo];

    // Only display on map if location coordinates exist
    if (!loc || loc.lat == null || loc.lng == null) return;

    // Filter by route search if active
    if (activeSearchFilter && activeSearchFilter.matchedRouteIds) {
      const bus = allBuses[busNo];
      if (!bus || !activeSearchFilter.matchedRouteIds.includes(bus.routeId)) {
        return;
      }
    }

    // Only show live buses on the live map; if offline, don't show as live
    if (!live) {
      if (busMarkers[busNo]) {
        currentMap.removeLayer(busMarkers[busNo]);
        delete busMarkers[busNo];
      }
      return;
    }

    liveBusCount++;
    activeBusNos.add(busNo);

    const bus = allBuses[busNo] || {};
    const route = allRoutes[bus.routeId] || { name: "Assigned Route" };
    const driver =
      (bus.assignedDriver && allDrivers[bus.assignedDriver]) || { name: bus.driverName || "Driver" };
    const driverName = driver.name || "Driver";

    const popupHtml = buildPopupHtml(busNo, live, loc, bus, route, driverName);
    const heading = loc.heading != null && !isNaN(loc.heading) ? Number(loc.heading) : null;
    const targetLatLng = [Number(loc.lat), Number(loc.lng)];

    if (busMarkers[busNo]) {
      // Smoothly update existing marker position, icon rotation, and popup content
      busMarkers[busNo].setLatLng(targetLatLng);
      busMarkers[busNo].setIcon(createBusIcon(heading, true));
      busMarkers[busNo].setPopupContent(popupHtml);
    } else {
      // Create new marker
      const marker = L.marker(targetLatLng, { icon: createBusIcon(heading, true) })
        .bindPopup(popupHtml)
        .bindTooltip(String(busNo), {
          permanent: true,
          direction: "bottom",
          offset: [0, 14],
        })
        .addTo(currentMap);
      busMarkers[busNo] = marker;
    }
  });

  // Remove markers that went offline
  Object.keys(busMarkers).forEach((busNo) => {
    if (!activeBusNos.has(busNo)) {
      currentMap.removeLayer(busMarkers[busNo]);
      delete busMarkers[busNo];
    }
  });

  // Show / hide map empty state banner if no live buses exist
  updateMapEmptyStateBanner(liveBusCount);
}

function updateMapEmptyStateBanner(liveCount) {
  let emptyBanner = document.getElementById("liveMapEmptyBanner");
  const container = document.getElementById(currentContainerId);
  if (!container) return;

  if (liveCount === 0) {
    if (!emptyBanner) {
      emptyBanner = document.createElement("div");
      emptyBanner.id = "liveMapEmptyBanner";
      emptyBanner.style.cssText =
        "position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; background: rgba(15,23,42,0.85); color: #ffffff; padding: 10px 20px; border-radius: 30px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px); box-shadow: 0 4px 14px rgba(0,0,0,0.25); pointer-events: none;";
      emptyBanner.innerHTML =
        '<i class="fa-solid fa-satellite-dish" style="color:#38bdf8;"></i> No live buses right now';
      container.parentElement.style.position = "relative";
      container.parentElement.appendChild(emptyBanner);
    } else {
      emptyBanner.style.display = "flex";
    }
  } else if (emptyBanner) {
    emptyBanner.style.display = "none";
  }
}

// Client timer: updates "Last updated: Ns ago" in open popups every second
function tickPopupsEverySecond() {
  document.querySelectorAll("[data-bus-popup]").forEach((el) => {
    const busNo = el.getAttribute("data-bus-popup");
    const loc = allLocations[busNo];
    const tsSpan = el.querySelector(".live-ts-counter");
    if (loc && tsSpan) {
      tsSpan.textContent = `Last updated: ${formatRelativeTime(loc.ts)}`;
    }
  });
}

// Clear all route polylines and stop markers
function clearRouteGraphics() {
  if (!currentMap) return;
  routePolylines.forEach((p) => currentMap.removeLayer(p));
  routePolylines = [];
  stopMarkers.forEach((m) => currentMap.removeLayer(m));
  stopMarkers = [];
}

// Draw a matching route with numbered stops and polyline
function drawRouteOnMap(route, fromStopIndex = -1, toStopIndex = -1) {
  if (!currentMap || !route || !Array.isArray(route.stops) || route.stops.length < 2) return;

  clearRouteGraphics();

  const coords = route.stops.map((s) => [Number(s.lat), Number(s.lng)]);

  // Draw smooth polyline
  const polyline = L.polyline(coords, {
    color: "#2563eb",
    weight: 5,
    opacity: 0.85,
  }).addTo(currentMap);
  routePolylines.push(polyline);

  // Add stop markers
  route.stops.forEach((stop, index) => {
    let color = "#3b82f6";
    let isEndpoint = false;

    if (index === fromStopIndex) {
      color = "#16a34a"; // Green for From stop
      isEndpoint = true;
    } else if (index === toStopIndex) {
      color = "#dc2626"; // Red for To stop
      isEndpoint = true;
    }

    const marker = L.marker([Number(stop.lat), Number(stop.lng)], {
      icon: createStopIcon(index + 1, color, isEndpoint),
    })
      .bindPopup(`
        <div style="font-family: inherit; font-size: 12px; font-weight: 600;">
          <div style="color:${color}; font-size:11px; text-transform:uppercase; margin-bottom:2px;">
            ${
              index === fromStopIndex
                ? "Boarding Stop (From)"
                : index === toStopIndex
                ? "Destination Stop (To)"
                : "Stop #" + (index + 1)
            }
          </div>
          <strong>${stop.name}</strong>
        </div>
      `)
      .addTo(currentMap);

    stopMarkers.push(marker);
  });

  // Fit bounds to the route
  currentMap.fitBounds(polyline.getBounds(), { padding: [50, 50] });
}

// ========================================================
// SEARCH: FROM -> TO LOGIC & RESULT CARDS
// ========================================================

function populateDatalist(datalistEl) {
  if (!datalistEl) return;

  const stopNamesSet = new Set();
  Object.values(allRoutes).forEach((r) => {
    if (Array.isArray(r.stops)) {
      r.stops.forEach((s) => {
        if (s && s.name) stopNamesSet.add(s.name.trim());
      });
    }
  });

  const sortedStops = Array.from(stopNamesSet).sort((a, b) => a.localeCompare(b));
  datalistEl.innerHTML = sortedStops.map((name) => `<option value="${name}"></option>`).join("");
}

// Flexible stop matcher: exact, startsWith, substring, or keyword match
function resolveStopName(inputStr) {
  if (!inputStr) return null;
  const q = inputStr.trim().toLowerCase();

  const allStopNames = [];
  Object.values(allRoutes).forEach((r) => {
    if (Array.isArray(r.stops)) {
      r.stops.forEach((s) => {
        if (s && s.name && !allStopNames.includes(s.name.trim())) {
          allStopNames.push(s.name.trim());
        }
      });
    }
  });

  // 1. Exact match
  const exact = allStopNames.find((n) => n.toLowerCase() === q);
  if (exact) return exact;

  // 2. Keyword or abbreviation in parentheses (e.g., "CBS", "CSMT")
  const kw = allStopNames.find((n) => {
    const parenMatch = n.match(/\((.*?)\)/);
    if (parenMatch && parenMatch[1].toLowerCase() === q) return true;
    const words = n.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/);
    return words.includes(q);
  });
  if (kw) return kw;

  // 3. Starts with
  const starts = allStopNames.find((n) => n.toLowerCase().startsWith(q));
  if (starts) return starts;

  // 4. Substring match
  const sub = allStopNames.find((n) => n.toLowerCase().includes(q));
  if (sub) return sub;

  return null;
}

function handleSearch(searchUi) {
  const rawFrom = searchUi.fromInput ? searchUi.fromInput.value.trim() : "";
  const rawTo = searchUi.toInput ? searchUi.toInput.value.trim() : "";

  if (!rawFrom || !rawTo) {
    showStatusMessage(searchUi, "Please enter both 'From' and 'To' stops to find a bus.", "warning");
    return;
  }

  // Resolve stop names using flexible matching
  const fromVal = resolveStopName(rawFrom);
  const toVal = resolveStopName(rawTo);

  if (!fromVal || !toVal) {
    const unknownStop = !fromVal && !toVal ? `"${rawFrom}" and "${rawTo}"` : !fromVal ? `"${rawFrom}"` : `"${rawTo}"`;
    showStatusMessage(
      searchUi,
      `Could not recognize stop ${unknownStop}. Please pick from suggestions (e.g. CBS, Rankala, University).`,
      "warning"
    );
    return;
  }

  // Auto-fill resolved full names back into input boxes
  if (searchUi.fromInput) searchUi.fromInput.value = fromVal;
  if (searchUi.toInput) searchUi.toInput.value = toVal;

  if (fromVal.toLowerCase() === toVal.toLowerCase()) {
    showStatusMessage(searchUi, "'From' and 'To' stops cannot be the same.", "warning");
    return;
  }

  // Find matching routes
  const matchedRoutes = [];
  let oppositeDirectionFound = false;

  Object.entries(allRoutes).forEach(([routeId, route]) => {
    if (!Array.isArray(route.stops)) return;

    const fromIdx = route.stops.findIndex((s) => s.name.trim().toLowerCase() === fromVal.toLowerCase());
    const toIdx = route.stops.findIndex((s) => s.name.trim().toLowerCase() === toVal.toLowerCase());

    if (fromIdx !== -1 && toIdx !== -1) {
      if (fromIdx < toIdx) {
        matchedRoutes.push({ routeId, route, fromIdx, toIdx });
      } else {
        oppositeDirectionFound = true;
      }
    }
  });

  if (matchedRoutes.length === 0) {
    if (oppositeDirectionFound) {
      showStatusMessage(
        searchUi,
        `No bus available from ${fromVal} to ${toVal}. Buses run in the opposite direction (${toVal} -> ${fromVal}).`,
        "offline"
      );
    } else {
      showStatusMessage(
        searchUi,
        `No direct bus available between ${fromVal} and ${toVal}.`,
        "offline"
      );
    }
    clearRouteGraphics();
    activeSearchFilter = null;
    updateBusMarkers();
    renderResultCards(searchUi, []);
    return;
  }

  // Apply search filter
  const matchedRouteIds = matchedRoutes.map((m) => m.routeId);
  activeSearchFilter = { fromStop: fromVal, toStop: toVal, matchedRouteIds };

  // Draw the first matching route on the map
  const primaryMatch = matchedRoutes[0];
  drawRouteOnMap(primaryMatch.route, primaryMatch.fromIdx, primaryMatch.toIdx);
  updateBusMarkers();

  // Collect LIVE buses running on these matched routes
  const resultBuses = [];

  matchedRoutes.forEach(({ routeId, route, fromIdx }) => {
    const fromStop = route.stops[fromIdx];
    const fromLat = Number(fromStop.lat);
    const fromLng = Number(fromStop.lng);

    Object.entries(allBuses).forEach(([busNo, bus]) => {
      if (bus.routeId === routeId && isBusLive(busNo)) {
        const loc = allLocations[busNo];
        const nextStop = findNearestStop(loc.lat, loc.lng, route.stops);
        const eta = calculateETA(loc.lat, loc.lng, loc.speed, fromLat, fromLng);

        const distKm = haversineDistanceKm(loc.lat, loc.lng, fromLat, fromLng);
        let speedKmH = (Number(loc.speed) || 0) * 3.6;
        if (speedKmH < 2) speedKmH = 20;
        const etaHours = distKm / speedKmH;
        const etaSortKey = distKm < 0.08 ? 0 : etaHours * 3600 + distKm;

        const driver =
          (bus.assignedDriver && allDrivers[bus.assignedDriver]) || { name: bus.driverName || "Driver" };
        const driverName = driver.name || "Driver";

        resultBuses.push({
          busNo,
          routeName: route.name,
          driverName,
          routeId,
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speed,
          nextStop: nextStop ? nextStop.name : "En Route",
          eta,
          etaSortKey,
        });
      }
    });
  });

  if (resultBuses.length === 0) {
    showStatusMessage(
      searchUi,
      `No bus available right now from ${fromVal} to ${toVal}. Buses on this route are currently offline.`,
      "offline"
    );
    renderResultCards(searchUi, []);
  } else {
    // Sort cards by shortest ETA first
    resultBuses.sort((a, b) => (a.etaSortKey || 0) - (b.etaSortKey || 0));

    showStatusMessage(
      searchUi,
      `Bus available: ${resultBuses.length} live bus(es) from ${fromVal} to ${toVal}`,
      "success"
    );
    renderResultCards(searchUi, resultBuses);
  }
}

function handleClearSearch(searchUi) {
  if (searchUi.fromInput) searchUi.fromInput.value = "";
  if (searchUi.toInput) searchUi.toInput.value = "";
  activeSearchFilter = null;
  clearRouteGraphics();
  updateBusMarkers();
  renderResultCards(searchUi, []);
  if (searchUi.statusMsg) {
    searchUi.statusMsg.style.display = "none";
    searchUi.statusMsg.textContent = "";
  }
}

function showStatusMessage(searchUi, message, type = "info") {
  if (!searchUi.statusMsg) return;
  searchUi.statusMsg.textContent = message;
  searchUi.statusMsg.style.display = "block";

  if (type === "warning") {
    searchUi.statusMsg.style.background = "#fef3c7";
    searchUi.statusMsg.style.color = "#92400e";
    searchUi.statusMsg.style.border = "1px solid #fde68a";
    searchUi.statusMsg.style.padding = "12px 16px";
    searchUi.statusMsg.style.fontSize = "13.5px";
    searchUi.statusMsg.style.fontWeight = "600";
    searchUi.statusMsg.style.boxShadow = "none";
  } else if (type === "success") {
    // Big green status banner
    searchUi.statusMsg.style.background = "#dcfce7";
    searchUi.statusMsg.style.color = "#166534";
    searchUi.statusMsg.style.border = "1.5px solid #86efac";
    searchUi.statusMsg.style.padding = "14px 18px";
    searchUi.statusMsg.style.fontSize = "15px";
    searchUi.statusMsg.style.fontWeight = "700";
    searchUi.statusMsg.style.boxShadow = "0 2px 8px rgba(34,197,94,0.15)";
  } else if (type === "offline" || type === "danger" || type === "error") {
    // Orange/red banner for offline / not available
    searchUi.statusMsg.style.background = "#fff7ed";
    searchUi.statusMsg.style.color = "#9a3412";
    searchUi.statusMsg.style.border = "1.5px solid #f97316";
    searchUi.statusMsg.style.padding = "14px 18px";
    searchUi.statusMsg.style.fontSize = "14px";
    searchUi.statusMsg.style.fontWeight = "700";
    searchUi.statusMsg.style.boxShadow = "0 2px 8px rgba(249,115,22,0.15)";
  } else {
    searchUi.statusMsg.style.background = "#eff6ff";
    searchUi.statusMsg.style.color = "#1e40af";
    searchUi.statusMsg.style.border = "1px solid #bfdbfe";
    searchUi.statusMsg.style.padding = "12px 16px";
    searchUi.statusMsg.style.fontSize = "13.5px";
    searchUi.statusMsg.style.fontWeight = "600";
    searchUi.statusMsg.style.boxShadow = "none";
  }
}

function getEtaSortScore(b) {
  if (b && b.etaSortKey != null) return b.etaSortKey;
  if (!b || !b.eta) return 999999;
  if (b.eta === "Arriving now") return 0;
  const minMatch = b.eta.match(/(\d+)\s*min/);
  const kmMatch = b.eta.match(/([\d.]+)\s*km/);
  const mins = minMatch ? parseInt(minMatch[1], 10) : 999;
  const km = kmMatch ? parseFloat(kmMatch[1]) : 0;
  return mins * 60 + km;
}

function renderResultCards(searchUi, buses) {
  if (!searchUi.resultsContainer) return;

  if (!buses || buses.length === 0) {
    searchUi.resultsContainer.innerHTML = "";
    return;
  }

  // Ensure sorted by shortest ETA first
  const sortedBuses = [...buses].sort((a, b) => {
    const valA = a.etaSortKey != null ? a.etaSortKey : getEtaSortScore(a);
    const valB = b.etaSortKey != null ? b.etaSortKey : getEtaSortScore(b);
    return valA - valB;
  });

  searchUi.resultsContainer.innerHTML = sortedBuses
    .map(
      (b, index) => {
        const arrivingFirstBadge =
          index === 0
            ? `<span style="font-size:11px; background:#e0f2fe; color:#0369a1; padding:2px 7px; border-radius:4px; font-weight:700; border:1px solid #bae6fd; display:inline-flex; align-items:center; gap:3px;">
                 <i class="fa-solid fa-bolt" style="font-size:10px;"></i> Arriving first
               </span>`
            : "";

        return `
      <div class="live-bus-card" data-bus-no="${b.busNo}" style="
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 10px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-weight:700; font-size:14px; color:#1e293b;">${b.busNo}</span>
            <span style="font-size:11px; background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-weight:700;">● LIVE GPS</span>
            ${arrivingFirstBadge}
          </div>
          <span style="font-size:12px; font-weight:700; color:#16a34a; background:#dcfce7; padding:3px 8px; border-radius:6px;">
            ETA: ${b.eta}
          </span>
        </div>
        <div style="font-size:12px; color:#475569; margin-bottom:6px;">
          <i class="fa-solid fa-user-tie" style="color:#2563eb;"></i> <strong>Assigned Driver:</strong> ${b.driverName}
        </div>
        <div style="font-size:12px; color:#64748b; display:flex; justify-content:space-between;">
          <span><i class="fa-solid fa-location-dot" style="color:#2563eb;"></i> Next: <strong>${b.nextStop}</strong></span>
          <span><i class="fa-solid fa-gauge" style="color:#2563eb;"></i> ${(Number(b.speed || 0) * 3.6).toFixed(1)} km/h</span>
        </div>
      </div>
    `;
      }
    )
    .join("");

  // Click listener on each card zooms to that bus
  searchUi.resultsContainer.querySelectorAll(".live-bus-card").forEach((card) => {
    card.addEventListener("click", () => {
      const busNo = card.getAttribute("data-bus-no");
      if (busNo && busMarkers[busNo] && currentMap) {
        const marker = busMarkers[busNo];
        currentMap.setView(marker.getLatLng(), 16);
        marker.openPopup();
      }
    });
  });
}

// ========================================================
// INIT & DESTROY EXPORTS
// ========================================================

function initLiveMap(containerId, searchUiIds = {}) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Map container with ID "${containerId}" not found.`);
    return null;
  }

  currentContainerId = containerId;

  // Cleanup earlier instance
  destroyLiveMap();

  // Ensure Leaflet default marker icons load from CDN without 404s
  if (typeof L !== "undefined" && L.Icon && L.Icon.Default) {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }

  // Create Leaflet map instance
  currentMap = L.map(containerId, {
    zoomControl: true,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // 1. OpenStreetMap (Humanitarian HOT) - Clean transit styling, 100% free, NO API key required
  const osmHot = L.tileLayer(
    "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    {
      subdomains: "abc",
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">HOT</a>',
    }
  );

  // 2. ESRI World Street Map - High performance ArcGIS global CDN, NO API key, zero watermarks
  const esriStreet = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, METI, TomTom',
    }
  );

  // 3. OpenStreetMap Standard
  const osmStandard = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }
  );

  // Start with the standard OSM layer; the HOT tile endpoint can reject browser requests.
  osmStandard.addTo(currentMap);

  // Add layer toggle control
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
      .addTo(currentMap);
  } catch (e) {}

  // ResizeObserver guarantees proper sizing as soon as container renders or resizes
  if (window.ResizeObserver && container) {
    const ro = new ResizeObserver(() => {
      if (currentMap) currentMap.invalidateSize();
    });
    ro.observe(container);
  }

  [100, 300, 600, 1200].forEach((ms) => {
    setTimeout(() => {
      if (currentMap) currentMap.invalidateSize();
    }, ms);
  });

  window.addEventListener("resize", () => {
    if (currentMap) currentMap.invalidateSize();
  });

  // Wire up Search UI
  const searchUi = {
    fromInput: document.getElementById(searchUiIds.fromInputId),
    toInput: document.getElementById(searchUiIds.toInputId),
    datalist: document.getElementById(searchUiIds.datalistId),
    searchBtn: document.getElementById(searchUiIds.searchBtnId),
    clearBtn: document.getElementById(searchUiIds.clearBtnId),
    resultsContainer: document.getElementById(searchUiIds.resultsContainerId),
    statusMsg: document.getElementById(searchUiIds.statusMsgId),
  };

  if (searchUi.searchBtn) {
    searchUi.searchBtn.addEventListener("click", () => handleSearch(searchUi));
  }
  if (searchUi.fromInput) {
    searchUi.fromInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch(searchUi);
    });
  }
  if (searchUi.toInput) {
    searchUi.toInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch(searchUi);
    });
  }
  if (searchUi.clearBtn) {
    searchUi.clearBtn.addEventListener("click", () => handleClearSearch(searchUi));
  }

  // 0. Instant startup data from local cache (with default Kolhapur seed fallback)
  try {
    const cachedRoutes = localStorage.getItem("smartbus_routes");
    if (cachedRoutes && Object.keys(JSON.parse(cachedRoutes)).length > 0) {
      allRoutes = JSON.parse(cachedRoutes);
    } else {
      allRoutes = { ...DEFAULT_KOLHAPUR_ROUTES };
      localStorage.setItem("smartbus_routes", JSON.stringify(allRoutes));
    }

    const cachedBuses = localStorage.getItem("smartbus_buses");
    if (cachedBuses && Object.keys(JSON.parse(cachedBuses)).length > 0) {
      allBuses = JSON.parse(cachedBuses);
    } else {
      allBuses = { ...DEFAULT_KOLHAPUR_BUSES };
      localStorage.setItem("smartbus_buses", JSON.stringify(allBuses));
    }

    const cachedDrivers = localStorage.getItem("smartbus_drivers");
    if (cachedDrivers && Object.keys(JSON.parse(cachedDrivers)).length > 0) {
      allDrivers = JSON.parse(cachedDrivers);
    } else {
      allDrivers = { ...DEFAULT_KOLHAPUR_DRIVERS };
      localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
    }

    const cachedLocs = localStorage.getItem("smartbus_locations");
    if (cachedLocs) allLocations = JSON.parse(cachedLocs);

    populateDatalist(searchUi.datalist);
    updateBusMarkers();

    if (!activeSearchFilter) {
      const firstRoute = Object.values(allRoutes).find(
        (r) => Array.isArray(r.stops) && r.stops.length > 0
      );
      if (firstRoute && currentMap) {
        currentMap.setView([Number(firstRoute.stops[0].lat), Number(firstRoute.stops[0].lng)], 13);
      }
    }
  } catch (e) {
    console.warn("Storage init notice:", e.message);
  }

  // Cross-tab real-time sync for routes, buses, and live positions
  const syncFromStorage = () => {
    try {
      const cachedRoutes = localStorage.getItem("smartbus_routes");
      if (cachedRoutes) allRoutes = { ...allRoutes, ...JSON.parse(cachedRoutes) };
      const cachedBuses = localStorage.getItem("smartbus_buses");
      if (cachedBuses) allBuses = { ...allBuses, ...JSON.parse(cachedBuses) };
      const cachedDrivers = localStorage.getItem("smartbus_drivers");
      if (cachedDrivers) allDrivers = { ...allDrivers, ...JSON.parse(cachedDrivers) };
      const cachedLocs = localStorage.getItem("smartbus_locations");
      if (cachedLocs) allLocations = { ...allLocations, ...JSON.parse(cachedLocs) };

      populateDatalist(searchUi.datalist);
      updateBusMarkers();
      if (activeSearchFilter) handleSearch(searchUi);
    } catch (err) {}
  };

  window.addEventListener("storage", syncFromStorage);
  // Also poll every 1.5 seconds for same-tab updates or non-storage-event environments
  const localSyncInterval = setInterval(syncFromStorage, 1500);

  // Load live data from Firebase RTDB if available
  try {
    const liveDb = getDb();
    if (liveDb) {
      // 1. Routes from Firebase RTDB
      const routesRef = getRef(liveDb, "routes");
      if (routesRef) {
        unsubRoutes = getOnValue(
          routesRef,
          (snap) => {
            const cloudRoutes = snap.val() || {};
            if (Object.keys(cloudRoutes).length > 0) {
              allRoutes = { ...allRoutes, ...cloudRoutes };
              populateDatalist(searchUi.datalist);
            }
          },
          (err) => console.warn("Live routes sync notice:", err.message)
        );
      }

      // 2. Buses from Firebase RTDB
      const busesRef = getRef(liveDb, "buses");
      if (busesRef) {
        unsubBuses = getOnValue(
          busesRef,
          (snap) => {
            const cloudBuses = snap.val() || {};
            if (Object.keys(cloudBuses).length > 0) {
              allBuses = { ...allBuses, ...cloudBuses };
              updateBusMarkers();
            }
          },
          (err) => console.warn("Live buses sync notice:", err.message)
        );
      }

      // 3. Locations from Firebase RTDB (watchAllBuses)
      unsubLocations = getWatchAllBuses(
        (locations) => {
          if (locations && Object.keys(locations).length > 0) {
            allLocations = { ...allLocations, ...locations };
            updateBusMarkers();
            if (activeSearchFilter) {
              handleSearch(searchUi);
            }
          }
        },
        (err) => console.warn("Live locations sync notice:", err.message)
      );

      // 4. Drivers for assigned driver names
      const usersRef = getRef(liveDb, "users");
      if (usersRef) {
        unsubDrivers = getOnValue(
          usersRef,
          (snap) => {
            const users = snap.val() || {};
            Object.entries(users).forEach(([uid, u]) => {
              if (u && (u.role === "driver" || !u.role)) {
                allDrivers[uid] = u;
              }
            });
            updateBusMarkers();
          },
          (err) => console.warn("Live drivers sync notice:", err.message)
        );
      }
    }
  } catch (err) {
    console.warn("Firebase live map initialization notice:", err.message);
  }

  // 5. Popup ticker interval: updates "Last updated: Ns ago" in open popups every second
  if (popupTickerInterval) clearInterval(popupTickerInterval);
  popupTickerInterval = setInterval(() => {
    tickPopupsEverySecond();
    updateBusMarkers();
  }, 1000);

  // Clean up on unload
  window.addEventListener("beforeunload", destroyLiveMap);

  return currentMap;
}

function destroyLiveMap() {
  if (typeof unsubRoutes === "function") unsubRoutes();
  if (typeof unsubBuses === "function") unsubBuses();
  if (typeof unsubLocations === "function") unsubLocations();
  if (typeof unsubDrivers === "function") unsubDrivers();
  if (popupTickerInterval) clearInterval(popupTickerInterval);

  unsubRoutes = null;
  unsubBuses = null;
  unsubLocations = null;
  unsubDrivers = null;
  popupTickerInterval = null;

  clearRouteGraphics();

  if (currentMap) {
    currentMap.remove();
    currentMap = null;
  }
  busMarkers = {};
  stopMarkers = [];
  routePolylines = [];
  activeSearchFilter = null;
}

// Attach all public methods and defaults to window
if (typeof window !== "undefined") {
  window.initLiveMap = initLiveMap;
  window.destroyLiveMap = destroyLiveMap;
  window.isBusLive = isBusLive;
  window.haversineDistanceKm = haversineDistanceKm;
  window.DEFAULT_KOLHAPUR_ROUTES = DEFAULT_KOLHAPUR_ROUTES;
  window.DEFAULT_KOLHAPUR_BUSES = DEFAULT_KOLHAPUR_BUSES;
  window.DEFAULT_KOLHAPUR_DRIVERS = DEFAULT_KOLHAPUR_DRIVERS;
}
