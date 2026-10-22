// ============================================
// FIREBASE CONFIGURATION
// Firebase web app settings are public client configuration. A local config
// loaded before this file can override these defaults for another environment.
// ============================================

var firebaseConfig = window.firebaseConfig || {
  apiKey: "AIzaSyAN12u2jI3QN3OWz3-Qwsrk3cEAGjmsK-s",
  authDomain: "smart-bus-tracking-65f19.firebaseapp.com",
  databaseURL: "https://smart-bus-tracking-65f19-default-rtdb.firebaseio.com",
  projectId: "smart-bus-tracking-65f19",
  storageBucket: "smart-bus-tracking-65f19.firebasestorage.app",
  messagingSenderId: "547781095003",
  appId: "1:547781095:web:acd322be2bcdf8069d997e",
};
window.firebaseConfig = firebaseConfig;

if (firebaseConfig && typeof firebase !== "undefined" && firebase.apps && firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

// These are used everywhere across the app:
var auth = firebaseConfig && typeof firebase !== "undefined" && typeof firebase.auth === "function" ? firebase.auth() : (window.auth || null);
var firestoreDb = firebaseConfig && typeof firebase !== "undefined" && typeof firebase.firestore === "function" ? firebase.firestore() : (window.firestoreDb || null);
var rtdb = firebaseConfig && typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : (window.rtdb || null);
window.firestoreDb = firestoreDb;
window.rtdb = rtdb;

// Keep each browser tab's login separate so tabs don't conflict.
if (firebaseConfig && auth && auth.setPersistence) {
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
}
