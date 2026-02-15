// ─── Firebase Initialization ───

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase config is public by design — security is enforced
// via Firestore rules + Auth, not by hiding these values.
const firebaseConfig = {
    apiKey: "AIzaSyCmrJ6O2xbQ9Bx9mk2JHuPlVvdrBqURTi0",
    authDomain: "paycheck-planner-4e387.firebaseapp.com",
    projectId: "paycheck-planner-4e387",
    storageBucket: "paycheck-planner-4e387.firebasestorage.app",
    messagingSenderId: "789503116835",
    appId: "1:789503116835:web:86773d2064938800255396",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
