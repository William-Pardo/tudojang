// public/firebase-messaging-sw.js
// IMPORTANT: This file must be in the 'public' folder.

// This service worker is required for Firebase Cloud Messaging to work in the background.
// It must load the Firebase app and messaging scripts.
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// ====================================================================================
// TODO: ACTION REQUIRED
// You must replace the placeholder configuration below with your project's
// Firebase configuration. You can find it in your Firebase project settings.
// ====================================================================================
const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Initialize Firebase if it's not already initialized.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// Handler for background messages.
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload
  );
  
  const notificationTitle = payload.notification?.title || "Nueva Notificación";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icon-192x192.png", // A default icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
