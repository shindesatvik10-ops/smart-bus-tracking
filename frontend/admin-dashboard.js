// ========================================================
// ADMIN DASHBOARD
// ========================================================

// ========================================================
// 1. SIDEBAR & NAVIGATION (INITIALIZED FIRST & IMMEDIATELY)
// ========================================================

const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menuButton");
const sidebarOverlay = document.getElementById("sidebarOverlay");

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

const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".dashboard-section");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

const pageData = {
  dashboard: {
    title: "Dashboard Overview",
    subtitle: "Welcome back, Admin. Here's what's happening today.",
  },
  buses: {
    title: "Manage Buses",
    subtitle: "Add, edit and manage buses.",
  },
  drivers: {
    title: "Manage Drivers",
    subtitle: "Manage all registered bus drivers.",
  },
  routes: {
    title: "Manage Routes",
    subtitle: "Create and manage bus routes and stops.",
  },
  tracking: {
    title: "Live Bus Tracking",
    subtitle: "Monitor all active buses in real time.",
  },
  notifications: {
    title: "Notifications",
    subtitle: "Manage transportation alerts.",
  },
  reports: {
    title: "Reports & Analytics",
    subtitle: "View transportation performance reports.",
  },
  settings: {
    title: "Settings",
    subtitle: "Manage your admin account and system settings.",
  },
};

function showSection(sectionName) {
  if (!sectionName) return;

  sections.forEach((section) => {
    section.classList.remove("active-section");
  });

  const selectedSection = document.getElementById(sectionName);
  if (selectedSection) {
    selectedSection.classList.add("active-section");
  }

  if (pageData[sectionName] && pageTitle && pageSubtitle) {
    pageTitle.textContent = pageData[sectionName].title;
    pageSubtitle.textContent = pageData[sectionName].subtitle;
  }

  navItems.forEach((item) => {
    item.classList.remove("active");
  });

  const activeItem = document.querySelector(`[data-section="${sectionName}"]`);
  if (activeItem) {
    activeItem.classList.add("active");
  }

  if (sidebar && sidebarOverlay) {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
  }

  if (sectionName === "dashboard" && miniFleetMap && miniFleetMap.map) {
    [50, 200, 500].forEach((ms) => {
      setTimeout(() => miniFleetMap.map.invalidateSize(), ms);
    });
  }

  if (sectionName === "tracking") {
    if (!adminFleetMap) {
      adminFleetMap = createFleetMap("adminMap", 14);
      updateFleetMarkers(adminFleetMap);
    }
    [50, 200, 500].forEach((ms) => {
      setTimeout(() => {
        if (adminFleetMap && adminFleetMap.map) {
          adminFleetMap.map.invalidateSize();
        }
      }, ms);
    });
  }

  if (sectionName === "routes" && routeBuilderMap) {
    [50, 200, 500].forEach((ms) => {
      setTimeout(() => {
        routeBuilderMap.invalidateSize();
      }, ms);
    });
  }
}

navItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    const sectionName = item.getAttribute("data-section");
    showSection(sectionName);
  });
});

document.querySelectorAll(".view-all").forEach((button) => {
  button.addEventListener("click", () => {
    const section = button.getAttribute("data-section");
    if (section) showSection(section);
  });
});

// ========================================================
// 2. DATA STATE & PERSISTENCE
// ========================================================

let allBuses = {};
let allDrivers = {};
let allRoutes = {};
let allLocations = {};
let allAttendance = {};
let activeListeners = [];

// Load persisted data on startup (with Kolhapur default seed fallback)
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
} catch (e) {
  console.warn("Storage init notice:", e.message);
}

try {
  allAttendance = JSON.parse(localStorage.getItem("smartbus_attendance") || "{}");
} catch (error) {
  console.warn("Attendance cache init notice:", error.message);
}

// Initial render from local cache
renderBusesTable();
renderDriversTable();
renderRoutesTable();
updateOverviewStats();
renderAttendanceReport();
renderNotificationRecipientOptions();

// ========================================================
// 3. AUTH GUARD & SESSION CHECK
// ========================================================

if (typeof requireRole === "function") {
  requireRole("admin", (user, profile) => {
    console.log("Admin verified:", profile?.name || user?.email);
    const profileNameEl = document.querySelector(".profile-info strong");
    if (profileNameEl && profile && profile.name) {
      profileNameEl.textContent = profile.name;
    }
    initDashboardListeners();
  });
} else {
  const isAdmin = sessionStorage.getItem("adminLoggedIn") === "true" || sessionStorage.getItem("adminRole") === "admin";
  if (!isAdmin) {
    window.location.href = "admin-login.html";
  } else {
    initDashboardListeners();
  }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    if (!confirm("Are you sure you want to log out?")) return;

    activeListeners.forEach((unsub) => {
      if (typeof unsub === "function") unsub();
    });
    activeListeners = [];

    if (typeof logout === "function") {
      await logout("admin-login.html");
    } else {
      sessionStorage.clear();
      window.location.href = "admin-login.html";
    }
  });
}

// ========================================================
// 4. UI MESSAGE BANNER
// ========================================================

let messageTimeout = null;

function showUIMessage(message, isError = false) {
  const banner = document.getElementById("uiMessageBanner");
  if (!banner) return;

  if (messageTimeout) clearTimeout(messageTimeout);

  banner.textContent = message;
  banner.style.display = "block";
  if (isError) {
    banner.style.background = "#fee2e2";
    banner.style.color = "#991b1b";
    banner.style.border = "1px solid #ef4444";
  } else {
    banner.style.background = "#dcfce7";
    banner.style.color = "#166534";
    banner.style.border = "1px solid #22c55e";
  }

  messageTimeout = setTimeout(() => {
    banner.style.display = "none";
  }, 6000);
}

function renderDriverAlerts(alertsData) {
  const list = document.getElementById("driverAlertsList");
  if (!list) return;

  const alerts = Object.entries(alertsData || {})
    .map(([id, alert]) => ({ id, ...alert }))
    .filter((alert) => alert.type === "driver_message")
    .sort((left, right) => Number(right.ts || 0) - Number(left.ts || 0))
    .slice(0, 30);

  if (!alerts.length) {
    list.innerHTML = '<p style="opacity:0.6;">No messages from drivers.</p>';
    return;
  }

  list.innerHTML = alerts.map((alert) => {
    const timestamp = Number(alert.ts);
    const sentAt = Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp).toLocaleString("en-IN")
      : "Time unavailable";
    const voiceUrl = typeof alert.voiceUrl === "string" && /^https:\/\/[^\s"'<>]+$/i.test(alert.voiceUrl)
      ? alert.voiceUrl
      : "";
    const hasCoordinates =
      alert.location &&
      Number.isFinite(Number(alert.location.lat)) &&
      Number.isFinite(Number(alert.location.lng));
    const mapLink = hasCoordinates
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${Number(alert.location.lat)},${Number(alert.location.lng)}`)}`
      : "";

    return `
      <article style="padding:12px 14px; margin-bottom:10px; border:1px solid #e2e8f0; border-left:4px solid #2563eb; border-radius:8px; background:#fff;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <strong>Driver message · ${escapeReportHtml(alert.driverName || alert.driverUid || "Driver")}</strong>
          <span style="color:#64748b; font-size:12px;">${escapeReportHtml(sentAt)}</span>
        </div>
        <div style="margin-top:4px; color:#475569; font-size:12px;">Bus: ${escapeReportHtml(alert.busNumber || "Unknown")}</div>
        ${alert.message ? `<p style="margin-top:8px; white-space:pre-wrap; overflow-wrap:anywhere;">${escapeReportHtml(alert.message)}</p>` : ""}
        ${voiceUrl ? `<audio controls preload="none" src="${escapeReportHtml(voiceUrl)}" style="display:block; width:min(100%, 420px); margin-top:9px;"></audio>` : ""}
        ${mapLink ? `<a href="${mapLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:8px; color:#1d4ed8; font-size:12px; font-weight:700;">View driver location</a>` : ""}
      </article>
    `;
  }).join("");
}

function renderAdminNotifications(notificationsData) {
  const list = document.getElementById("notificationsList");
  if (!list) return;

  const messages = Object.entries(notificationsData || {})
    .map(([id, notification]) => ({ id, ...notification }))
    .filter((notification) => notification && notification.message)
    .sort((left, right) => Number(right.sentAt || 0) - Number(left.sentAt || 0))
    .slice(0, 30);

  if (!messages.length) {
    list.innerHTML = '<p style="opacity:0.6;">No admin messages sent yet.</p>';
    return;
  }

  list.innerHTML = messages.map((notification) => {
    const sentAt = Number(notification.sentAt);
    const dateText = sentAt > 0 ? new Date(sentAt).toLocaleString("en-IN") : "Time unavailable";
    const recipientText = notification.recipientUid === "all"
      ? "All drivers"
      : notification.recipientName || allDrivers[notification.recipientUid]?.name || "Selected driver";

    return `
      <article style="padding:11px 13px; margin-bottom:8px; border:1px solid #e2e8f0; border-radius:8px;">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <strong>To: ${escapeReportHtml(recipientText)}</strong>
          <span style="color:#64748b; font-size:12px;">${escapeReportHtml(dateText)}</span>
        </div>
        <p style="margin-top:6px; white-space:pre-wrap; overflow-wrap:anywhere;">${escapeReportHtml(notification.message)}</p>
      </article>
    `;
  }).join("");
}

function renderNotificationRecipientOptions() {
  const select = document.getElementById("notifRecipientSelect");
  if (!select) return;

  const selected = select.value || "all";
  const driverOptions = Object.entries(allDrivers)
    .filter(([, driver]) => driver && typeof driver === "object")
    .sort(([, left], [, right]) => (left.name || left.displayName || "").localeCompare(right.name || right.displayName || ""))
    .map(([uid, driver]) =>
      `<option value="${escapeReportHtml(uid)}">${escapeReportHtml(driver.name || driver.displayName || uid)}</option>`
    )
    .join("");
  select.innerHTML = `<option value="all">All drivers</option>${driverOptions}`;
  if (selected === "all" || allDrivers[selected]) select.value = selected;
}

const sendNotifBtn = document.getElementById("sendNotifBtn");
if (sendNotifBtn) {
  sendNotifBtn.addEventListener("click", async () => {
    const input = document.getElementById("notifMessageInput");
    const recipientSelect = document.getElementById("notifRecipientSelect");
    const status = document.getElementById("notificationSendStatus");
    const message = input ? input.value.trim() : "";
    const recipientUid = recipientSelect ? recipientSelect.value : "all";

    if (!message) {
      if (status) status.textContent = "Enter a message before sending.";
      return;
    }
    if (message.length > 1000) {
      if (status) status.textContent = "Messages must be 1,000 characters or fewer.";
      return;
    }
    if (!db || typeof db.ref !== "function") {
      if (status) status.textContent = "Message service is unavailable. Check the database connection.";
      return;
    }
    if (recipientUid !== "all" && !allDrivers[recipientUid]) {
      if (status) status.textContent = "Select a valid driver from the list.";
      return;
    }

    sendNotifBtn.disabled = true;
    if (status) status.textContent = "Sending message...";
    try {
      if (!auth || typeof auth.onAuthStateChanged !== "function") {
        throw new Error("Firebase Authentication is unavailable. Check the Firebase configuration.");
      }

      const currentUser = auth.currentUser || await new Promise((resolve, reject) => {
        let unsubscribe = () => {};
        const timeout = setTimeout(() => {
          unsubscribe();
          reject(new Error("Firebase sign-in is still loading. Please try again."));
        }, 10000);

        unsubscribe = auth.onAuthStateChanged(
          (user) => {
            clearTimeout(timeout);
            unsubscribe();
            resolve(user);
          },
          (error) => {
            clearTimeout(timeout);
            unsubscribe();
            reject(error);
          }
        );
      });
      if (!currentUser) {
        throw new Error("Sign in to Firebase with an admin account before sending messages.");
      }

      const adminProfileSnapshot = await db.ref(`users/${currentUser.uid}`).once("value");
      const adminProfile = adminProfileSnapshot.val();
      if (!adminProfile || adminProfile.role !== "admin") {
        throw new Error("This Firebase account is not marked as an admin in Realtime Database (users/{uid}/role).");
      }

      const profileName = document.querySelector(".profile-info strong");
      const notification = {
        message,
        recipientUid,
        recipientName: recipientUid === "all"
          ? "All drivers"
          : allDrivers[recipientUid].name || allDrivers[recipientUid].displayName || recipientUid,
        senderUid: currentUser.uid,
        senderName: currentUser.displayName || (profileName ? profileName.textContent.trim() : "Admin"),
        sentAt: typeof serverTimestamp === "function" ? serverTimestamp() : Date.now(),
      };
      const deliveryPath = recipientUid === "all"
        ? "broadcastNotifications"
        : `driverNotifications/${recipientUid}`;
      const deliveryRef = db.ref(deliveryPath).push();
      if (!deliveryRef.key) throw new Error("Could not create a message ID.");
      await deliveryRef.set(notification);

      let historySaved = true;
      try {
        await db.ref(`adminSentNotifications/${deliveryRef.key}`).set(notification);
      } catch (historyError) {
        historySaved = false;
        console.error("Message delivered, but admin message history could not be saved:", historyError);
      }

      if (input) input.value = "";
      if (status) status.textContent = recipientUid === "all"
        ? `Message sent to all drivers.${historySaved ? "" : " It was delivered, but could not be added to sent history."}`
        : `Message sent to ${notification.recipientName}.${historySaved ? "" : " It was delivered, but could not be added to sent history."}`;
    } catch (error) {
      console.error("Could not send admin message:", error);
      const errorMessage = String(error && error.message || "");
      const permissionDenied = error && (
        error.code === "PERMISSION_DENIED" ||
        error.code === "permission_denied" ||
        /permission_denied|permission denied/i.test(errorMessage)
      );
      if (status) {
        status.textContent = permissionDenied
          ? "Firebase denied the write. Deploy the latest database.rules.json and confirm this signed-in account has role \"admin\" at users/{uid}/role."
          : errorMessage || "Could not send the message. Please try again.";
      }
    } finally {
      sendNotifBtn.disabled = false;
    }
  });
}

function escapeReportHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function getAttendanceReportDate() {
  const dateInput = document.getElementById("attendanceReportDate");
  if (!dateInput) return new Date().toISOString().slice(0, 10);
  if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
  return dateInput.value;
}

function getAttendanceDate(record, recordId) {
  if (record && record.date) return String(record.date);
  const dateMatch = String(recordId || "").match(/\d{4}-\d{2}-\d{2}/);
  return dateMatch ? dateMatch[0] : "";
}

function getSelectedAttendanceDriver() {
  const driverSelect = document.getElementById("attendanceReportDriver");
  return driverSelect ? driverSelect.value : "";
}

function formatAttendanceReportTime(value) {
  if (value == null || value === "") return "—";
  const parsed = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function getAttendanceReportRows() {
  const reportDate = getAttendanceReportDate();
  const recordsByDriver = {};

  Object.entries(allAttendance).forEach(([recordId, record]) => {
    if (!record || getAttendanceDate(record, recordId) !== reportDate) return;
    const driverUid = record.driverUid || record.uid || String(recordId).replace(new RegExp(`_${reportDate}$`), "");
    if (driverUid) recordsByDriver[driverUid] = record;
  });

  const rows = Object.entries(allDrivers).map(([uid, driver]) => {
    const record = recordsByDriver[uid] || null;
    const busNo =
      (record && (record.busNo || record.assignedBus)) ||
      (driver && driver.assignedBus) ||
      Object.entries(allBuses).find(([, bus]) => bus && bus.assignedDriver === uid)?.[0] ||
      "—";
    const routeId = (record && record.routeId) || (driver && driver.assignedRoute) || allBuses[busNo]?.routeId;
    const route = routeId && allRoutes[routeId];
    const rawStatus = record ? String(record.status || "Present") : "Not Marked";

    return {
      uid,
      driverName: (driver && (driver.name || driver.displayName)) || (record && record.driverName) || uid,
      busNo,
      routeName: route ? route.name || routeId : routeId || "—",
      status: rawStatus,
      markedAt: record ? formatAttendanceReportTime(record.markedAt || record.timestamp) : "—",
      isMarked: Boolean(record),
    };
  }).sort((left, right) => left.driverName.localeCompare(right.driverName));

  const selectedDriver = getSelectedAttendanceDriver();
  return selectedDriver ? rows.filter((row) => row.uid === selectedDriver) : rows;
}

function renderAttendanceReport() {
  const tbody = document.getElementById("reportAttendanceBody");
  if (!tbody) return;

  const driverSelect = document.getElementById("attendanceReportDriver");
  if (driverSelect) {
    const selectedDriver = driverSelect.value;
    const options = Object.entries(allDrivers)
      .sort(([, left], [, right]) => (left.name || left.displayName || "").localeCompare(right.name || right.displayName || ""))
      .map(([uid, driver]) => `<option value="${escapeReportHtml(uid)}">${escapeReportHtml(driver.name || driver.displayName || uid)}</option>`)
      .join("");
    driverSelect.innerHTML = `<option value="">All drivers</option>${options}`;
    if (allDrivers[selectedDriver]) driverSelect.value = selectedDriver;
  }

  const rows = getAttendanceReportRows();
  const selectedDriver = getSelectedAttendanceDriver();
  const markedCount = rows.filter((row) => row.isMarked).length;
  const notMarked = rows.filter((row) => !row.isMarked);
  const summary = document.getElementById("attendanceReportSummary");
  const notMarkedText = document.getElementById("reportNotMarked");

  if (summary) {
    summary.textContent = selectedDriver
      ? `${markedCount ? "Attendance marked" : "Not marked"} · ${rows[0] ? rows[0].driverName : "Driver"}`
      : `${markedCount} marked · ${notMarked.length} not marked · ${rows.length} drivers`;
  }
  if (notMarkedText) {
    notMarkedText.textContent = selectedDriver && rows[0]
      ? `${rows[0].driverName}: ${rows[0].isMarked ? "attendance recorded" : "attendance not marked"} for this date.`
      : notMarked.length
      ? `Not marked: ${notMarked.map((row) => row.driverName).join(", ")}`
      : "All listed drivers have marked attendance for this date.";
  }
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity:0.6; padding:20px;">No drivers found.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeReportHtml(row.driverName)}</td>
      <td>${escapeReportHtml(row.busNo)}</td>
      <td>${escapeReportHtml(row.routeName)}</td>
      <td><span class="table-status ${row.isMarked ? "completed" : ""}">${escapeReportHtml(row.status)}</span></td>
      <td>${escapeReportHtml(row.markedAt)}</td>
    </tr>
  `).join("");
}

function downloadAttendanceReportPdf() {
  const PdfConstructor = window.jspdf && window.jspdf.jsPDF;
  if (!PdfConstructor) {
    showUIMessage("PDF support could not be loaded. Check your internet connection and reload the dashboard.", true);
    return;
  }

  try {
  const reportDate = getAttendanceReportDate();
  const rows = getAttendanceReportRows();
  const markedCount = rows.filter((row) => row.isMarked).length;
  const selectedDriver = getSelectedAttendanceDriver();
  const reportTitle = selectedDriver && rows[0]
    ? `Attendance Report - ${rows[0].driverName}`
    : "Driver Attendance Report";
  const doc = new PdfConstructor({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 12;
  const columns = [
    { label: "Driver", key: "driverName", width: 68 },
    { label: "Bus", key: "busNo", width: 52 },
    { label: "Route", key: "routeName", width: 85 },
    { label: "Status", key: "status", width: 35 },
    { label: "Marked At", key: "markedAt", width: 35 },
  ];
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const tableLeft = Math.max(left, (pageWidth - tableWidth) / 2);
  let y = 48;

  const drawHeader = () => {
    doc.setFillColor(37, 99, 235);
    doc.rect(tableLeft, y, tableWidth, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    let x = tableLeft + 2;
    columns.forEach((column) => {
      doc.text(column.label, x, y + 6);
      x += column.width;
    });
    y += 9;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(reportTitle, left, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Report date: ${reportDate}`, left, 25);
  doc.text(
    selectedDriver
      ? `Status: ${rows[0] && rows[0].isMarked ? "Attendance marked" : "Not marked"}`
      : `Summary: ${markedCount} marked, ${rows.length - markedCount} not marked, ${rows.length} drivers`,
    left,
    32
  );
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, left, 39);

  drawHeader();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  (rows.length ? rows : [{ driverName: "No drivers found", busNo: "—", routeName: "—", status: "—", markedAt: "—" }]).forEach((row, index) => {
    const cellLines = columns.map((column) =>
      doc.splitTextToSize(String(row[column.key] || "—"), column.width - 4)
    );
    const lineCount = Math.max(...cellLines.map((lines) => lines.length));
    const rowHeight = Math.max(8, lineCount * 4 + 3);

    if (y + rowHeight > pageHeight - 12) {
      doc.addPage();
      y = 14;
      drawHeader();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
    }

    if (index % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(tableLeft, y, tableWidth, rowHeight, "F");
    }
    let x = tableLeft + 2;
    cellLines.forEach((lines, columnIndex) => {
      doc.text(lines, x, y + 4);
      x += columns[columnIndex].width;
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(tableLeft, y + rowHeight, tableLeft + tableWidth, y + rowHeight);
    y += rowHeight;
  });

  const driverFilePart = selectedDriver && rows[0]
    ? `-${rows[0].driverName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}`
    : "";
  doc.save(`driver-attendance${driverFilePart}-${reportDate}.pdf`);
  } catch (error) {
    console.error("Could not generate the attendance PDF:", error);
    showUIMessage("Could not generate the attendance PDF. Please try again.", true);
  }
}

const attendanceReportDateInput = document.getElementById("attendanceReportDate");
if (attendanceReportDateInput) {
  attendanceReportDateInput.value = new Date().toISOString().slice(0, 10);
  attendanceReportDateInput.addEventListener("change", renderAttendanceReport);
}

const attendanceReportDriverSelect = document.getElementById("attendanceReportDriver");
if (attendanceReportDriverSelect) {
  attendanceReportDriverSelect.addEventListener("change", renderAttendanceReport);
}

const refreshAttendanceReportBtn = document.getElementById("refreshAttendanceReportBtn");
if (refreshAttendanceReportBtn) {
  refreshAttendanceReportBtn.addEventListener("click", async () => {
    if (!db || typeof db.ref !== "function") {
      renderAttendanceReport();
      showUIMessage("Showing attendance records available on this device. Cloud database is not connected.", true);
      return;
    }
    try {
      const snapshot = await db.ref("attendance").once("value");
      allAttendance = { ...allAttendance, ...(snapshot.val() || {}) };
      renderAttendanceReport();
      showUIMessage("Attendance report refreshed.", false);
    } catch (error) {
      console.error("Could not refresh attendance report:", error);
      showUIMessage("Could not refresh attendance from the cloud. Showing the latest available records.", true);
    }
  });
}

const downloadAttendancePdfBtn = document.getElementById("downloadAttendancePdfBtn");
if (downloadAttendancePdfBtn) {
  downloadAttendancePdfBtn.addEventListener("click", downloadAttendanceReportPdf);
}

// ========================================================
// 5. FIREBASE CLOUD LISTENERS (SYNC)
// ========================================================

function initDashboardListeners() {
  if (typeof onValue !== "function" || typeof ref !== "function") return;

  // Listen to buses from Firebase
  try {
    const unsubBuses = onValue(
      ref(db, "buses"),
      (snapshot) => {
        const cloudBuses = snapshot.val() || {};
        allBuses = cloudBuses;
        localStorage.setItem("smartbus_buses", JSON.stringify(allBuses));
        renderBusesTable();
        renderDriversTable();
        renderRoutesTable();
        renderBusStatusWidget();
        updateOverviewStats();
        updateAllFleetMaps();
        renderAttendanceReport();
      },
      (err) => console.warn("Buses cloud sync notice:", err.message)
    );
    activeListeners.push(unsubBuses);
  } catch (e) {}

  // Listen to users (drivers)
  try {
    const unsubUsers = onValue(
      ref(db, "users"),
      (snapshot) => {
        const usersData = snapshot.val() || {};
        const cloudDrivers = {};
        Object.entries(usersData).forEach(([uid, u]) => {
          if (u && u.role === "driver") {
            cloudDrivers[uid] = { uid, ...u };
          }
        });
        allDrivers = cloudDrivers;
        localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
        renderNotificationRecipientOptions();
        renderDriversTable();
        renderBusesTable();
        renderRoutesTable();
        updateOverviewStats();
        renderAttendanceReport();
      },
      (err) => console.warn("Drivers cloud sync notice:", err.message)
    );
    activeListeners.push(unsubUsers);
  } catch (e) {}

  // Listen to messages sent by admins
  try {
    const unsubNotifications = onValue(
      ref(db, "adminSentNotifications").limitToLast(100),
      (snapshot) => renderAdminNotifications(snapshot.val() || {}),
      (err) => {
        console.error("Could not load admin notifications:", err);
        showUIMessage("Could not load sent admin messages.", true);
      }
    );
    activeListeners.push(unsubNotifications);
  } catch (error) {
    console.error("Could not start admin notification listener:", error);
  }

  // Listen to driver attendance records
  try {
    const unsubAttendance = onValue(
      ref(db, "attendance"),
      (snapshot) => {
        allAttendance = { ...allAttendance, ...(snapshot.val() || {}) };
        renderAttendanceReport();
      },
      (err) => {
        console.warn("Attendance cloud sync notice:", err.message);
        showUIMessage("Could not load attendance from the cloud. Showing locally saved records.", true);
      }
    );
    activeListeners.push(unsubAttendance);
  } catch (error) {
    console.error("Could not start attendance listener:", error);
  }

  // Listen to driver messages
  try {
    const alertsRef = ref(db, "alerts");
    const recentAlertsRef = alertsRef && typeof alertsRef.limitToLast === "function"
      ? alertsRef.limitToLast(50)
      : alertsRef;
    const unsubAlerts = onValue(
      recentAlertsRef,
      (snapshot) => renderDriverAlerts(snapshot.val() || {}),
      (err) => {
        console.error("Could not load driver messages:", err);
        showUIMessage("Could not load driver messages from the database.", true);
      }
    );
    activeListeners.push(unsubAlerts);
  } catch (error) {
    console.error("Could not start driver alert listener:", error);
  }

  // Listen to routes
  try {
    const unsubRoutes = onValue(
      ref(db, "routes"),
      (snapshot) => {
        const cloudRoutes = snapshot.val() || {};
        allRoutes = cloudRoutes;
        localStorage.setItem("smartbus_routes", JSON.stringify(allRoutes));
        renderRoutesTable();
        renderBusesTable();
        renderDriversTable();
        updateOverviewStats();
        renderAttendanceReport();
      },
      (err) => console.warn("Routes cloud sync notice:", err.message)
    );
    activeListeners.push(unsubRoutes);
  } catch (e) {}

  // Listen to locations
  try {
    const unsubLocations = onValue(
      ref(db, "locations"),
      (snapshot) => {
        allLocations = snapshot.val() || {};
        renderBusesTable();
        updateAllFleetMaps();
      },
      (err) => console.warn("Locations cloud notice:", err.message)
    );
    activeListeners.push(unsubLocations);
  } catch (e) {}
}

// ========================================================
// 6. BUSES: ADD / DELETE & LIVE TABLE
// ========================================================

const addBusBtn = document.getElementById("addBusBtn");
const addBusCard = document.getElementById("addBusCard");
const addBusForm = document.getElementById("addBusForm");
const saveBusBtn = document.getElementById("saveBusBtn");
const cancelBusBtn = document.getElementById("cancelBusBtn");

if (addBusBtn && addBusCard) {
  addBusBtn.addEventListener("click", () => {
    addBusCard.style.display = addBusCard.style.display === "none" ? "block" : "none";
    if (addBusCard.style.display === "block") {
      document.getElementById("busNumberInput")?.focus();
    }
  });
}

if (cancelBusBtn && addBusCard) {
  cancelBusBtn.addEventListener("click", () => {
    addBusCard.style.display = "none";
    addBusForm?.reset();
  });
}

// Handle Save Bus with instant local update + Firebase sync
async function handleSaveBus(e) {
  if (e) e.preventDefault();

  const busNoInput = document.getElementById("busNumberInput");
  const capacityInput = document.getElementById("busCapacityInput");

  if (!busNoInput || !capacityInput) return;

  const busNo = busNoInput.value.trim();
  const capacity = parseInt(capacityInput.value, 10);

  if (!busNo) {
    showUIMessage("Please enter a valid bus number.", true);
    return;
  }
  if (isNaN(capacity) || capacity <= 0) {
    showUIMessage("Please enter a valid seating capacity.", true);
    return;
  }

  if (allBuses[busNo]) {
    showUIMessage(`Bus "${busNo}" already exists! Bus numbers must be unique.`, true);
    return;
  }

  const busData = {
    busNo,
    capacity,
    assignedDriver: null,
    routeId: null,
  };

  // 1. Optimistic Update: Save to local state and re-render table immediately
  allBuses[busNo] = busData;
  localStorage.setItem("smartbus_buses", JSON.stringify(allBuses));
  renderBusesTable();
  updateOverviewStats();

  // 2. Reset and close form
  if (addBusForm) addBusForm.reset();
  if (addBusCard) addBusCard.style.display = "none";
  showUIMessage(`Bus "${busNo}" created successfully!`, false);

  // 3. Sync to Firebase Realtime Database
  if (typeof set === "function" && typeof ref === "function") {
    try {
      const busRef = ref(db, `buses/${busNo}`);
      if (busRef) {
        set(busRef, busData).catch((err) => console.warn("Firebase sync notice:", err.message));
      }
    } catch (err) {
      console.warn("Firebase set notice:", err.message);
    }
  }
}

if (addBusForm) {
  addBusForm.addEventListener("submit", handleSaveBus);
}
if (saveBusBtn) {
  saveBusBtn.addEventListener("click", handleSaveBus);
}

function renderBusesTable() {
  const tbody = document.getElementById("busesTableBody");
  if (!tbody) return;

  const busEntries = Object.entries(allBuses);

  if (busEntries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; opacity:0.6; padding:20px;">No buses yet. Click "Add Bus" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = busEntries
    .map(([busNo, bus]) => {
      const driver = bus.assignedDriver ? allDrivers[bus.assignedDriver] : null;
      const route = bus.routeId ? allRoutes[bus.routeId] : null;
      const isLive = isBusLive(busNo);

      const driverDisplay = driver ? `<strong>${driver.name}</strong>` : `<span style="opacity:0.6;">Unassigned</span>`;
      const routeDisplay = route ? `<strong>${route.name}</strong>` : `<span style="opacity:0.6;">Unassigned</span>`;

      return `
        <tr>
          <td><strong>${busNo}</strong></td>
          <td>${bus.capacity || "-"}</td>
          <td>${driverDisplay}</td>
          <td>${routeDisplay}</td>
          <td>
            <span class="table-status ${isLive ? "running" : "stopped"}">
              ${isLive ? "LIVE" : "Offline"}
            </span>
          </td>
          <td>
            <button class="primary-action" style="background:#ef4444; padding:6px 12px; font-size:11px;" onclick="window.handleDeleteBus('${busNo}')">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

window.handleDeleteBus = async function (busNo) {
  if (!confirm(`Are you sure you want to delete bus "${busNo}"?`)) return;

  const bus = allBuses[busNo];
  delete allBuses[busNo];
  delete allLocations[busNo];

  if (bus && bus.assignedDriver && allDrivers[bus.assignedDriver]) {
    allDrivers[bus.assignedDriver].assignedBus = null;
    allDrivers[bus.assignedDriver].assignedRoute = null;
    localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
    renderDriversTable();
  }

  localStorage.setItem("smartbus_buses", JSON.stringify(allBuses));
  renderBusesTable();
  updateOverviewStats();
  showUIMessage(`Bus "${busNo}" deleted successfully.`, false);

  if (typeof update === "function" && typeof ref === "function") {
    try {
      const updates = {};
      updates[`buses/${busNo}`] = null;
      updates[`locations/${busNo}`] = null;
      if (bus && bus.assignedDriver) {
        updates[`users/${bus.assignedDriver}/assignedBus`] = null;
        updates[`users/${bus.assignedDriver}/assignedRoute`] = null;
      }
      const rootRef = ref(db);
      if (rootRef) update(rootRef, updates).catch((err) => console.warn("Firebase delete sync notice:", err.message));
    } catch (e) {}
  }
};

// ========================================================
// 7. DRIVERS: ADD / DELETE (SECONDARY APP METHOD)
// ========================================================

const addDriverBtn = document.getElementById("addDriverBtn");
const addDriverCard = document.getElementById("addDriverCard");
const addDriverForm = document.getElementById("addDriverForm");
const saveDriverBtn = document.getElementById("saveDriverBtn");
const cancelDriverBtn = document.getElementById("cancelDriverBtn");

if (addDriverBtn && addDriverCard) {
  addDriverBtn.addEventListener("click", () => {
    addDriverCard.style.display = addDriverCard.style.display === "none" ? "block" : "none";
    if (addDriverCard.style.display === "block") {
      document.getElementById("driverNameInput")?.focus();
    }
  });
}

if (cancelDriverBtn && addDriverCard) {
  cancelDriverBtn.addEventListener("click", () => {
    addDriverCard.style.display = "none";
    addDriverForm?.reset();
  });
}

async function handleSaveDriver(e) {
  if (e) e.preventDefault();

  const nameInput = document.getElementById("driverNameInput");
  const phoneInput = document.getElementById("driverPhoneInput");
  const addressInput = document.getElementById("driverAddressInput");
  const emailInput = document.getElementById("driverEmailInput");
  const passwordInput = document.getElementById("driverPasswordInput");

  if (!nameInput || !phoneInput || !emailInput || !passwordInput) return;

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const address = addressInput ? addressInput.value.trim() : "";
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!name) {
    showUIMessage("Driver name is required.", true);
    return;
  }
  if (!/^\d{10}$/.test(phone)) {
    showUIMessage("Phone number must be exactly 10 digits.", true);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showUIMessage("Please enter a valid email address.", true);
    return;
  }
  if (password.length < 6) {
    showUIMessage("Password must be at least 6 characters long.", true);
    return;
  }

  const driverUid = "driver_" + Date.now();
  const driverData = {
    uid: driverUid,
    name,
    phone,
    address,
    email,
    password,
    tempPassword: password,
    role: "driver",
    assignedBus: null,
    assignedRoute: null,
    createdAt: new Date().toISOString(),
  };

  // Optimistic Update
  allDrivers[driverUid] = driverData;
  localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
  renderDriversTable();
  updateOverviewStats();

  if (addDriverForm) addDriverForm.reset();
  if (addDriverCard) addDriverCard.style.display = "none";
  showUIMessage(`Driver "${name}" created successfully!`, false);

  // Background Firebase creation
  if (typeof initializeApp === "function" && typeof firebaseConfig !== "undefined" && firebaseConfig) {
    try {
      const secondaryApp = initializeApp(firebaseConfig, "secondary-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const realUid = userCredential.user.uid;

      delete allDrivers[driverUid];
      driverData.uid = realUid;
      allDrivers[realUid] = driverData;
      localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));

      if (typeof set === "function" && typeof ref === "function") {
        await set(ref(db, `users/${realUid}`), driverData);
      }
      await signOut(secondaryAuth);
    } catch (err) {
      console.warn("Firebase driver creation notice:", err.message);
    }
  }
}

if (addDriverForm) addDriverForm.addEventListener("submit", handleSaveDriver);
if (saveDriverBtn) saveDriverBtn.addEventListener("click", handleSaveDriver);

// ========================================================
// 7.1 DRIVER EDIT & PASSWORD RESET (ADMIN AUTHORITY)
// ========================================================

const editDriverCard = document.getElementById("editDriverCard");
const editDriverForm = document.getElementById("editDriverForm");
const editDriverUid = document.getElementById("editDriverUid");
const editDriverName = document.getElementById("editDriverName");
const editDriverPhone = document.getElementById("editDriverPhone");
const editDriverAddress = document.getElementById("editDriverAddress");
const editDriverEmail = document.getElementById("editDriverEmail");
const editDriverPassword = document.getElementById("editDriverPassword");
const sendResetEmailBtn = document.getElementById("sendResetEmailBtn");
const saveEditDriverBtn = document.getElementById("saveEditDriverBtn");
const cancelEditDriverBtn = document.getElementById("cancelEditDriverBtn");

if (cancelEditDriverBtn && editDriverCard) {
  cancelEditDriverBtn.addEventListener("click", () => {
    editDriverCard.style.display = "none";
    if (editDriverForm) editDriverForm.reset();
  });
}

window.handleEditDriver = function (uid) {
  const driver = allDrivers[uid];
  if (!driver) {
    showUIMessage("Driver not found.", true);
    return;
  }

  if (editDriverUid) editDriverUid.value = uid;
  if (editDriverName) editDriverName.value = driver.name || "";
  if (editDriverPhone) editDriverPhone.value = driver.phone || "";
  if (editDriverAddress) editDriverAddress.value = driver.address || "";
  if (editDriverEmail) editDriverEmail.value = driver.email || "";
  if (editDriverPassword) editDriverPassword.value = driver.password || driver.tempPassword || "";

  if (addDriverCard) addDriverCard.style.display = "none";
  if (editDriverCard) {
    editDriverCard.style.display = "block";
    editDriverCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  if (editDriverName) editDriverName.focus();
};

if (sendResetEmailBtn) {
  sendResetEmailBtn.addEventListener("click", async () => {
    const email = editDriverEmail ? editDriverEmail.value.trim() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showUIMessage("Please provide a valid email to send a password reset link.", true);
      return;
    }
    try {
      if (typeof auth !== "undefined" && typeof auth.sendPasswordResetEmail === "function") {
        await auth.sendPasswordResetEmail(email);
        showUIMessage(`Password reset link successfully sent to ${email}.`, false);
      } else if (typeof sendPasswordResetEmail === "function") {
        const defaultAuth = getAuth();
        await sendPasswordResetEmail(defaultAuth, email);
        showUIMessage(`Password reset link successfully sent to ${email}.`, false);
      } else {
        showUIMessage(`Password reset noted for ${email}. Driver can also log in using new password set above.`, false);
      }
    } catch (err) {
      showUIMessage("Password reset email notice: " + (err.message || err), true);
    }
  });
}

async function handleSaveEditDriver(e) {
  if (e) e.preventDefault();

  const uid = editDriverUid ? editDriverUid.value.trim() : "";
  if (!uid || !allDrivers[uid]) {
    showUIMessage("Selected driver could not be found.", true);
    return;
  }

  const name = editDriverName ? editDriverName.value.trim() : "";
  const phone = editDriverPhone ? editDriverPhone.value.trim() : "";
  const address = editDriverAddress ? editDriverAddress.value.trim() : "";
  const email = editDriverEmail ? editDriverEmail.value.trim() : "";
  const newPassword = editDriverPassword ? editDriverPassword.value.trim() : "";

  if (!name) {
    showUIMessage("Driver name is required.", true);
    return;
  }
  if (!/^\d{10}$/.test(phone)) {
    showUIMessage("Phone number must be exactly 10 digits.", true);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showUIMessage("Please enter a valid email address.", true);
    return;
  }
  if (newPassword && newPassword.length < 6) {
    showUIMessage("New password must be at least 6 characters long.", true);
    return;
  }

  // Update in memory and local storage
  const driver = allDrivers[uid];
  driver.name = name;
  driver.phone = phone;
  driver.address = address;
  driver.email = email;
  if (newPassword) {
    driver.password = newPassword;
    driver.tempPassword = newPassword;
  }

  localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
  renderDriversTable();
  updateOverviewStats();

  if (editDriverCard) editDriverCard.style.display = "none";
  showUIMessage(`Driver "${name}" details updated successfully!` + (newPassword ? " New password saved." : ""), false);

  // Sync to Firebase Realtime Database
  try {
    const updates = {};
    updates[`users/${uid}/name`] = name;
    updates[`users/${uid}/phone`] = phone;
    updates[`users/${uid}/address`] = address;
    updates[`users/${uid}/email`] = email;
    if (newPassword) {
      updates[`users/${uid}/password`] = newPassword;
      updates[`users/${uid}/tempPassword`] = newPassword;
    }

    if (typeof update === "function" && typeof ref === "function") {
      const rootRef = ref(db);
      if (rootRef) update(rootRef, updates).catch((err) => console.warn("Firebase update driver notice:", err.message));
    }

    // Firestore fallback
    if (typeof firestoreDb !== "undefined" && firestoreDb && typeof firestoreDb.collection === "function") {
      const firestoreUpdates = { name, phone, address, email };
      if (newPassword) {
        firestoreUpdates.password = newPassword;
        firestoreUpdates.tempPassword = newPassword;
      }
      firestoreDb.collection("users").doc(uid).set(firestoreUpdates, { merge: true }).catch((err) => console.warn("Firestore update notice:", err.message));
    }

    // Backend sync
    fetch(`/api/drivers/${encodeURIComponent(uid)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, address, email, password: newPassword || undefined }),
    }).catch((err) => console.warn("Backend driver sync notice:", err.message));
  } catch (syncErr) {
    console.warn("Driver update sync notice:", syncErr.message);
  }
}

if (editDriverForm) editDriverForm.addEventListener("submit", handleSaveEditDriver);
if (saveEditDriverBtn) saveEditDriverBtn.addEventListener("click", handleSaveEditDriver);

function renderDriversTable() {
  const tbody = document.getElementById("driversTableBody");
  if (!tbody) return;

  const driverEntries = Object.entries(allDrivers);

  if (driverEntries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; opacity:0.6; padding:20px;">No drivers registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = driverEntries
    .map(([uid, driver]) => {
      const busOptions = Object.keys(allBuses).map((busNo) => {
        const isCurrent = driver.assignedBus === busNo;
        const otherDriverUid = allBuses[busNo].assignedDriver;
        const isOther = otherDriverUid && otherDriverUid !== uid;
        const otherName = isOther ? ` (${allDrivers[otherDriverUid]?.name || "Other"})` : "";
        return `<option value="${busNo}" ${isCurrent ? "selected" : ""}>${busNo}${otherName}</option>`;
      });

      const busSelect = `
        <select onchange="window.handleAssignBus('${uid}', this.value)" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; width:100%; max-width:160px;">
          <option value="">-- No Bus --</option>
          ${busOptions.join("")}
        </select>
      `;

      const routeOptions = Object.entries(allRoutes).map(([rId, r]) => {
        const isCurrent = driver.assignedRoute === rId;
        return `<option value="${rId}" ${isCurrent ? "selected" : ""}>${r.name}</option>`;
      });

      const routeSelect = `
        <select onchange="window.handleAssignRoute('${uid}', this.value)" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; width:100%; max-width:180px;">
          <option value="">-- No Route --</option>
          ${routeOptions.join("")}
        </select>
      `;

      return `
        <tr>
          <td><strong>${driver.name || "Driver"}</strong></td>
          <td>${driver.phone || "-"}</td>
          <td>${driver.email || "-"}</td>
          <td>${driver.address || "-"}</td>
          <td>${busSelect}</td>
          <td>${routeSelect}</td>
          <td style="white-space:nowrap;">
            <button class="primary-action" style="background:#2563eb; padding:6px 10px; font-size:11px; margin-right:4px;" onclick="window.handleEditDriver('${uid}')">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="primary-action" style="background:#ef4444; padding:6px 10px; font-size:11px;" onclick="window.handleDeleteDriver('${uid}')">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

window.handleDeleteDriver = async function (uid) {
  const driver = allDrivers[uid];
  const name = driver ? driver.name : "Driver";

  if (!confirm(`Are you sure you want to delete driver "${name}"?\n\nNote: The Auth account itself can only be fully deleted from the Firebase console.`)) return;

  delete allDrivers[uid];
  if (driver && driver.assignedBus && allBuses[driver.assignedBus]) {
    allBuses[driver.assignedBus].assignedDriver = null;
    localStorage.setItem("smartbus_buses", JSON.stringify(allBuses));
    renderBusesTable();
  }

  localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
  renderDriversTable();
  updateOverviewStats();
  showUIMessage(`Driver "${name}" removed. Note: Auth credentials can be removed via Firebase Console.`, false);

  if (typeof update === "function" && typeof ref === "function") {
    try {
      const updates = {};
      updates[`users/${uid}`] = null;
      if (driver && driver.assignedBus) {
        updates[`buses/${driver.assignedBus}/assignedDriver`] = null;
      }
      const rootRef = ref(db);
      if (rootRef) update(rootRef, updates).catch((err) => console.warn("Firebase delete sync notice:", err.message));
    } catch (e) {}
  }
};

// ========================================================
// 8. ATOMIC ASSIGNMENTS: BUS & ROUTE TO DRIVER
// ========================================================

window.handleAssignBus = async function (driverUid, newBusNo) {
  const driver = allDrivers[driverUid];
  if (!driver) {
    showUIMessage("Selected driver could not be found. Refresh the driver list and try again.", true);
    return;
  }

  const oldBusNo =
    Object.entries(allBuses).find(([, bus]) => bus && bus.assignedDriver === driverUid)?.[0] ||
    driver.assignedBus ||
    null;
  const selectedBus = newBusNo || null;
  if (selectedBus && !allBuses[selectedBus]) {
    showUIMessage("Selected bus could not be found. Refresh the bus list and try again.", true);
    renderDriversTable();
    return;
  }
  if (oldBusNo === selectedBus) return;
  if (!db || typeof db.ref !== "function") {
    showUIMessage("Cannot assign a bus while the database is unavailable. No changes were saved.", true);
    return;
  }

  const previousDriverUid = selectedBus && allBuses[selectedBus].assignedDriver;
  const selectedBusRoute = selectedBus
    ? (driver.assignedRoute || allBuses[selectedBus].routeId || null)
    : null;
  if (
    oldBusNo === selectedBus &&
    (!selectedBus ||
      (driver.assignedBus === selectedBus &&
        driver.assignedRoute === selectedBusRoute &&
        allBuses[selectedBus].assignedDriver === driverUid))
  ) {
    return;
  }
  const updates = {};
  [oldBusNo, selectedBus].filter(Boolean).forEach((busNo) => {
    updates[`buses/${busNo}/sharing`] = false;
    updates[`buses/${busNo}/currentDriver`] = "";
    updates[`locations/${busNo}/ts`] = 0;
  });
  if (oldBusNo) {
    updates[`buses/${oldBusNo}/assignedDriver`] = "";
    updates[`buses/${oldBusNo}/driverName`] = "";
  }
  updates[`users/${driverUid}/assignedBus`] = selectedBus || "";
  if (selectedBus) {
    updates[`buses/${selectedBus}/assignedDriver`] = driverUid;
    updates[`buses/${selectedBus}/driverName`] = driver.name || "Driver";
    updates[`buses/${selectedBus}/routeId`] = selectedBusRoute || "";
    updates[`users/${driverUid}/assignedRoute`] = selectedBusRoute || "";
  }
  if (previousDriverUid && previousDriverUid !== driverUid) {
    updates[`users/${previousDriverUid}/assignedBus`] = "";
  }

  try {
    await db.ref().update(updates);

    if (oldBusNo && allBuses[oldBusNo]) {
      allBuses[oldBusNo].assignedDriver = null;
      allBuses[oldBusNo].driverName = null;
      allBuses[oldBusNo].sharing = false;
      allBuses[oldBusNo].currentDriver = null;
      if (allLocations[oldBusNo]) allLocations[oldBusNo].ts = 0;
    }
    if (previousDriverUid && previousDriverUid !== driverUid && allDrivers[previousDriverUid]) {
      allDrivers[previousDriverUid].assignedBus = null;
    }
    driver.assignedBus = selectedBus;
    if (selectedBus) {
      allBuses[selectedBus].assignedDriver = driverUid;
      allBuses[selectedBus].driverName = driver.name || "Driver";
      allBuses[selectedBus].routeId = selectedBusRoute;
      allBuses[selectedBus].sharing = false;
      allBuses[selectedBus].currentDriver = null;
      if (allLocations[selectedBus]) allLocations[selectedBus].ts = 0;
      driver.assignedRoute = selectedBusRoute;
    }

    localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
    localStorage.setItem("smartbus_buses", JSON.stringify(allBuses));
    localStorage.setItem("smartbus_assignment_sync", Date.now().toString());
    window.dispatchEvent(new Event("storage"));
    renderDriversTable();
    renderBusesTable();
    updateOverviewStats();
    showUIMessage("Bus, driver, and route assignment saved and synchronized.", false);
  } catch (error) {
    console.error("Could not save bus assignment:", error);
    showUIMessage(`Bus assignment was not saved: ${error.message || "database update failed"}`, true);
    renderDriversTable();
  }
};

window.handleAssignRoute = async function (driverUid, routeId) {
  const driver = allDrivers[driverUid];
  if (!driver) {
    showUIMessage("Selected driver could not be found. Refresh the driver list and try again.", true);
    return;
  }

  const selectedRoute = routeId || null;
  if (selectedRoute && !allRoutes[selectedRoute]) {
    showUIMessage("Selected route could not be found. Refresh the route list and try again.", true);
    renderDriversTable();
    return;
  }
  const assignedBusNo =
    driver.assignedBus ||
    Object.entries(allBuses).find(([, bus]) => bus && bus.assignedDriver === driverUid)?.[0] ||
    null;
  if (!db || typeof db.ref !== "function") {
    showUIMessage("Cannot assign a route while the database is unavailable. No changes were saved.", true);
    return;
  }

  const updates = { [`users/${driverUid}/assignedRoute`]: selectedRoute || "" };
  if (assignedBusNo) updates[`buses/${assignedBusNo}/routeId`] = selectedRoute || "";

  try {
    await db.ref().update(updates);
    driver.assignedRoute = selectedRoute;
    if (assignedBusNo) {
      driver.assignedBus = assignedBusNo;
      allBuses[assignedBusNo].routeId = selectedRoute;
    }
    localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
    localStorage.setItem("smartbus_buses", JSON.stringify(allBuses));
    localStorage.setItem("smartbus_assignment_sync", Date.now().toString());
    window.dispatchEvent(new Event("storage"));
    renderDriversTable();
    renderBusesTable();
    updateOverviewStats();
    showUIMessage("Route assignment saved and synchronized.", false);
  } catch (error) {
    console.error("Could not save route assignment:", error);
    showUIMessage(`Route assignment was not saved: ${error.message || "database update failed"}`, true);
    renderDriversTable();
  }
};

// ========================================================
// 9. ROUTES: BUILDER WITH LEAFLET MAP & SAVED ROUTES
// ========================================================

const addRouteBtn = document.getElementById("addRouteBtn");
const routeBuilderCard = document.getElementById("routeBuilderCard");
const saveRouteBtn = document.getElementById("saveRouteBtn");
const cancelRouteBtn = document.getElementById("cancelRouteBtn");
const routeNameInput = document.getElementById("routeNameInput");
const editingRouteIdInput = document.getElementById("editingRouteId");
const routeStopsList = document.getElementById("routeStopsList");
const nominatimSearchBtn = document.getElementById("nominatimSearchBtn");
const nominatimSearchInput = document.getElementById("nominatimSearchInput");

let routeBuilderMap = null;
let currentStops = [];
let routeMarkers = [];
let routePolyline = null;

const DEFAULT_MAP_CENTER = [16.695, 74.25];

function initRouteBuilderMap() {
  if (routeBuilderMap) return;

  const mapContainer = document.getElementById("routeBuilderMap");
  if (!mapContainer || typeof L === "undefined") return;

  routeBuilderMap = L.map("routeBuilderMap", { zoomControl: true }).setView(DEFAULT_MAP_CENTER, 13);
  
  const osmHot = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
    subdomains: "abc",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">HOT</a>',
  });
  const esriStreet = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri',
    }
  );
  const osmStandard = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  osmStandard.addTo(routeBuilderMap);

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
      .addTo(routeBuilderMap);
  } catch (e) {}

  if (window.ResizeObserver && mapContainer) {
    const ro = new ResizeObserver(() => {
      if (routeBuilderMap) routeBuilderMap.invalidateSize();
    });
    ro.observe(mapContainer);
  }

  [100, 300, 600].forEach((ms) => {
    setTimeout(() => {
      if (routeBuilderMap) routeBuilderMap.invalidateSize();
    }, ms);
  });

  routeBuilderMap.on("click", (e) => {
    const defaultName = `Stop ${currentStops.length + 1}`;
    const stopName = prompt(`Enter stop name for Stop #${currentStops.length + 1}:`, defaultName);
    if (!stopName || !stopName.trim()) return;

    currentStops.push({
      name: stopName.trim(),
      lat: Number(e.latlng.lat.toFixed(6)),
      lng: Number(e.latlng.lng.toFixed(6)),
    });

    redrawRouteMap();
  });
}

function redrawRouteMap() {
  if (!routeBuilderMap || typeof L === "undefined") return;

  routeMarkers.forEach((m) => routeBuilderMap.removeLayer(m));
  routeMarkers = [];

  if (routePolyline) {
    routeBuilderMap.removeLayer(routePolyline);
    routePolyline = null;
  }

  const latLngs = [];

  currentStops.forEach((stop, index) => {
    const coords = [stop.lat, stop.lng];
    latLngs.push(coords);

    const icon = L.divIcon({
      className: "route-stop-icon",
      html: `<div style="background:#2563eb; color:#fff; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; border:2px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:grab;">${index + 1}</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker(coords, { icon, draggable: true }).addTo(routeBuilderMap);
    marker.bindPopup(`<strong>#${index + 1}: ${stop.name}</strong><br><small>${stop.lat}, ${stop.lng}</small>`);

    marker.on("dragend", (ev) => {
      const pos = ev.target.getLatLng();
      currentStops[index].lat = Number(pos.lat.toFixed(6));
      currentStops[index].lng = Number(pos.lng.toFixed(6));
      redrawRouteMap();
    });

    routeMarkers.push(marker);
  });

  if (latLngs.length > 1) {
    routePolyline = L.polyline(latLngs, {
      color: "#2563eb",
      weight: 4,
      dashArray: "6, 8",
    }).addTo(routeBuilderMap);
  }

  renderStopsList();
}

function renderStopsList() {
  if (!routeStopsList) return;

  if (currentStops.length === 0) {
    routeStopsList.innerHTML = `<p style="font-size:12px; color:#94a3b8; font-style:italic;">No stops added yet. Click anywhere on the map above to add a stop.</p>`;
    return;
  }

  routeStopsList.innerHTML = currentStops
    .map(
      (stop, idx) => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:13px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:#2563eb; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">${idx + 1}</span>
          <strong>${stop.name}</strong>
          <span style="font-size:11px; opacity:0.6;">(${stop.lat}, ${stop.lng})</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" onclick="window.renameStop(${idx})" style="background:none; border:none; color:#2563eb; cursor:pointer;" title="Rename"><i class="fa-solid fa-pen"></i></button>
          <button type="button" onclick="window.moveStopUp(${idx})" ${idx === 0 ? "disabled style='opacity:0.3; cursor:default; background:none; border:none;'" : "style='background:none; border:none; color:#0f172a; cursor:pointer;'"} title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
          <button type="button" onclick="window.moveStopDown(${idx})" ${idx === currentStops.length - 1 ? "disabled style='opacity:0.3; cursor:default; background:none; border:none;'" : "style='background:none; border:none; color:#0f172a; cursor:pointer;'"} title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
          <button type="button" onclick="window.removeStop(${idx})" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Remove"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `
    )
    .join("");
}

window.renameStop = function (idx) {
  const current = currentStops[idx];
  const newName = prompt("Rename stop:", current.name);
  if (newName && newName.trim()) {
    currentStops[idx].name = newName.trim();
    redrawRouteMap();
  }
};

window.moveStopUp = function (idx) {
  if (idx <= 0) return;
  const temp = currentStops[idx];
  currentStops[idx] = currentStops[idx - 1];
  currentStops[idx - 1] = temp;
  redrawRouteMap();
};

window.moveStopDown = function (idx) {
  if (idx >= currentStops.length - 1) return;
  const temp = currentStops[idx];
  currentStops[idx] = currentStops[idx + 1];
  currentStops[idx + 1] = temp;
  redrawRouteMap();
};

window.removeStop = function (idx) {
  currentStops.splice(idx, 1);
  redrawRouteMap();
};

if (nominatimSearchBtn && nominatimSearchInput) {
  const executeSearch = async () => {
    const q = nominatimSearchInput.value.trim();
    if (!q) return;

    try {
      nominatimSearchBtn.disabled = true;
      nominatimSearchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const results = await res.json();

      if (results && results.length > 0) {
        const first = results[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        routeBuilderMap?.setView([lat, lon], 14);
      } else {
        showUIMessage(`No places found for "${q}".`, true);
      }
    } catch (err) {
      showUIMessage("Place search failed: " + err.message, true);
    } finally {
      nominatimSearchBtn.disabled = false;
      nominatimSearchBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Search`;
    }
  };

  nominatimSearchBtn.addEventListener("click", executeSearch);
  nominatimSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeSearch();
    }
  });
}

if (addRouteBtn && routeBuilderCard) {
  addRouteBtn.addEventListener("click", () => {
    currentStops = [];
    if (editingRouteIdInput) editingRouteIdInput.value = "";
    if (routeNameInput) routeNameInput.value = "";
    const titleEl = document.getElementById("routeBuilderTitle");
    if (titleEl) titleEl.textContent = "Add New Route";

    routeBuilderCard.style.display = "block";
    initRouteBuilderMap();
    setTimeout(() => {
      routeBuilderMap?.invalidateSize();
      redrawRouteMap();
    }, 200);
  });
}

if (cancelRouteBtn && routeBuilderCard) {
  cancelRouteBtn.addEventListener("click", () => {
    routeBuilderCard.style.display = "none";
    currentStops = [];
    if (editingRouteIdInput) editingRouteIdInput.value = "";
  });
}

if (saveRouteBtn) {
  saveRouteBtn.addEventListener("click", async () => {
    const name = routeNameInput.value.trim();
    if (!name) {
      showUIMessage("Please provide a route name.", true);
      return;
    }
    if (currentStops.length < 2) {
      showUIMessage("A route requires at least 2 stops.", true);
      return;
    }

    const routeId = editingRouteIdInput.value || "route_" + Date.now();
    const routeData = {
      name,
      stops: currentStops,
    };

    allRoutes[routeId] = routeData;
    localStorage.setItem("smartbus_routes", JSON.stringify(allRoutes));
    renderRoutesTable();
    updateOverviewStats();

    showUIMessage(`Route "${name}" saved successfully!`, false);
    routeBuilderCard.style.display = "none";
    currentStops = [];
    editingRouteIdInput.value = "";

    if (typeof set === "function" && typeof ref === "function") {
      try {
        const routeRef = ref(db, `routes/${routeId}`);
        if (routeRef) set(routeRef, routeData).catch((err) => console.warn("Firebase route save notice:", err.message));
      } catch (e) {}
    }
  });
}

function renderRoutesTable() {
  const tbody = document.getElementById("routesTableBody");
  if (!tbody) return;

  const routeEntries = Object.entries(allRoutes);

  if (routeEntries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; opacity:0.6; padding:20px;">No routes created yet. Click "Add Route" to build one.</td></tr>`;
    return;
  }

  tbody.innerHTML = routeEntries
    .map(([rId, route]) => {
      const stopsArr = Array.isArray(route.stops) ? route.stops : Object.values(route.stops || {});
      const stopNames = stopsArr.map((s) => s.name).join(" &rarr; ");

      const assignedBuses = Object.values(allBuses)
        .filter((b) => b.routeId === rId)
        .map((b) => b.busNo);
      const busDisplay = assignedBuses.length > 0 ? assignedBuses.join(", ") : `<span style="opacity:0.6;">None</span>`;

      return `
        <tr>
          <td><strong>${route.name}</strong></td>
          <td style="font-size:12px;">${stopsArr.length} stops: ${stopNames || "-"}</td>
          <td>${busDisplay}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="primary-action" style="padding:6px 10px; font-size:11px;" onclick="window.viewRouteOnMap('${rId}')">
                <i class="fa-solid fa-map-location-dot"></i> View
              </button>
              <button class="primary-action" style="padding:6px 10px; font-size:11px; background:#475569;" onclick="window.editRoute('${rId}')">
                <i class="fa-solid fa-pen"></i> Edit
              </button>
              <button class="primary-action" style="padding:6px 10px; font-size:11px; background:#ef4444;" onclick="window.handleDeleteRoute('${rId}')">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

window.viewRouteOnMap = function (rId) {
  const route = allRoutes[rId];
  if (!route) return;

  routeBuilderCard.style.display = "block";
  initRouteBuilderMap();

  editingRouteIdInput.value = rId;
  routeNameInput.value = route.name;
  document.getElementById("routeBuilderTitle").textContent = `Viewing Route: ${route.name}`;

  const rawStops = Array.isArray(route.stops) ? route.stops : Object.values(route.stops || {});
  currentStops = rawStops.map((s) => ({ ...s }));

  setTimeout(() => {
    routeBuilderMap?.invalidateSize();
    redrawRouteMap();
    if (currentStops.length > 0 && typeof L !== "undefined") {
      const bounds = L.latLngBounds(currentStops.map((s) => [s.lat, s.lng]));
      routeBuilderMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }, 200);
};

window.editRoute = function (rId) {
  window.viewRouteOnMap(rId);
  document.getElementById("routeBuilderTitle").textContent = `Editing Route`;
};

window.handleDeleteRoute = async function (rId) {
  const route = allRoutes[rId];
  const name = route ? route.name : "Route";

  if (!confirm(`Are you sure you want to delete route "${name}"?\nBuses and drivers assigned to this route will be cleared.`)) return;

  delete allRoutes[rId];

  Object.entries(allBuses).forEach(([busNo, bus]) => {
    if (bus && bus.routeId === rId) {
      bus.routeId = null;
    }
  });

  Object.entries(allDrivers).forEach(([uid, driver]) => {
    if (driver && driver.assignedRoute === rId) {
      driver.assignedRoute = null;
    }
  });

  localStorage.setItem("smartbus_routes", JSON.stringify(allRoutes));
  localStorage.setItem("smartbus_buses", JSON.stringify(allBuses));
  localStorage.setItem("smartbus_drivers", JSON.stringify(allDrivers));
  renderRoutesTable();
  renderBusesTable();
  renderDriversTable();
  updateOverviewStats();
  showUIMessage(`Route "${name}" deleted successfully.`, false);

  if (typeof update === "function" && typeof ref === "function") {
    try {
      const updates = {};
      updates[`routes/${rId}`] = null;
      Object.entries(allBuses).forEach(([busNo, bus]) => {
        if (bus && bus.routeId === rId) updates[`buses/${busNo}/routeId`] = null;
      });
      Object.entries(allDrivers).forEach(([uid, driver]) => {
        if (driver && driver.assignedRoute === rId) updates[`users/${uid}/assignedRoute`] = null;
      });
      const rootRef = ref(db);
      if (rootRef) update(rootRef, updates).catch((err) => console.warn("Firebase delete route notice:", err.message));
    } catch (e) {}
  }
};

// ========================================================
// 10. OVERVIEW MAPS & STATUS WIDGETS
// ========================================================

const MAP_CENTER = [16.7050, 74.2433];
const LIVE_TIMEOUT_MS = 30 * 1000; // 30 seconds

let adminServerTimeOffset = 0;
if (typeof firebase !== "undefined" && typeof db !== "undefined" && db) {
  try {
    const offsetRef = typeof ref === "function" ? ref(db, ".info/serverTimeOffset") : db.ref(".info/serverTimeOffset");
    if (offsetRef && offsetRef.on) {
      offsetRef.on("value", (snap) => {
        adminServerTimeOffset = Number(snap.val() || 0);
      });
    }
  } catch (e) {}
}

function getAdminServerNow() {
  return typeof window.getServerNow === "function" ? window.getServerNow() : Date.now() + adminServerTimeOffset;
}

function isBusLive(busNo) {
  const bus = allBuses[busNo];
  const loc = allLocations[busNo];
  if (!bus || bus.sharing !== true) return false;
  if (!loc || loc.lat == null || loc.lng == null) return false;
  const ts = Number(loc.ts || (loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0));
  if (!ts) return false;
  const serverNow = getAdminServerNow();
  return serverNow - ts < LIVE_TIMEOUT_MS;
}

function formatAdminRelativeTime(ts) {
  if (!ts) return "offline";
  const serverNow = getAdminServerNow();
  const diffMs = serverNow - Number(ts);
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ago`;
}

function busDivIcon(status, heading = null) {
  if (typeof L === "undefined") return null;
  const rotStyle = heading != null && !isNaN(heading) ? `transform: rotate(${heading}deg);` : "";
  const isOnline = status === "online";
  return L.divIcon({
    className: "admin-bus-marker-wrapper",
    html: `
      <div class="admin-bus-marker ${status}" style="width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:${isOnline ? "#16a34a" : "#94a3b8"}; color:#fff; border:2px solid #fff; box-shadow:0 3px 8px rgba(0,0,0,0.3); ${rotStyle} transition: transform 0.4s ease-out;">
        <i class="fa-solid fa-bus" style="font-size:14px;"></i>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function buildAdminPopup(busNo, live, loc, bus, route, driver) {
  const driverName = driver && driver.name ? driver.name : (bus.driverName || "Unassigned");
  const routeName = route && route.name ? route.name : "Unassigned";
  const speedKmH = loc ? ((Number(loc.speed) || 0) * 3.6).toFixed(1) : "0.0";
  const updatedTime = loc ? formatAdminRelativeTime(loc.ts) : "offline";
  const serverNow = getAdminServerNow();
  const minsAgo = loc && loc.ts ? Math.max(1, Math.floor((serverNow - Number(loc.ts)) / 60000)) : 0;

  if (live) {
    return `
      <div style="font-family: inherit; min-width: 170px; padding: 2px;" data-admin-bus-popup="${busNo}">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <strong style="font-size:13px; color:#1e293b;">${busNo}</strong>
          <span style="font-size:10px; background:#dcfce7; color:#166534; padding:2px 6px; border-radius:10px; font-weight:700;">● LIVE GPS</span>
        </div>
        <div style="font-size:11px; color:#475569;">Route: <strong>${routeName}</strong></div>
        <div style="font-size:11px; color:#475569;">Driver: <strong>${driverName}</strong></div>
        <div style="font-size:11px; color:#475569;">Speed: <strong>${speedKmH} km/h</strong></div>
        <div style="font-size:10px; color:#64748b; margin-top:4px; border-top:1px solid #f1f5f9; padding-top:2px;">
          <span class="admin-popup-ticker">Last updated: ${updatedTime}</span>
        </div>
      </div>
    `;
  }

  return `
    <div style="font-family: inherit; min-width: 160px; padding: 2px; color:#64748b;" data-admin-bus-popup="${busNo}">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
        <strong style="font-size:13px; color:#64748b;">${busNo}</strong>
        <span style="font-size:10px; background:#f1f5f9; color:#64748b; padding:2px 6px; border-radius:10px;">Offline</span>
      </div>
      <div style="font-size:11px;">Route: ${routeName}</div>
      <div style="font-size:10px; color:#94a3b8; margin-top:4px;">
        offline, last seen ${minsAgo} min ago
      </div>
    </div>
  `;
}

function createFleetMap(containerId, zoom) {
  const el = document.getElementById(containerId);
  if (!el || typeof L === "undefined") return null;

  // Ensure Leaflet default marker icons load without 404s
  if (L.Icon && L.Icon.Default) {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });
  }

  try {
    const map = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView(MAP_CENTER, zoom);

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

    osmStandard.addTo(map);

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
        .addTo(map);
    } catch (e) {}

    if (window.ResizeObserver && el) {
      const ro = new ResizeObserver(() => {
        if (map) map.invalidateSize();
      });
      ro.observe(el);
    }

    [100, 300, 600, 1200].forEach((ms) => {
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, ms);
    });

    return { map, markers: {}, centred: false };
  } catch (e) {
    console.warn("Map init notice:", e.message);
    return null;
  }
}

function updateFleetMarkers(fleetMap) {
  if (!fleetMap || !fleetMap.map || typeof L === "undefined") return;

  const validBusesWithLoc = Object.keys(allBuses).filter((bNo) => {
    const loc = allLocations[bNo];
    return loc && loc.lat != null && loc.lng != null;
  });

  const stillPresent = {};

  validBusesWithLoc.forEach((busNo) => {
    const loc = allLocations[busNo];
    const bus = allBuses[busNo];
    const route = bus && bus.routeId ? allRoutes[bus.routeId] : null;
    const driver = bus && bus.assignedDriver ? allDrivers[bus.assignedDriver] : null;
    const live = isBusLive(busNo);
    const coords = [Number(loc.lat), Number(loc.lng)];
    const heading = loc.heading != null && !isNaN(loc.heading) ? Number(loc.heading) : null;
    const popupContent = buildAdminPopup(busNo, live, loc, bus, route, driver);

    stillPresent[busNo] = true;

    if (fleetMap.markers[busNo]) {
      // Smoothly update position without recreating marker
      fleetMap.markers[busNo].setLatLng(coords);
      fleetMap.markers[busNo].setIcon(busDivIcon(live ? "online" : "offline", heading));
      fleetMap.markers[busNo].setPopupContent(popupContent);
    } else {
      fleetMap.markers[busNo] = L.marker(coords, { icon: busDivIcon(live ? "online" : "offline", heading) })
        .addTo(fleetMap.map)
        .bindPopup(popupContent)
        .bindTooltip(String(busNo), {
          permanent: true,
          direction: "bottom",
          offset: [0, 14],
        });
    }
  });

  // Remove markers for deleted buses
  Object.keys(fleetMap.markers).forEach((busNo) => {
    if (!stillPresent[busNo]) {
      fleetMap.map.removeLayer(fleetMap.markers[busNo]);
      delete fleetMap.markers[busNo];
    }
  });

  // Center on live buses
  const liveBusNos = validBusesWithLoc.filter((bNo) => isBusLive(bNo));
  if (liveBusNos.length > 0 && !fleetMap.centred) {
    const bounds = L.latLngBounds(liveBusNos.map((bNo) => [Number(allLocations[bNo].lat), Number(allLocations[bNo].lng)]));
    fleetMap.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    fleetMap.centred = true;
  }
}

// Client timer: updates "Last updated: Ns ago" in open popups every second
setInterval(() => {
  document.querySelectorAll("[data-admin-bus-popup]").forEach((el) => {
    const busNo = el.getAttribute("data-admin-bus-popup");
    const loc = allLocations[busNo];
    const ticker = el.querySelector(".admin-popup-ticker");
    if (loc && ticker) {
      ticker.textContent = `Last updated: ${formatAdminRelativeTime(loc.ts)}`;
    }
  });
}, 1000);

const miniFleetMap = createFleetMap("miniMap", 13);
let adminFleetMap = null;

function updateAllFleetMaps() {
  updateFleetMarkers(miniFleetMap);
  updateFleetMarkers(adminFleetMap);
}

function updateOverviewStats() {
  const totalBuses = Object.keys(allBuses).length;
  const liveBuses = Object.keys(allBuses).filter((bNo) => isBusLive(bNo)).length;
  const totalDrivers = Object.keys(allDrivers).length;
  const totalRoutes = Object.keys(allRoutes).length;

  const totalBusesEl = document.getElementById("statTotalBuses");
  const busesLiveEl = document.getElementById("statBusesLive");
  const busesOnRouteEl = document.getElementById("statBusesOnRoute");
  const totalDriversEl = document.getElementById("statTotalDrivers");
  const totalRoutesEl = document.getElementById("statTotalRoutes");

  if (totalBusesEl) totalBusesEl.textContent = totalBuses;
  if (busesLiveEl) busesLiveEl.textContent = liveBuses;
  if (busesOnRouteEl) busesOnRouteEl.textContent = liveBuses;
  if (totalDriversEl) totalDriversEl.textContent = totalDrivers;
  if (totalRoutesEl) totalRoutesEl.textContent = totalRoutes;
}

function renderBusStatusWidget() {
  const list = document.getElementById("busStatusList");
  if (!list) return;

  const busEntries = Object.entries(allBuses);

  if (busEntries.length === 0) {
    list.innerHTML = `<p style="padding:16px; opacity:0.6;">No buses added yet.</p>`;
    return;
  }

  list.innerHTML = busEntries
    .slice(0, 4)
    .map(([busNo, bus]) => {
      const route = bus.routeId ? allRoutes[bus.routeId] : null;
      const isLive = isBusLive(busNo);
      return `
        <div class="bus-status-item">
          <div class="bus-small-icon"><i class="fa-solid fa-bus"></i></div>
          <div class="bus-info">
            <strong>${busNo}</strong>
            <span>Route: ${route ? route.name : "Not assigned"}</span>
          </div>
          <span class="status ${isLive ? "on-route" : "stopped"}">${isLive ? "On Route" : "Stopped"}</span>
        </div>
      `;
    })
    .join("");
}
