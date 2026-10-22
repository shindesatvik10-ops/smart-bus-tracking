// ============================================
// FIREBASE CONFIGURATION
// Firebase web app settings are public client configuration. A local config
// loaded before this file can override these defaults for another environment.
// ============================================

var DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAN12u2jI3QN3OWz3-Qwsrk3cEAGjmsK-s",
  authDomain: "smart-bus-tracking-65f19.firebaseapp.com",
  databaseURL: "https://smart-bus-tracking-65f19-default-rtdb.firebaseio.com",
  projectId: "smart-bus-tracking-65f19",
  storageBucket: "smart-bus-tracking-65f19.firebasestorage.app",
  messagingSenderId: "547781095003",
  appId: "1:547781095003:web:acd322be2bcdf8069d997e",
};

var firebaseConfig = window.firebaseConfig || DEFAULT_FIREBASE_CONFIG;
window.firebaseConfig = firebaseConfig;

if (firebaseConfig && typeof firebase !== "undefined" && firebase.apps && firebase.apps.length === 0) {
  try {
    firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.warn("Firebase initialization notice:", e.message);
  }
}

// These are used everywhere across the app:
var auth = firebaseConfig && typeof firebase !== "undefined" && typeof firebase.auth === "function" ? firebase.auth() : (window.auth || null);
var firestoreDb = firebaseConfig && typeof firebase !== "undefined" && typeof firebase.firestore === "function" ? firebase.firestore() : (window.firestoreDb || null);
var rtdb = firebaseConfig && typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : (window.rtdb || null);
window.auth = auth;
window.firestoreDb = firestoreDb;
window.rtdb = rtdb;

// Keep each browser tab's login separate so tabs don't conflict.
if (firebaseConfig && auth && auth.setPersistence) {
  try {
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  } catch (e) {}
}
