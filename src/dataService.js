// ─── Data Service Layer ───
// Abstraction between the app and storage backend.
// Currently uses Firebase Firestore. To switch to your own API,
// just replace the implementations in this file — App.jsx stays untouched.

import { db, auth, googleProvider } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";

// ─── AUTH ───

/** Listen for auth state changes. Calls onUser(user) or onUser(null). */
export function initAuth(onUser) {
    return onAuthStateChanged(auth, (user) => {
        onUser(user ? { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null);
    });
}

/** Sign in with Google popup. */
export async function signIn() {
    return signInWithPopup(auth, googleProvider);
}

/** Sign out. */
export async function signOut() {
    return firebaseSignOut(auth);
}

// ─── DATA ───

const getUserDocRef = (uid) => doc(db, "users", uid);

/** Load all user data from Firestore. Returns null if no data exists. */
export async function loadUserData(uid) {
    const snap = await getDoc(getUserDocRef(uid));
    if (snap.exists()) return snap.data();
    return null;
}

/** Save all user data to Firestore. Throws on failure. */
export async function saveUserData(uid, data) {
    await setDoc(getUserDocRef(uid), data, { merge: true });
}

/** Subscribe to real-time data changes (for cross-device sync).
 *  Returns an unsubscribe function. */
export function subscribeToData(uid, callback) {
    return onSnapshot(getUserDocRef(uid), (snap) => {
        if (snap.exists()) {
            callback(snap.data());
        }
    }, (error) => {
        console.error("subscribeToData error:", error);
    });
}
