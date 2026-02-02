// firebase-config.js — Shared Firebase configuration
//
// Setup instructions:
// 1. Go to https://console.firebase.google.com and create a new project
// 2. In Project Settings, scroll to "Your apps" and click the web icon (</>)
// 3. Register your app (no need to enable Firebase Hosting unless you want to)
// 4. Copy the firebaseConfig object and paste it below, replacing the placeholders
// 5. Go to Firestore Database in the console and click "Create database"
//    - Choose "Start in test mode" for now (good for 30 days)
//    - Pick a region close to you
// 6. After 30 days, update the Firestore rules to:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /reservations/{doc} {
//          allow read: if true;
//          allow create: if request.resource.data.status == "pending";
//          allow update, delete: if true;
//        }
//      }
//    }

var firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
