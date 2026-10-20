// ============================================
// FIREBASE REALTIME DATABASE & AUTH CONFIGURATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyAN12u2jI3QN3OWz3-Qwsrk3cEAGjmsK-s",
  authDomain: "smart-bus-tracking-65f19.firebaseapp.com",
  databaseURL: "https://smart-bus-tracking-65f19-default-rtdb.firebaseio.com",
  projectId: "smart-bus-tracking-65f19",
  storageBucket: "smart-bus-tracking-65f19.firebasestorage.app",
  messagingSenderId: "547781095003",
  appId: "1:547781095003:web:acd322be2bcdf8069d997e",
};
//https://smart-bus-tracking-65f19-default-rtdb.firebaseio.com
// Initialize Firebase
let app = null;
let auth = null;
let db = null;

if (typeof firebase !== "undefined") {
  app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
  auth = firebase.auth();
  db = firebase.database();
}

// Database wrapper functions
const ref = (database, path) => (database && database.ref ? database.ref(path) : (db ? db.ref(path) : null));
const get = (dbRef) => dbRef.once("value");
const set = (dbRef, val) => dbRef.set(val);
const update = (dbRef, val) => dbRef.update(val);
const push = (dbRef, val) => (val !== undefined ? dbRef.push(val) : dbRef.push());
const remove = (dbRef) => dbRef.remove();
const child = (dbRef, path) => dbRef.child(path);
const off = (dbRef, eventType, cb) => dbRef.off(eventType, cb);

const onValue = (dbRef, callback, errorCallback) => {
  if (!dbRef) return () => {};
  const handler = (snap) => callback(snap);
  dbRef.on("value", handler, errorCallback);
  return () => dbRef.off("value", handler);
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

// User login
async function login(email, password) {
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const snap = await db.ref(`users/${cred.user.uid}`).once("value");
    if (!snap.exists()) {
      await auth.signOut();
      throw new Error("No user profile found for this account.");
    }
    const profile = snap.val();
    return { user: cred.user, profile };
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

// Role guard
function requireRole(expectedRole, onSuccess, redirectUrl = "admin-login.html") {
  const isAdminSession =
    sessionStorage.getItem("adminLoggedIn") === "true" || sessionStorage.getItem("adminRole") === "admin";

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
      if (!user) {
        if (!isAdminSession) window.location.href = redirectUrl;
        return;
      }
      try {
        const snap = await db.ref(`users/${user.uid}`).once("value");
        if (!snap.exists()) {
          if (!isAdminSession) {
            await auth.signOut();
            window.location.href = redirectUrl;
          }
          return;
        }
        const profile = snap.val();
        if (profile.role !== expectedRole) {
          alert(`Access denied: requires "${expectedRole}" role.`);
          await auth.signOut();
          window.location.href = redirectUrl;
          return;
        }
        if (typeof onSuccess === "function") {
          onSuccess(user, profile);
        }
      } catch (err) {
        console.error("requireRole error:", err);
        if (isAdminSession) {
          if (typeof onSuccess === "function") {
            onSuccess({ uid: "admin-root-uid", email: "admin@smartbus.com" }, { name: "Admin", role: "admin" });
          }
        } else {
          window.location.href = redirectUrl;
        }
      }
    });
  } else {
    if (!isAdminSession) window.location.href = redirectUrl;
    return () => {};
  }
}

// User logout
async function logout(redirectUrl = "admin-login.html") {
  sessionStorage.removeItem("adminLoggedIn");
  sessionStorage.removeItem("adminRole");
  sessionStorage.removeItem("adminName");
  sessionStorage.removeItem("adminUid");
  try {
    if (auth && auth.signOut) {
      await auth.signOut();
    }
  } catch (e) {}
  window.location.href = redirectUrl;
}

// Attach to global window
window.firebaseConfig = firebaseConfig;
window.app = app;
window.auth = auth;
window.db = db;
window.ref = ref;
window.get = get;
window.set = set;
window.update = update;
window.push = push;
window.remove = remove;
window.child = child;
window.off = off;
window.onValue = onValue;
window.initializeApp = initializeApp;
window.getAuth = getAuth;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut = signOut;
window.friendlyError = friendlyError;
window.login = login;
window.requireRole = requireRole;
window.logout = logout;
