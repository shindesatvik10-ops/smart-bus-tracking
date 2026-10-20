SMART BUS TRACKING SYSTEM (for passengers)

Update steps
  1. Copy everything inside "frontend" into your frontend folder (overwrite).
  2. Firebase Console -> Firestore Database -> Rules -> paste firestore.rules -> Publish
  3. In the frontend folder (Command Prompt) run:  firebase deploy
  4. Browser: Ctrl + Shift + R

Creating an Admin: Firebase Console -> Authentication -> Add user (copy UID);
  Firestore -> users -> new document, ID = UID, fields: name, email,
  role = admin, status = approved
