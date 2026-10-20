const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

let db = null;
let auth = null;
let isInitialized = false;

try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(__dirname, "..", process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : path.resolve(__dirname, "../serviceAccountKey.json");

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
    console.log("✅ Firebase Admin initialized with serviceAccountKey.json.");
    db = admin.firestore();
    auth = admin.auth();
    isInitialized = true;
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    admin.initializeApp();
    console.log("✅ Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS.");
    db = admin.firestore();
    auth = admin.auth();
    isInitialized = true;
  } else {
    console.log("ℹ️ No 'serviceAccountKey.json' found in backend/. Running in Development Mode.");
    console.log("👉 Tip: Place 'serviceAccountKey.json' in 'smart-bus-tracking/backend/' to connect to live Firestore.");
    db = null;
    auth = null;
    isInitialized = false;
  }
} catch (error) {
  console.warn("⚠️ Firebase Admin initialization notice:", error.message);
  console.warn("👉 Place your 'serviceAccountKey.json' in 'smart-bus-tracking/backend/' to connect to live Firestore.");
  db = null;
  auth = null;
  isInitialized = false;
}

module.exports = {
  admin,
  db,
  auth,
  isInitialized,
};
