// ============================================
// FIREBASE CONFIGURATION
// Firebase settings are provided by the ignored firebase-config.local.js.
// ============================================

var firebaseConfig = window.firebaseConfig || null;

if (!firebaseConfig) {
  console.error("Firebase is not configured. Copy firebase-config.example.js to firebase-config.local.js and add your project settings.");
}

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
