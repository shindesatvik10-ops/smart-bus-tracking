// ============================================
// FIREBASE REALTIME DATABASE & AUTH CONFIGURATION
// ============================================

var firebaseConfig = window.firebaseConfig || {
  apiKey: "AIzaSyAN12u2jI3QN3OWz3-Qwsrk3cEAGjmsK-s",
  authDomain: "smart-bus-tracking-65f19.firebaseapp.com",
  databaseURL: "https://smart-bus-tracking-65f19-default-rtdb.firebaseio.com",
  projectId: "smart-bus-tracking-65f19",
  storageBucket: "smart-bus-tracking-65f19.firebasestorage.app",
  messagingSenderId: "547781095003",
  appId: "1:547781095003:web:acd322be2bcdf8069d997e",
};

// var firebaseConfig = {
//   apiKey: "AIzaSyDuLImxeS5WCsDLRfm7oN1AkhH4Jwj7C90",
//   authDomain: "smart-bus-tracker-13d71.firebaseapp.com",
//   databaseURL: "https://smart-bus-tracker-13d71-default-rtdb.asia-southeast1.firebasedatabase.app",
//   projectId: "smart-bus-tracker-13d71",
//   storageBucket: "smart-bus-tracker-13d71.firebasestorage.app",
//   messagingSenderId: "198325481932",
//   appId: "1:198325481932:web:171eb6c3ec4b29d02c2d69",
//   measurementId: "G-ER0SWV2EBM"
// };

window.firebaseConfig = firebaseConfig;


// Initialize Firebase
var app = window.app || null;
var auth = window.auth || null;
var db = window.rtdb || null;

if (typeof firebase !== "undefined") {
  try {
    app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
    auth = firebase.auth();
    db = firebase.database();
  } catch (initErr) {
    console.warn("Firebase init notice:", initErr.message);
  }
}

// Keep server time offset synchronized
let serverTimeOffset = 0;
if (db) {
  try {
    db.ref(".info/serverTimeOffset").on("value", (snap) => {
      serverTimeOffset = Number(snap.val() || 0);
    });
  } catch (e) {
    console.warn("Server time offset notice:", e.message);
  }
}

const getServerNow = () => Date.now() + serverTimeOffset;
const serverTimestamp = () =>
  typeof firebase !== "undefined" && firebase.database && firebase.database.ServerValue
    ? firebase.database.ServerValue.TIMESTAMP
    : Date.now();

// Database wrapper functions
const ref = (database, path) => (database && database.ref ? database.ref(path) : (db ? db.ref(path) : null));
const get = (dbRef) => (dbRef ? dbRef.once("value") : Promise.resolve({ val: () => null, exists: () => false }));
const set = (dbRef, val) => (dbRef ? dbRef.set(val) : Promise.resolve());
const update = (dbRef, val) => (dbRef ? dbRef.update(val) : Promise.resolve());
const push = (dbRef, val) => (dbRef ? (val !== undefined ? dbRef.push(val) : dbRef.push()) : null);
const remove = (dbRef) => (dbRef ? dbRef.remove() : Promise.resolve());
const child = (dbRef, path) => (dbRef ? dbRef.child(path) : null);
const off = (dbRef, eventType, cb) => (dbRef ? dbRef.off(eventType, cb) : null);

const onValue = (dbRef, callback, errorCallback) => {
  if (!dbRef) return () => {};
  const handler = (snap) => callback(snap);
  dbRef.on("value", handler, errorCallback);
  return () => dbRef.off("value", handler);
};

// Watch all live bus locations (publicly readable)
const watchAllBuses = (callback, errorCallback) => {
  const locRef = ref(db, "locations");
  if (!locRef) {
    if (typeof errorCallback === "function") errorCallback(new Error("Database not connected"));
    return () => {};
  }
  return onValue(locRef, (snap) => {
    const val = snap.val() || {};
    callback(val);
  }, errorCallback);
};

// Watch single bus location
const watchBus = (busNo, callback, errorCallback) => {
  if (!busNo) return () => {};
  const locRef = ref(db, `locations/${busNo}`);
  if (!locRef) return () => {};
  return onValue(locRef, (snap) => {
    callback(snap.val());
  }, errorCallback);
};

// Start sharing location with conflict detection and onDisconnect handling
const startSharing = async (busNo, locationData, driverUid) => {
  if (!busNo) throw new Error("Bus number is required to start sharing.");
  if (!driverUid) throw new Error("Driver authentication required.");
  if (!db || typeof db.ref !== "function") {
    throw new Error("Firebase Realtime Database is not initialized.");
  }

  // Check if another driver or device is already actively sharing this bus
  const busSnap = await db.ref(`buses/${busNo}`).once("value");
  const busData = busSnap.val() || {};
  if (busData.sharing === true && busData.currentDriver && busData.currentDriver !== driverUid) {
    const locSnap = await db.ref(`locations/${busNo}`).once("value");
    const loc = locSnap.val();
    const serverNow = getServerNow();
    if (loc && loc.ts && serverNow - Number(loc.ts) < 30000) {
      throw new Error(`Bus ${busNo} is currently being driven by another driver on a live device.`);
    }
  }

  // Set up onDisconnect handlers
  const sharingRef = db.ref(`buses/${busNo}/sharing`);
  const currentDriverRef = db.ref(`buses/${busNo}/currentDriver`);
  const locTsRef = db.ref(`locations/${busNo}/ts`);

  await Promise.all([
    sharingRef.onDisconnect().set(false),
    currentDriverRef.onDisconnect().set(null),
    locTsRef.onDisconnect().set(0),
  ]);

  // Update bus document in RTDB
  await db.ref(`buses/${busNo}`).update({
    sharing: true,
    active: true,
    currentDriver: driverUid,
  });

  // Optimistic local update
  try {
    const localBuses = JSON.parse(localStorage.getItem("smartbus_buses") || "{}");
    if (!localBuses[busNo]) {
      localBuses[busNo] = {
        busNo: busNo,
        capacity: 45,
        assignedDriver: driverUid,
        driverName: sessionStorage.getItem("driverName") || "Driver",
        routeId: sessionStorage.getItem("driverAssignedRoute") || "route-1",
      };
    }
    localBuses[busNo].sharing = true;
    localBuses[busNo].active = true;
    localBuses[busNo].currentDriver = driverUid;
    if (sessionStorage.getItem("driverName")) {
      localBuses[busNo].driverName = sessionStorage.getItem("driverName");
    }
    localStorage.setItem("smartbus_buses", JSON.stringify(localBuses));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {}

  // Write initial GPS position if provided
  if (locationData && locationData.lat != null && locationData.lng != null) {
    const payload = {
      lat: Number(locationData.lat),
      lng: Number(locationData.lng),
      speed: locationData.speed != null ? Number(locationData.speed) : 0,
      heading: locationData.heading != null && !isNaN(locationData.heading) ? Number(locationData.heading) : null,
      accuracy: locationData.accuracy != null ? Math.round(Number(locationData.accuracy)) : null,
      ts: serverTimestamp(),
    };
    if (!db) throw new Error("Firebase Realtime Database is not initialized.");
    await db.ref(`locations/${busNo}`).set(payload);
    try {
      const localLocs = JSON.parse(localStorage.getItem("smartbus_locations") || "{}");
      localLocs[busNo] = { ...payload, ts: Date.now() };
      localStorage.setItem("smartbus_locations", JSON.stringify(localLocs));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}
  }
};

// Clean stop sharing: cancels onDisconnect, marks bus offline, closes shift log
const stopSharing = async (busNo, shiftLogId) => {
  if (busNo) {
    if (db) {
      try {
        db.ref(`buses/${busNo}/sharing`).onDisconnect().cancel();
        db.ref(`buses/${busNo}/currentDriver`).onDisconnect().cancel();
        db.ref(`locations/${busNo}/ts`).onDisconnect().cancel();

        const updates = {};
        updates[`buses/${busNo}/sharing`] = false;
        updates[`buses/${busNo}/currentDriver`] = null;
        updates[`locations/${busNo}/ts`] = 0;
        await db.ref().update(updates);
      } catch (e) {
        console.warn("stopSharing bus notice:", e.message);
      }
    }

    try {
      const localBuses = JSON.parse(localStorage.getItem("smartbus_buses") || "{}");
      if (localBuses[busNo]) {
        localBuses[busNo].sharing = false;
        localBuses[busNo].currentDriver = null;
        localStorage.setItem("smartbus_buses", JSON.stringify(localBuses));
      }
      const localLocs = JSON.parse(localStorage.getItem("smartbus_locations") || "{}");
      if (localLocs[busNo]) {
        localLocs[busNo].ts = 0;
        localStorage.setItem("smartbus_locations", JSON.stringify(localLocs));
      }
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}
  }

  if (shiftLogId && db) {
    try {
      await db.ref(`shiftLogs/${shiftLogId}`).update({
        endTime: serverTimestamp(),
        status: "completed",
      });
    } catch (e) {
      console.warn("stopSharing shiftLog notice:", e.message);
    }
  }
};

// Driver mark attendance & record duty shift log
const markAttendance = async (driverUid, busNo, routeId) => {
  if (!driverUid) throw new Error("Driver UID required for attendance.");

  const today = new Date().toISOString().split("T")[0];
  const shiftLogId = `${driverUid}_${Date.now()}`;

  const attData = {
    driverUid,
    busNo: busNo || null,
    routeId: routeId || null,
    date: today,
    markedAt: serverTimestamp(),
    shiftLogId,
  };

  const shiftData = {
    driverUid,
    busNo: busNo || null,
    routeId: routeId || null,
    date: today,
    startTime: serverTimestamp(),
    endTime: null,
    status: "active",
  };

  if (db) {
    try {
      const updates = {};
      updates[`attendance/${driverUid}_${today}`] = attData;
      updates[`shiftLogs/${shiftLogId}`] = shiftData;
      await db.ref().update(updates);
    } catch (e) {
      console.warn("markAttendance RTDB notice:", e.message);
    }
  }

  try {
    const localAtt = JSON.parse(localStorage.getItem("smartbus_attendance") || "{}");
    localAtt[`${driverUid}_${today}`] = {
      driverUid,
      driverName: sessionStorage.getItem("driverName") || "Driver",
      busNo: busNo || null,
      routeId: routeId || null,
      date: today,
      markedAt: Date.now(),
      status: "Present",
      shiftLogId,
    };
    localStorage.setItem("smartbus_attendance", JSON.stringify(localAtt));

    const localShifts = JSON.parse(localStorage.getItem("smartbus_shiftLogs") || "{}");
    localShifts[shiftLogId] = {
      driverUid,
      busNo: busNo || null,
      routeId: routeId || null,
      date: today,
      startTime: Date.now(),
      endTime: null,
      status: "active",
    };
    localStorage.setItem("smartbus_shiftLogs", JSON.stringify(localShifts));
    window.dispatchEvent(new Event("storage"));
  } catch (e) {}

  return { shiftLogId, date: today };
};

// Switch bus option (allowed only if driver is assigned to another bus by admin)
const switchBus = async (driverUid, oldBusNo, newBusNo) => {
  if (!driverUid || !newBusNo) throw new Error("Driver UID and new bus number required.");
  if (!db) throw new Error("Database not connected.");

  // Stop sharing on old bus first
  if (oldBusNo) {
    await stopSharing(oldBusNo);
  }

  // Verify that admin has assigned this bus to the driver
  const userSnap = await db.ref(`users/${driverUid}`).once("value");
  const userData = userSnap.val() || {};
  const allowedBuses = userData.assignedBuses || (userData.assignedBus ? [userData.assignedBus] : []);

  if (!allowedBuses.includes(newBusNo) && userData.assignedBus !== newBusNo) {
    throw new Error(`Bus ${newBusNo} is not assigned to your account. Contact Admin.`);
  }

  await db.ref(`users/${driverUid}`).update({ assignedBus: newBusNo });
  await db.ref(`buses/${newBusNo}`).update({ assignedDriver: driverUid });
};

// Auth wrappers
const initializeApp = (config, name) => firebase.initializeApp(config, name);
const getAuth = (appInstance) => (appInstance ? appInstance.auth() : auth);
const createUserWithEmailAndPassword = (authInstance, email, password) =>
  authInstance.createUserWithEmailAndPassword(email, password);
const signOut = (authInstance) => (authInstance ? authInstance.signOut() : auth.signOut());

// Friendly error messages
function friendlyError(err) {
  if (!err) return "An unknown error occurred.";
  const code = err.code || "";
  const msg = err.message || "";

  switch (code) {
    case "auth/email-already-in-use":
      return "This email address is already registered.";
    case "auth/invalid-email":
      return "The email address format is invalid.";
    case "auth/weak-password":
      return "The password is too weak. Please use at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "PERMISSION_DENIED":
    case "permission_denied":
      return "Permission denied: insufficient database permissions.";
    default:
      return msg.replace(/^Firebase:\s*/, "") || "Operation failed.";
  }
}

// User login (Admin and Driver only)
async function login(email, password) {
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const snap = await db.ref(`users/${cred.user.uid}`).once("value");
    if (!snap.exists()) {
      await auth.signOut();
      throw new Error("No user profile found for this account.");
    }
    const profile = snap.val();
    if (profile.role !== "admin" && profile.role !== "driver") {
      await auth.signOut();
      throw new Error("Only Admin and Driver accounts can log in.");
    }
    return { user: cred.user, profile };
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

// Role guard (Admin and Driver only - Public live map requires no login)
function requireRole(expectedRole, onSuccess, redirectUrl = null) {
  if (!redirectUrl) {
    redirectUrl = expectedRole === "driver" ? "driver-login.html" : "admin-login.html";
  }

  const isAdminSession =
    sessionStorage.getItem("adminLoggedIn") === "true" || sessionStorage.getItem("adminRole") === "admin";
  const isDriverSession = sessionStorage.getItem("driverLoggedIn") === "true";
  const driverUid = sessionStorage.getItem("driverUid");

  if (expectedRole === "admin" && isAdminSession) {
    const adminProfile = {
      name: sessionStorage.getItem("adminName") || "Admin",
      role: "admin",
      email: "admin@smartbus.com",
      uid: sessionStorage.getItem("adminUid") || "admin-root-uid",
    };
    if (typeof onSuccess === "function") {
      onSuccess({ uid: adminProfile.uid, email: adminProfile.email }, adminProfile);
    }
    return () => {};
  }

  if (auth && auth.onAuthStateChanged) {
    return auth.onAuthStateChanged(async (user) => {
      const activeUser =
        user ||
        (isDriverSession && driverUid
          ? { uid: driverUid, email: sessionStorage.getItem("driverEmail") || "" }
          : null);

      if (!activeUser) {
        if (!isAdminSession && !isDriverSession) window.location.href = redirectUrl;
        return;
      }

      try {
        const snap = db ? await db.ref(`users/${activeUser.uid}`).once("value") : null;
        if (!snap || !snap.exists()) {
          if (isDriverSession && expectedRole === "driver") {
            const fallbackProfile = {
              name: sessionStorage.getItem("driverName") || "Driver",
              role: "driver",
              assignedBus: sessionStorage.getItem("driverAssignedBus") || null,
              assignedRoute: sessionStorage.getItem("driverAssignedRoute") || null,
            };
            if (typeof onSuccess === "function") onSuccess(activeUser, fallbackProfile);
            return;
          }
          alert("No profile found for your account.");
          if (auth.signOut) await auth.signOut();
          window.location.href = redirectUrl;
          return;
        }
        const profile = snap.val();
        if (profile.role !== expectedRole) {
          alert(`Access denied: requires "${expectedRole}" role.`);
          if (auth.signOut) await auth.signOut();
          window.location.href = redirectUrl;
          return;
        }
        if (typeof onSuccess === "function") {
          onSuccess(activeUser, profile);
        }
      } catch (err) {
        console.error("requireRole error:", err);
        if (isDriverSession && expectedRole === "driver") {
          const fallbackProfile = {
            name: sessionStorage.getItem("driverName") || "Driver",
            role: "driver",
            assignedBus: sessionStorage.getItem("driverAssignedBus") || null,
            assignedRoute: sessionStorage.getItem("driverAssignedRoute") || null,
          };
          if (typeof onSuccess === "function") onSuccess(activeUser, fallbackProfile);
        } else {
          window.location.href = redirectUrl;
        }
      }
    });
  } else {
    if (!isAdminSession && !isDriverSession) window.location.href = redirectUrl;
    return () => {};
  }
}

// User logout
async function logout(redirectUrl = null) {
  sessionStorage.removeItem("adminLoggedIn");
  sessionStorage.removeItem("adminRole");
  sessionStorage.removeItem("adminName");
  sessionStorage.removeItem("adminUid");
  sessionStorage.removeItem("driverLoggedIn");
  sessionStorage.removeItem("driverUid");
  sessionStorage.removeItem("driverName");

  try {
    if (auth && auth.signOut) {
      await auth.signOut();
    }
  } catch (e) {}

  if (!redirectUrl) {
    redirectUrl = "login.html";
  }
  window.location.href = redirectUrl;
}

// Attach to global window
window.firebaseConfig = firebaseConfig;
window.app = app;
window.auth = auth;
window.db = db;
window.rtdb = db;
window.ref = ref;
window.get = get;
window.set = set;
window.update = update;
window.push = push;
window.remove = remove;
window.child = child;
window.off = off;
window.onValue = onValue;
window.watchAllBuses = watchAllBuses;
window.watchBus = watchBus;
window.startSharing = startSharing;
window.stopSharing = stopSharing;
window.markAttendance = markAttendance;
window.switchBus = switchBus;
window.getServerNow = getServerNow;
window.serverTimestamp = serverTimestamp;
window.initializeApp = initializeApp;
window.getAuth = getAuth;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut = signOut;
window.friendlyError = friendlyError;
window.login = login;
window.requireRole = requireRole;
window.logout = logout;
