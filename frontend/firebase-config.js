// ============================================
// FIREBASE CONFIGURATION
// This file connects every page to our Firebase project.
// It must be loaded (via <script>) BEFORE any page's own
// login/dashboard script, and AFTER the Firebase SDK scripts.
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
window.firebaseConfig = firebaseConfig;
//https://smart-bus-tracking-65f19-default-rtdb.firebaseio.com
//https://smart-bus-tracker-13d71-default-rtdb.asia-southeast1.firebasedatabase.app

// Initialize Firebase (using the "compat" SDK — works with plain <script> tags,
// no build tools or import statements needed)
if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

// These are used everywhere across the app:
var auth = typeof firebase !== "undefined" && typeof firebase.auth === "function" ? firebase.auth() : (window.auth || null);
var firestoreDb = typeof firebase !== "undefined" && typeof firebase.firestore === "function" ? firebase.firestore() : (window.firestoreDb || null);
var rtdb = typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : (window.rtdb || null);
window.firestoreDb = firestoreDb;
window.rtdb = rtdb;

// Keep each browser tab's login separate so tabs don't conflict.
if (auth && auth.setPersistence) {
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
}
