import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5BZnVvqNy6WGxfHDFsQgVEt_1ppa-cxw",
  authDomain: "tayabi-sales.firebaseapp.com",
  projectId: "tayabi-sales",
  storageBucket: "tayabi-sales.firebasestorage.app",
  messagingSenderId: "648938950474",
  appId: "1:648938950474:web:b7a1fe94fcbbc82325bbb3"
};

const app = initializeApp(firebaseConfig);

// Enable offline persistence using the modern API
export const db = initializeFirestore(app, {
  cache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const storage = getStorage(app);
