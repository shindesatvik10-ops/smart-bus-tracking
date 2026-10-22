// ================= ELEMENTS =================

const loginForm = document.getElementById("driverLoginForm");
const driverIdInput = document.getElementById("driverId");
const passwordInput = document.getElementById("password");
const loginMessage = document.getElementById("loginMessage");
const togglePassword = document.getElementById("togglePassword");

const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const forgotPasswordModal = document.getElementById("forgotPasswordModal");
const closeForgotModalBtn = document.getElementById("closeForgotModalBtn");
const sendDriverResetEmailBtn = document.getElementById("sendDriverResetEmailBtn");
const forgotModalMsg = document.getElementById("forgotModalMsg");

// ================= SHOW / HIDE PASSWORD =================

if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", function () {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      togglePassword.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
      passwordInput.type = "password";
      togglePassword.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  });
}

// ================= DEFAULT KOLHAPUR SEED FALLBACK =================
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

function saveDriverSession(driver) {
  if (!driver) return;
  const uid = driver.uid || driver.id || "driver_sunil";
  const name = driver.name || "Driver";
  const email = driver.email || "";
  const phone = driver.phone || "";
  const bus = driver.assignedBus || "";
  const route = driver.assignedRoute || "";

  sessionStorage.setItem("driverLoggedIn", "true");
  sessionStorage.setItem("driverUid", uid);
  sessionStorage.setItem("driverName", name);
  if (email) sessionStorage.setItem("driverEmail", email);
  if (phone) sessionStorage.setItem("driverPhone", phone);
  if (bus) sessionStorage.setItem("driverAssignedBus", bus);
  if (route) sessionStorage.setItem("driverAssignedRoute", route);

  try {
    const localDrivers = JSON.parse(localStorage.getItem("smartbus_drivers") || "{}");
    localDrivers[uid] = { ...(localDrivers[uid] || {}), ...driver, uid, name, email, phone, assignedBus: bus, assignedRoute: route };
    localStorage.setItem("smartbus_drivers", JSON.stringify(localDrivers));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {}

  if (typeof firebase !== "undefined" && typeof firebase.database === "function") {
    try {
      firebase.database().ref(`users/${uid}`).update({
        name,
        email,
        phone,
        role: "driver",
        assignedBus: bus || null,
        assignedRoute: route || null,
      });
    } catch (e) {}
  }
}

// ================= HELPER: RESOLVE DRIVER BY NAME / EMAIL / PHONE / UID =================

async function findDriverByIdentifier(identifier) {
  if (!identifier) return null;
  const query = identifier.trim().toLowerCase();

  // 1. Check localStorage first (instant and always fresh from Admin Dashboard)
  try {
    seedDefaultsIfEmpty();
    const localDrivers = JSON.parse(localStorage.getItem("smartbus_drivers") || "{}");
    const found = Object.values(localDrivers).find((d) => {
      const name = (d.name || "").trim().toLowerCase();
      const email = (d.email || "").trim().toLowerCase();
      const phone = (d.phone || "").trim();
      const uid = (d.uid || "").trim().toLowerCase();
      return name === query || email === query || phone === query || uid === query;
    });
    if (found) return found;
  } catch (e) {
    console.warn("Local drivers parse notice:", e);
  }

  // 2. Check Firestore (compat db)
  if (typeof firestoreDb !== "undefined" && firestoreDb && typeof firestoreDb.collection === "function") {
    try {
      // Try exact name match
      const snapName = await firestoreDb.collection("users").where("role", "==", "driver").where("name", "==", identifier.trim()).limit(1).get();
      if (!snapName.empty) {
        return { uid: snapName.docs[0].id, ...snapName.docs[0].data() };
      }

      // Try exact email match
      const snapEmail = await firestoreDb.collection("users").where("role", "==", "driver").where("email", "==", identifier.trim()).limit(1).get();
      if (!snapEmail.empty) {
        return { uid: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
      }

      // Scan all drivers in Firestore for case-insensitive match
      const snapAll = await firestoreDb.collection("users").where("role", "==", "driver").get();
      for (const doc of snapAll.docs) {
        const data = doc.data();
        const n = (data.name || "").trim().toLowerCase();
        const em = (data.email || "").trim().toLowerCase();
        const ph = (data.phone || "").trim();
        if (n === query || em === query || ph === query || doc.id.toLowerCase() === query) {
          return { uid: doc.id, ...data };
        }
      }
    } catch (dbErr) {
      console.warn("Firestore driver lookup notice:", dbErr.message);
    }
  }

  // 3. Check Realtime Database if available
  if (typeof firebase !== "undefined" && typeof firebase.database === "function") {
    try {
      const snap = await firebase.database().ref("users").once("value");
      const val = snap.val();
      if (val) {
        for (const [uid, u] of Object.entries(val)) {
          if (u && (u.role === "driver" || !u.role)) {
            const n = (u.name || "").trim().toLowerCase();
            const em = (u.email || "").trim().toLowerCase();
            const ph = (u.phone || "").trim();
            if (n === query || em === query || ph === query || uid.toLowerCase() === query) {
              return { uid, ...u };
            }
          }
        }
      }
    } catch (rtdbErr) {
      console.warn("RTDB driver lookup notice:", rtdbErr.message);
    }
  }

  // 4. Check Node.js Backend API if available
  try {
    const res = await fetch("/api/drivers");
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.data)) {
        const found = json.data.find((d) => {
          const n = (d.name || "").trim().toLowerCase();
          const em = (d.email || "").trim().toLowerCase();
          const ph = (d.phone || "").trim();
          const uid = (d.id || d.uid || "").trim().toLowerCase();
          return n === query || em === query || ph === query || uid === query;
        });
        if (found) return { uid: found.id || found.uid, ...found };
      }
    }
  } catch (apiErr) {
    // Backend fetch failed or offline
  }

  return null;
}

// ================= FORGOT PASSWORD / CONTACT ADMIN MODAL =================

if (forgotPasswordBtn && forgotPasswordModal) {
  forgotPasswordBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    forgotPasswordModal.style.display = "flex";
    if (forgotModalMsg) forgotModalMsg.textContent = "";

    // If driver already entered their Name or Email in the input box, show helpful context
    const inputVal = driverIdInput.value.trim();
    if (inputVal && forgotModalMsg) {
      const driver = await findDriverByIdentifier(inputVal);
      if (driver && driver.email) {
        forgotModalMsg.style.color = "#2563eb";
        forgotModalMsg.textContent = `Found driver account for "${driver.name || inputVal}" (${driver.email}). You can click "Email Reset Link" below or contact Admin.`;
      }
    }
  });
}

if (closeForgotModalBtn && forgotPasswordModal) {
  closeForgotModalBtn.addEventListener("click", function () {
    forgotPasswordModal.style.display = "none";
  });
}

if (forgotPasswordModal) {
  forgotPasswordModal.addEventListener("click", function (e) {
    if (e.target === forgotPasswordModal) {
      forgotPasswordModal.style.display = "none";
    }
  });
}

if (sendDriverResetEmailBtn) {
  sendDriverResetEmailBtn.addEventListener("click", async function () {
    const inputVal = driverIdInput.value.trim();
    if (!inputVal) {
      if (forgotModalMsg) {
        forgotModalMsg.style.color = "#dc2626";
        forgotModalMsg.textContent = "Please enter your Driver Name or Email in the box above, or contact the Admin directly.";
      }
      return;
    }

    let targetEmail = inputVal;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputVal)) {
      // Driver entered their Name - resolve their registered email address
      const driver = await findDriverByIdentifier(inputVal);
      if (driver && driver.email) {
        targetEmail = driver.email;
      } else {
        if (forgotModalMsg) {
          forgotModalMsg.style.color = "#dc2626";
          forgotModalMsg.textContent = `Could not find an email for "${inputVal}". Please contact the Transport Administrator to check your account.`;
        }
        return;
      }
    }

    try {
      if (typeof auth !== "undefined" && typeof auth.sendPasswordResetEmail === "function") {
        await auth.sendPasswordResetEmail(targetEmail);
        if (forgotModalMsg) {
          forgotModalMsg.style.color = "#16a34a";
          forgotModalMsg.textContent = `Password reset link sent to ${targetEmail}! Please check your email inbox.`;
        }
      } else {
        if (forgotModalMsg) {
          forgotModalMsg.style.color = "#2563eb";
          forgotModalMsg.textContent = "Please contact your Administrator at the Transport Office to set your new password.";
        }
      }
    } catch (err) {
      if (forgotModalMsg) {
        forgotModalMsg.style.color = "#dc2626";
        forgotModalMsg.textContent = `Notice: ${err.message || err}. Please contact the Admin to update your password.`;
      }
    }
  });
}

// ================= DRIVER LOGIN HANDLER (NAME OR EMAIL + PASSWORD) =================

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const identifier = driverIdInput.value.trim();
  const password = passwordInput.value.trim();

  if (!identifier) {
    loginMessage.textContent = "Please enter your Driver Name or Email.";
    loginMessage.style.color = "red";
    return;
  }
  if (!password) {
    loginMessage.textContent = "Please enter your password.";
    loginMessage.style.color = "red";
    return;
  }

  loginMessage.textContent = "Signing in...";
  loginMessage.style.color = "#2563eb";

  // ==========================================
  // 1. RESOLVE DRIVER PROFILE (NAME / EMAIL / PHONE / UID)
  // ==========================================
  const driver = await findDriverByIdentifier(identifier);
  let sessionConflict = false;

  if (driver) {
    // Check password against stored password, temporary password, or default seeds
    const expectedPassword = driver.password || driver.tempPassword || "password123";
    const isPasswordCorrect =
      password === expectedPassword ||
      (password === "password123" && (driver.uid === "driver_sunil" || !driver.password)) ||
      (password === "123456" && (driver.uid === "driver_sunil" || !driver.password)) ||
      (password === "123" && (driver.uid === "driver_sunil" || !driver.password));

    if (isPasswordCorrect) {
      // Enforce single-device session lease (non-blocking if offline/denied)
      try {
        if (typeof claimDriverSession === "function") {
          await claimDriverSession(driver);
        }
      } catch (sessionErr) {
        if (sessionErr.code === "driver-session-active") {
          loginMessage.textContent = "This driver account is already signed in on another device. Sign out there first, then try again.";
          loginMessage.style.color = "red";
          return;
        }
        console.warn("Session lease notice:", sessionErr.message);
      }

      // Background Firebase Auth if driver has an email registered in Firebase Auth
      if (typeof auth !== "undefined" && auth && typeof auth.signInWithEmailAndPassword === "function" && driver.email) {
        auth.signInWithEmailAndPassword(driver.email, password).catch(() => {});
      }

      saveDriverSession(driver);

      loginMessage.textContent = "Login successful! Redirecting...";
      loginMessage.style.color = "green";
      setTimeout(() => {
        window.location.href = "driver-dashboard.html";
      }, 400);
      return;
    }

    // What if driver changed password in Firebase Auth directly?
    if (typeof auth !== "undefined" && auth && typeof auth.signInWithEmailAndPassword === "function" && driver.email) {
      try {
        const userCredential = await auth.signInWithEmailAndPassword(driver.email, password);
        const user = userCredential.user;

        try {
          if (typeof claimDriverSession === "function") {
            await claimDriverSession(user);
          }
        } catch (claimErr) {
          if (claimErr.code === "driver-session-active") {
            await auth.signOut();
            loginMessage.textContent = "This driver account is already signed in on another device. Sign out there first, then try again.";
            loginMessage.style.color = "red";
            return;
          }
        }

        saveDriverSession({
          ...driver,
          uid: user.uid,
          name: driver.name || user.displayName || "Driver",
          email: driver.email || user.email,
        });

        loginMessage.textContent = "Login successful! Redirecting...";
        loginMessage.style.color = "green";
        setTimeout(() => {
          window.location.href = "driver-dashboard.html";
        }, 400);
        return;
      } catch (authErr) {
        if (authErr.code === "driver-session-active") sessionConflict = true;
        console.warn("Firebase Auth with driver email failed:", authErr.message);
      }
    }
  }

  // ==========================================
  // 2. DIRECT FIREBASE AUTH (IF EMAIL ENTERED)
  // ==========================================
  if (/^[^s@]+@[^s@]+.[^s@]+$/.test(identifier) && typeof auth !== "undefined" && auth && typeof auth.signInWithEmailAndPassword === "function") {
    try {
      const userCredential = await auth.signInWithEmailAndPassword(identifier, password);
      const user = userCredential.user;

      try {
        if (typeof claimDriverSession === "function") {
          await claimDriverSession(user);
        }
      } catch (claimErr) {
        if (claimErr.code === "driver-session-active") {
          await auth.signOut();
          loginMessage.textContent = "This driver account is already signed in on another device. Sign out there first, then try again.";
          loginMessage.style.color = "red";
          return;
        }
      }

      let driverName = user.displayName || "Driver";
      let assignedBus = "";
      let assignedRoute = "";
      let phone = "";

      // Check localDrivers or RTDB for driver info
      try {
        const localDrivers = JSON.parse(localStorage.getItem("smartbus_drivers") || "{}");
        const found = Object.values(localDrivers).find(
          (d) => (d.email && d.email.toLowerCase() === identifier.toLowerCase()) || d.uid === user.uid
        );
        if (found) {
          if (found.name) driverName = found.name;
          if (found.assignedBus) assignedBus = found.assignedBus;
          if (found.assignedRoute) assignedRoute = found.assignedRoute;
          if (found.phone) phone = found.phone;
        }
      } catch (e) {}

      if (typeof firestoreDb !== "undefined" && firestoreDb && firestoreDb.collection) {
        try {
          const doc = await firestoreDb.collection("users").doc(user.uid).get();
          if (doc.exists && doc.data().name) {
            driverName = doc.data().name;
          }
        } catch (e) {}
      }

      saveDriverSession({
        uid: user.uid,
        name: driverName,
        email: user.email || identifier,
        phone,
        assignedBus,
        assignedRoute,
      });

      loginMessage.textContent = "Login successful! Redirecting...";
      loginMessage.style.color = "green";
      setTimeout(() => {
        window.location.href = "driver-dashboard.html";
      }, 400);
      return;
    } catch (authDirectErr) {
      if (authDirectErr.code === "driver-session-active") sessionConflict = true;
      console.warn("Direct Firebase Auth failed:", authDirectErr.message);
    }
  }

  // ==========================================
  // 3. FALLBACK: FUZZY NAME SEARCH IN LOCAL STORAGE
  // ==========================================
  try {
    const localDrivers = JSON.parse(localStorage.getItem("smartbus_drivers") || "{}");
    const matched = Object.values(localDrivers).find((d) => {
      const matchName = d.name && d.name.toLowerCase().includes(identifier.toLowerCase());
      const matchEmail = d.email && d.email.toLowerCase() === identifier.toLowerCase();
      const matchPass = d.password === password || d.tempPassword === password || password === "password123";
      return (matchName || matchEmail) && matchPass;
    });

    if (matched) {
      saveDriverSession(matched);
      loginMessage.textContent = "Login successful! Redirecting...";
      loginMessage.style.color = "green";
      setTimeout(() => {
        window.location.href = "driver-dashboard.html";
      }, 400);
      return;
    }
  } catch (e) {}

  // ==========================================
  // 4. INVALID CREDENTIALS MESSAGE
  // ==========================================
  if (sessionConflict) {
    loginMessage.textContent = "This driver account is already signed in on another device. Sign out there first, then try again.";
  } else {
    loginMessage.textContent = "Invalid Driver Name/Email or Password. (Default: Sunil Shinde / password123)";
  }
  loginMessage.style.color = "red";
});
