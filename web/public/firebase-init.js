import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function signInAndWatch(onUserReady) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      onUserReady(`web:${user.uid}`);
    }
  });
  signInAnonymously(auth).catch((err) => {
    console.error("Anonymous sign-in failed:", err);
  });
}
